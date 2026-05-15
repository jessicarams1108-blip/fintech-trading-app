import { apiFetch } from "@/lib/apiBase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import { AdminDepositReviewTable } from "@/components/AdminDepositReviewTable";

type Queues = {
  withdrawals: {
    id: string;
    user_email: string;
    asset: string;
    amount: string;
    destination: string;
    status: string;
    created_at: string;
  }[];
  borrows: {
    id: string;
    user_email: string;
    asset: string;
    amount_usd: string;
    rate_mode: string;
    status: string;
    created_at: string;
  }[];
  transfers: {
    id: string;
    from_email: string;
    to_email: string;
    asset: string;
    amount: string;
    status: string;
    created_at: string;
  }[];
};

type AdminUserRow = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  accountStatus: string;
  createdAt: string;
};

async function adminFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers as object) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: unknown };
  if (!res.ok) {
    const err = body.error;
    let msg: string;
    if (typeof err === "string") msg = err;
    else if (err && typeof err === "object") {
      const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const parts = [
        ...(flat.formErrors ?? []),
        ...Object.entries(flat.fieldErrors ?? {}).flatMap(([k, v]) => v.map((x) => `${k}: ${x}`)),
      ];
      msg = parts.length > 0 ? parts.join(" · ") : res.statusText;
    } else {
      msg = res.statusText;
    }
    throw new Error(msg);
  }
  return body as T;
}

function userDisplayName(u: AdminUserRow): string {
  const n = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return n || u.email;
}

