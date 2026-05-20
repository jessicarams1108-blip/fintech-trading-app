import { apiFetch } from "@/lib/apiBase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";

function formatTransferStatus(status: string): string {
  return status.replace(/pending_admin/gi, "pending");
}

function formatUsdAmount(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

async function authFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers as object) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: unknown };
  if (!res.ok) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string" && err.length > 0) throw new Error(err);
    if (err && typeof err === "object") {
      const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
      const parts = [
        ...(flat.formErrors ?? []),
        ...Object.entries(flat.fieldErrors ?? {}).flatMap(([k, v]) => (v ?? []).map((x) => `${k}: ${x}`)),
      ];
      if (parts.length) throw new Error(parts.join(" · "));
    }
    throw new Error(res.statusText);
  }
  return body as T;
}

type WithdrawalRow = {
  id: string;
  status: string;
  amount: string;
  asset: string;
  amount_usd?: string | null;
  method?: string | null;
  bank_name?: string | null;
  admin_notes?: string | null;
};

export function TransfersPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"deposit" | "withdraw" | "send" | "receive">("deposit");
  const [asset, setAsset] = useState("BTC");
  const [depAddr, setDepAddr] = useState<string | null>(null);

  const [wdMethod, setWdMethod] = useState<"crypto" | "wire">("crypto");
  const [wdAmount, setWdAmount] = useState("");
  const [wdDest, setWdDest] = useState("");
  const [wdBankName, setWdBankName] = useState("");
  const [wdBankAccount, setWdBankAccount] = useState("");
  const [wdBankRouting, setWdBankRouting] = useState("");

  const [sendEmail, setSendEmail] = useState("");
  const [sendAmt, setSendAmt] = useState("");
  const [sendAsset, setSendAsset] = useState("USDT");

  const [plannedDeposit, setPlannedDeposit] = useState("");

  const cashBalance = useQuery({
    queryKey: ["wallet", "balance", token],
    enabled: !!token,
    queryFn: () =>
      authFetch<{ data: { cashBoxUsd: number } }>("/api/wallet/balance", token!).then((r) => r.data.cashBoxUsd),
    refetchInterval: 30_000,
  });

  const transferReq = useQuery({
    queryKey: ["transfers", "my-transfer-requests", token],
    enabled: !!token,
    queryFn: () =>
      authFetch<{ data: { id: string; asset: string; amount: string; status: string; created_at: string }[] }>(
        "/api/transfers/my-transfer-requests",
        token!,
      ).then((r) => r.data),
  });

  const hist = useQuery({
    queryKey: ["transfers", "history", token],
    enabled: !!token,
    queryFn: () => authFetch<{ data: { withdrawals: WithdrawalRow[] } }>("/api/transfers/history", token!),
  });

  async function loadDepositAddr() {
    if (!token) return;
    try {
      const r = await authFetch<{ data: { address: string } }>(
        `/api/transfers/deposit/address?asset=${encodeURIComponent(asset)}`,
        token,
      );
      setDepAddr(r.data.address);
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  const wdMut = useMutation({
    mutationFn: async () => {
      if (!token) return;
      const amt = Number(wdAmount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a USD amount greater than 0");
      const available = cashBalance.data ?? 0;
      if (wdMethod === "wire" && amt > available + 0.01) {
        throw new Error(`Amount exceeds available cash balance ($${available.toLocaleString()})`);
      }

      const body: Record<string, unknown> = {
        method: wdMethod,
        amountUsd: amt,
      };
      if (wdMethod === "crypto") {
        body.asset = asset;
        body.destination = wdDest;
      } else {
        body.bankName = wdBankName;
        body.bankAccountNumber = wdBankAccount;
        body.bankRoutingNumber = wdBankRouting;
      }

      await authFetch("/api/transfers/withdraw", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      showToast(
        wdMethod === "wire"
          ? "Wire transfer withdrawal submitted — admin will review and release funds."
          : "Withdrawal queued for admin review",
      );
      setWdAmount("");
      setWdDest("");
      setWdBankName("");
      setWdBankAccount("");
      setWdBankRouting("");
      void qc.invalidateQueries({ queryKey: ["transfers", "history"] });
      void qc.invalidateQueries({ queryKey: ["wallet", "balance"] });
    },
    onError: (e: Error) => showToast(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!token) return;
      await authFetch("/api/transfers/send", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: sendEmail, asset: sendAsset, amount: Number(sendAmt) }),
      });
    },
    onSuccess: () => {
      showToast("Internal transfer queued for admin approval");
      void qc.invalidateQueries({ queryKey: ["transfers", "history"] });
      void qc.invalidateQueries({ queryKey: ["transfers", "my-transfer-requests"] });
    },
    onError: (e: Error) => showToast(e.message),
  });

  const availableUsd = cashBalance.data ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Transfers</h1>
        <p className="mt-2 text-slate-600">
          Deposit, withdraw to crypto or your bank, or send to another Oove user. Withdrawals and internal sends are
          released after administrator approval.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(["deposit", "withdraw", "send", "receive"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              if (t === "deposit") void loadDepositAddr();
            }}
            className={
              tab === t
                ? "rounded-full bg-oove-blue px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            }
          >
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "deposit" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <label className="text-sm font-medium">Asset</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          >
            {["BTC", "ETH", "USDT", "USDC", "DAI"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <p className="text-sm text-slate-600">
            For credited USD on-chain deposits, use <strong>Supply</strong> and declare the amount there (minimum
            applies). You can note how much you plan to send here for your own records.
          </p>
          <label className="text-sm font-medium text-slate-700">Planned amount (optional, not submitted)</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
            placeholder="e.g. 500 USDT"
            value={plannedDeposit}
            onChange={(e) => setPlannedDeposit(e.target.value)}
          />
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void loadDepositAddr()}
          >
            Show treasury address
          </button>
          {depAddr ? (
            <div className="flex flex-col items-center gap-4 pt-4">
              <QRCodeSVG value={depAddr} size={180} />
              <p className="break-all font-mono text-sm text-center">{depAddr}</p>
              <p className="text-xs text-amber-700">Preview address. Use Supply flow to submit proofs for credit.</p>
            </div>
          ) : null}
        </div>
      )}

      {tab === "withdraw" && (
        <form
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            wdMut.mutate();
          }}
        >
          <h2 className="font-semibold text-slate-900">Request withdrawal</h2>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p className="text-slate-500">Available cash balance</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {formatUsdAmount(availableUsd)}
            </p>
          </div>

          <div className="flex gap-2">
            {(["crypto", "wire"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setWdMethod(m)}
                className={
                  wdMethod === m
                    ? "flex-1 rounded-xl bg-oove-blue px-4 py-2 text-sm font-semibold text-white"
                    : "flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                }
              >
                {m === "crypto" ? "Crypto address" : "Bank wire transfer"}
              </button>
            ))}
          </div>

          {wdMethod === "crypto" ? (
            <>
              <label className="block text-sm font-medium text-slate-700">Asset to withdraw</label>
              <select
                className="w-full rounded-xl border px-3 py-2"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
              >
                {["BTC", "ETH", "USDT", "USDC", "DAI"].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <label className="block text-sm font-medium text-slate-700">Amount (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-xl border px-3 py-2 tabular-nums"
                placeholder="e.g. 500"
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
              />
              <label className="block text-sm font-medium text-slate-700">Destination address</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                placeholder="Crypto destination address"
                value={wdDest}
                onChange={(e) => setWdDest(e.target.value)}
              />
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Amount to withdraw (USD, from cash balance)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-xl border px-3 py-2 tabular-nums"
                placeholder="e.g. 500"
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
              />
              <label className="block text-sm font-medium text-slate-700">Bank name</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                placeholder="e.g. Chase Bank"
                value={wdBankName}
                onChange={(e) => setWdBankName(e.target.value)}
              />
              <label className="block text-sm font-medium text-slate-700">Account number</label>
              <input
                className="w-full rounded-xl border px-3 py-2 tabular-nums"
                placeholder="Bank account number"
                value={wdBankAccount}
                onChange={(e) => setWdBankAccount(e.target.value)}
              />
              <label className="block text-sm font-medium text-slate-700">Routing number</label>
              <input
                className="w-full rounded-xl border px-3 py-2 tabular-nums"
                placeholder="ABA routing number (9 digits)"
                value={wdBankRouting}
                onChange={(e) => setWdBankRouting(e.target.value)}
              />
            </>
          )}

          <p className="text-sm text-slate-500">Fee: $0 · ETA after approval: 1–24h</p>
          <button
            type="submit"
            disabled={wdMut.isPending}
            className="w-full rounded-xl bg-oove-blue py-2 font-semibold text-white disabled:opacity-50"
          >
            {wdMut.isPending
              ? "Submitting…"
              : wdMethod === "wire"
                ? "Submit wire transfer withdrawal"
                : "Request withdrawal"}
          </button>
        </form>
      )}

      {tab === "send" && (
        <form
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            sendMut.mutate();
          }}
        >
          <h2 className="font-semibold text-slate-900">Send to Oove user</h2>
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Recipient email"
            value={sendEmail}
            onChange={(e) => setSendEmail(e.target.value)}
          />
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={sendAsset}
            onChange={(e) => setSendAsset(e.target.value)}
          >
            {["USDT", "USDC", "DAI", "ETH", "BTC"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Amount"
            value={sendAmt}
            onChange={(e) => setSendAmt(e.target.value)}
          />
          <button
            type="submit"
            disabled={sendMut.isPending}
            className="w-full rounded-xl bg-slate-900 py-2 font-semibold text-white disabled:opacity-50"
          >
            {sendMut.isPending ? "Submitting…" : "Submit transfer request"}
          </button>
        </form>
      )}

      {tab === "receive" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-slate-700">Generate a deposit address for an asset (same treasury routing as Deposit tab).</p>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          >
            {["BTC", "ETH", "USDT"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
            onClick={() => void loadDepositAddr()}
          >
            Show address
          </button>
          {depAddr ? <p className="font-mono text-sm break-all">{depAddr}</p> : null}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Internal transfer requests</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {(transferReq.data ?? []).length === 0 ? (
            <li>No transfer requests yet.</li>
          ) : (
            (transferReq.data ?? []).map((t) => (
              <li key={t.id}>
                {t.asset} {t.amount} — <span className="font-medium">{formatTransferStatus(t.status)}</span> ·{" "}
                {new Date(t.created_at).toLocaleString()}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Recent withdrawal requests</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {(hist.data?.data.withdrawals ?? []).length === 0 ? (
            <li>No withdrawals yet.</li>
          ) : (
            (hist.data?.data.withdrawals ?? []).map((w) => (
              <li key={w.id} className="rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold">
                      {w.method === "wire" ? "Wire transfer" : `${w.asset} crypto`}
                    </span>{" "}
                    — {formatUsdAmount(w.amount_usd)}
                  </span>
                  <span className="font-medium">{formatTransferStatus(w.status)}</span>
                </div>
                {w.method === "wire" && w.bank_name ? (
                  <div className="mt-1 text-xs text-slate-500">To: {w.bank_name}</div>
                ) : null}
                {w.status === "rejected" && w.admin_notes ? (
                  <div className="mt-1 text-xs text-red-600">Reason: {w.admin_notes}</div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