/** Strip $, commas, spaces so "7,858,600" and "$100" validate as numbers. */
function normalizeAdminUsdAmount(raw: string): string {
  return raw
    .trim()
    .replace(/^\+/, "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function AdminConsolePage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [depositRefresh, setDepositRefresh] = useState(0);
  const [userFilter, setUserFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [asset, setAsset] = useState("USDT");
  const [adjustMode, setAdjustMode] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");

  const bump = () => {
    setDepositRefresh((n) => n + 1);
    void qc.invalidateQueries({ queryKey: ["admin", "queues"] });
    void qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const summary = useQuery({
    queryKey: ["admin", "queues", token],
    enabled: !!token,
    queryFn: () => adminFetch<{ data: Queues }>("/api/admin/queues/summary", token!).then((r) => r.data),
  });

  const usersQ = useQuery({
    queryKey: ["admin", "users", token],
    enabled: !!token,
    queryFn: () => adminFetch<{ data: AdminUserRow[] }>("/api/admin/users", token!).then((r) => r.data),
  });

  const f = userFilter.trim().toLowerCase();
  const filteredUsers = useMemo(() => {
    const list = usersQ.data ?? [];
    if (!f) return list;
    return list.filter((u) => {
      const hay = `${u.email} ${u.username ?? ""} ${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase();
      return hay.includes(f);
    });
  }, [usersQ.data, f]);

  const amountMag = normalizeAdminUsdAmount(amount);
  const symUpper = asset.trim().toUpperCase();
  const canApplyBalance =
    /^[0-9]+(\.[0-9]+)?$/.test(amountMag) && (selectedUserId != null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));

  const pricePreview = useQuery({
    queryKey: ["market", "price", symUpper],
    queryFn: async () => {
      const r = await apiFetch(`/api/market/price?symbol=${encodeURIComponent(symUpper)}`);
      const b = (await r.json()) as { error?: string; data?: { priceUsd: number } };
      if (!r.ok) throw new Error(typeof b.error === "string" ? b.error : "Price unavailable");
      return b.data!.priceUsd;
    },
    enabled: symUpper.length >= 2 && /^[0-9]+(\.[0-9]+)?$/.test(amountMag),
    staleTime: 30_000,
  });

  const balanceMut = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Not signed in");
      const mag = normalizeAdminUsdAmount(amount);
      if (!/^[0-9]+(\.[0-9]+)?$/.test(mag)) {
        throw new Error("Enter a positive dollar amount (e.g. 100 for one hundred US dollars worth of the asset).");
      }
      const amountUsd = adjustMode === "add" ? mag : `-${mag}`;
      const payload =
        selectedUserId != null
          ? { userId: selectedUserId, asset: asset.trim(), amountUsd }
          : { email: email.trim(), asset: asset.trim(), amountUsd };
      return adminFetch<{
        data: {
          newBalance: string;
          appliedDelta: string;
          requestedDelta?: string;
          spotUsd?: number;
          usedAmountUsd?: string;
        };
      }>("/api/admin/user/balance-adjust", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (r) => {
      const sym = asset.trim().toUpperCase();
      const spot = r.data.spotUsd;
      const req = r.data.requestedDelta;
      const applied = r.data.appliedDelta;
      const clampNote =
        req != null && req !== applied
          ? ` (requested ${req} ${sym}; applied ${applied} ${sym} — full amount was not available).`
          : "";
      const detail =
        spot != null && Number.isFinite(spot)
          ? `Applied ${applied} ${sym} (spot ~$${spot.toLocaleString("en-US", { maximumFractionDigits: 2 })}/${sym}).${clampNote}`
          : `Applied ${applied} ${sym}.${clampNote}`;
      showToast(adjustMode === "add" ? `Balance credited. ${detail}` : `Balance debited. ${detail}`);
      setAmount("");
      bump();
    },
    onError: (e: Error) => showToast(e.message),
  });

  async function approveWithdrawal(id: string) {
    if (!token) return;
    try {
      await adminFetch(`/api/admin/withdrawal/${id}/approve`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      showToast("Withdrawal approved");
      bump();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function rejectWithdrawal(id: string) {
    if (!token) return;
    const reason = window.prompt("Rejection reason?")?.trim();
    if (!reason) return;
    try {
      await adminFetch(`/api/admin/withdrawal/${id}/reject`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      showToast("Withdrawal rejected");
      bump();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function approveBorrow(id: string) {
    if (!token) return;
    try {
      await adminFetch(`/api/admin/borrow-request/${id}/approve`, token, { method: "POST" });
      showToast("Borrow approved and disbursed");
      bump();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function rejectBorrow(id: string) {
    if (!token) return;
    const reason = window.prompt("Rejection reason?")?.trim();
    if (!reason) return;
    try {
      await adminFetch(`/api/admin/borrow-request/${id}/reject`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      showToast("Borrow request rejected");
      bump();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function approveTransfer(id: string) {
    if (!token) return;
    try {
      await adminFetch(`/api/admin/transfer-request/${id}/approve`, token, { method: "POST" });
      showToast("Transfer approved");
      bump();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function rejectTransfer(id: string) {
    if (!token) return;
    const reason = window.prompt("Rejection reason?")?.trim();
    if (!reason) return;
    try {
      await adminFetch(`/api/admin/transfer-request/${id}/reject`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      showToast("Transfer rejected");
      bump();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  const q = summary.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-12">
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-500">Operations</p>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Admin console</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
          Review deposits, pick a sign-in user to adjust wallet balance, and clear withdrawal / borrow / transfer
          queues.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <aside className="space-y-3 lg:col-span-3 lg:min-h-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sign-in users</h2>
          <p className="text-xs text-slate-500">
            Email-verified accounts (can log in). Click one to target balance changes — not KYC tier.
          </p>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Filter by email or @username…"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          />
          <div className="max-h-[min(50vh,22rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {usersQ.isLoading ? (
              <p className="p-3 text-sm text-slate-500">Loading users…</p>
            ) : usersQ.isError ? (
              <p className="p-3 text-sm text-red-600">{(usersQ.error as Error).message}</p>
            ) : filteredUsers.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">No matching users.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const active = selectedUserId === u.id;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setEmail(u.email);
                        }}
                        className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                          active ? "bg-slate-100 font-medium" : ""
                        }`}
                      >
                        <span className="truncate text-slate-900">{userDisplayName(u)}</span>
                        <span className="truncate font-mono text-xs text-slate-500">{u.email}</span>
                        {u.username ? (
                          <span className="text-xs text-slate-400">@{u.username}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-6 lg:col-span-9">
          <section className="min-w-0 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Deposits</h2>
            <AdminDepositReviewTable refreshToken={depositRefresh} onQueuesChanged={bump} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">User balance adjustment</h2>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              Choose <span className="font-semibold text-emerald-800">add</span> to credit the user&apos;s wallet or{" "}
              <span className="font-semibold text-red-800">remove</span> to debit it (cannot go below zero for that
              asset). Enter how many <span className="font-semibold">US dollars</span> worth of the chosen asset to add
              or remove — the server converts using the live USD price (e.g. $100 of BTC at ~$79,559/BTC ≈{" "}
              <span className="font-mono">0.0012569</span> BTC). Pick a user on the left or type their email.
            </p>
            {selectedUserId ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
                Selected: <span className="font-mono font-semibold">{email}</span>
                <button
                  type="button"
                  className="ml-3 text-xs font-semibold text-oove-blue underline"
                  onClick={() => {
                    setSelectedUserId(null);
                    setEmail("");
                  }}
                >
                  Clear
                </button>
              </p>
            ) : (
              <label className="mt-3 block text-xs font-medium uppercase text-slate-500">
                User email (if not using list)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAdjustMode("add")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  adjustMode === "add"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Add to balance
              </button>
              <button
                type="button"
                onClick={() => setAdjustMode("remove")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  adjustMode === "remove"
                    ? "bg-red-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Remove from balance
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium uppercase text-slate-500">
                Asset
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  placeholder="BTC, ETH, USDT, …"
                />
                <span className="mt-1 block text-[11px] font-normal normal-case text-slate-500">
                  Wallets only: USD, BTC, ETH, USDT, USDC, DAI (must match DB).
                </span>
              </label>
              <label className="text-xs font-medium uppercase text-slate-500">
                Amount (USD notional)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={adjustMode === "add" ? "e.g. 100 ($100 worth)" : "e.g. 50 ($50 worth removed)"}
                  min={0}
                  inputMode="decimal"
                />
                <span className="mt-1 block text-[11px] font-normal normal-case text-slate-500">
                  You can use commas or a $ prefix (e.g. 7,858,600 or $100); they are stripped before sending.
                </span>
              </label>
            </div>
            {pricePreview.isSuccess && /^[0-9]+(\.[0-9]+)?$/.test(amountMag) ? (
              <p className="mt-2 text-xs text-slate-600">
                At ~${pricePreview.data.toLocaleString("en-US", { maximumFractionDigits: 2 })} per {symUpper},{" "}
                {adjustMode === "add" ? "credit" : "debit"} ≈{" "}
                <span className="font-mono font-semibold text-slate-800">
                  {(Number.parseFloat(amountMag) / pricePreview.data).toFixed(8)} {symUpper}
                </span>
                .
              </p>
            ) : pricePreview.isError && /^[0-9]+(\.[0-9]+)?$/.test(amountMag) && symUpper.length >= 2 ? (
              <p className="mt-2 text-xs text-amber-700">No live USD price for {symUpper}; conversion may fail until a price exists.</p>
            ) : null}
            <button
              type="button"
              disabled={balanceMut.isPending || !canApplyBalance}
              onClick={() => balanceMut.mutate()}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {adjustMode === "add" ? "Apply credit" : "Apply debit"}
            </button>
          </section>

          {summary.isError ? <p className="text-sm text-red-600">{(summary.error as Error).message}</p> : null}

          <div className="grid gap-4 md:grid-cols-3">
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending withdrawals</h2>
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
                {(q?.withdrawals ?? []).length === 0 ? <li className="text-slate-500">None.</li> : null}
                {(q?.withdrawals ?? []).map((w) => (
                  <li key={w.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <div className="font-medium text-slate-800">{w.user_email}</div>
                    <div className="mt-1 font-mono text-[11px] text-slate-600">
                      {w.asset} {w.amount}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-oove-blue hover:underline"
                        onClick={() => void approveWithdrawal(w.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => void rejectWithdrawal(w.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending borrows</h2>
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
                {(q?.borrows ?? []).length === 0 ? <li className="text-slate-500">None.</li> : null}
                {(q?.borrows ?? []).map((b) => (
                  <li key={b.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <div className="font-medium text-slate-800">{b.user_email}</div>
                    <div className="mt-1 text-slate-600">
                      {b.asset} ${b.amount_usd} ({b.rate_mode})
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-oove-blue hover:underline"
                        onClick={() => void approveBorrow(b.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => void rejectBorrow(b.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending transfers</h2>
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
                {(q?.transfers ?? []).length === 0 ? <li className="text-slate-500">None.</li> : null}
                {(q?.transfers ?? []).map((t) => (
                  <li key={t.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <div className="break-all text-slate-800">
                      {t.from_email} → {t.to_email}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-600">
                      {t.asset} {t.amount}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-oove-blue hover:underline"
                        onClick={() => void approveTransfer(t.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => void rejectTransfer(t.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
