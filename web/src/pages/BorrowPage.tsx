import { apiFetch } from "@/lib/apiBase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import { usePreferences } from "@/state/PreferencesContext";

type Power = {
  suppliedUsd: number;
  outstandingBorrowUsd: number;
  pendingBorrowUsd: number;
  grossMaxBorrowUsd: number;
  availableBorrowUsd: number;
  maxLtvPct: number;
  healthFactor: number;
  collateral: { asset: string; balance: string; balanceNum: number }[];
  positions: {
    id: string;
    asset: string;
    principal_usd: string;
    rate_mode: string;
    variable_apr: string;
    stable_apr: string;
    interest_accrued_usd: string;
    status: string;
    created_at: string;
  }[];
};

async function authFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers as object) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

const ASSETS = ["USDC", "USDT", "DAI"];

export function BorrowPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { formatMoney, locale } = usePreferences();
  const qc = useQueryClient();
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [rateMode, setRateMode] = useState<"variable" | "stable">("variable");
  const [modal, setModal] = useState(false);
  const [repayId, setRepayId] = useState<string | null>(null);
  const [repayAmt, setRepayAmt] = useState("");

  const power = useQuery({
    queryKey: ["borrow", "power", token],
    enabled: !!token,
    queryFn: () => authFetch<{ data: Power }>("/api/borrow/power", token!).then((r) => r.data),
  });

  const rates = useQuery({
    queryKey: ["borrow", "rates", asset, token],
    enabled: !!token,
    queryFn: () =>
      authFetch<{ data: { variableApr: number; stableApr: number } }>(
        `/api/borrow/rates?asset=${encodeURIComponent(asset)}`,
        token!,
      ).then((r) => r.data),
  });

  const requests = useQuery({
    queryKey: ["borrow", "my-requests", token],
    enabled: !!token,
    queryFn: () =>
      authFetch<{ data: { id: string; asset: string; amount_usd: string; rate_mode: string; status: string; created_at: string }[] }>(
        "/api/borrow/my-requests",
        token!,
      ).then((r) => r.data),
  });

  const borrowMut = useMutation({
    mutationFn: async () => {
      if (!token) return;
      await authFetch("/api/borrow/request", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, amount: Number(amount), rateMode }),
      });
    },
    onSuccess: () => {
      showToast("Borrow request submitted — an operator will review it.");
      setModal(false);
      setAmount("");
      void qc.invalidateQueries({ queryKey: ["borrow"] });
      void qc.invalidateQueries({ queryKey: ["liquidity"] });
    },
    onError: (e: Error) => showToast(e.message),
  });

  const repayMut = useMutation({
    mutationFn: async () => {
      if (!token || !repayId) return;
      await authFetch("/api/borrow/repay", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: repayId, amount: Number(repayAmt) }),
      });
    },
    onSuccess: () => {
      showToast("Repayment applied");
      setRepayId(null);
      setRepayAmt("");
      void qc.invalidateQueries({ queryKey: ["borrow"] });
      void qc.invalidateQueries({ queryKey: ["liquidity"] });
    },
    onError: (e: Error) => showToast(e.message),
  });

  const p = power.data;

  const activePositions = useMemo(() => (p?.positions ?? []).filter((x) => x.status === "active"), [p?.positions]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="oove-page-title">Borrow</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Borrow stablecoins against supplied collateral. Rates are indicative APRs; interest accrues continuously between
          visits. Repay from the same asset wallet you received.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="oove-card-lg space-y-4">
          <h2 className="oove-section-title">Borrow form</h2>
          {power.isError ? <p className="text-sm text-red-600">{(power.error as Error).message}</p> : null}
          <div className="oove-stat-tile space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asset</p>
            <div className="flex flex-wrap gap-1">
              {ASSETS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAsset(a)}
                  className={
                    asset === a
                      ? "rounded-full bg-oove-blue px-3 py-1 text-xs font-semibold text-white"
                      : "rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="oove-stat-tile space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Amount (USD notional for stables)
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 tabular-nums dark:border-oove-border/50 dark:bg-oove-panel"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="oove-stat-tile">
              <p className="text-xs font-medium text-slate-500">Variable APR</p>
              <p className="mt-0.5 text-lg font-semibold">{rates.data?.variableApr?.toFixed(2) ?? "—"}%</p>
            </div>
            <div className="oove-stat-tile">
              <p className="text-xs font-medium text-slate-500">Stable APR</p>
              <p className="mt-0.5 text-lg font-semibold">{rates.data?.stableApr?.toFixed(2) ?? "—"}%</p>
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" checked={rateMode === "variable"} onChange={() => setRateMode("variable")} />
              Variable
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" checked={rateMode === "stable"} onChange={() => setRateMode("stable")} />
              Stable
            </label>
          </div>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="w-full rounded-xl bg-oove-blue py-3 font-semibold text-white hover:brightness-105"
          >
            Review borrow
          </button>
        </div>

        <div className="space-y-4">
          <div className="oove-card-lg space-y-3">
            <h2 className="oove-section-title">Collateral & power</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="oove-stat-tile">
                <dt className="text-xs font-medium text-slate-500">Pending requests</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatMoney(p?.pendingBorrowUsd ?? 0)}</dd>
              </div>
              <div className="oove-stat-tile">
                <dt className="text-xs font-medium text-slate-500">Available borrow</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatMoney(p?.availableBorrowUsd ?? 0)}</dd>
              </div>
              <div className="oove-stat-tile">
                <dt className="text-xs font-medium text-slate-500">Outstanding</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatMoney(p?.outstandingBorrowUsd ?? 0)}</dd>
              </div>
              <div className="oove-stat-tile">
                <dt className="text-xs font-medium text-slate-500">Max LTV</dt>
                <dd className="mt-0.5 text-lg font-semibold">{p?.maxLtvPct ?? "—"}%</dd>
              </div>
              <div className="oove-stat-tile col-span-2">
                <dt className="text-xs font-medium text-slate-500">Health factor</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">{p?.healthFactor ?? "—"}</dd>
              </div>
            </dl>
            <Link
              to="/deposit"
              className="inline-flex w-full justify-center rounded-full border border-slate-200 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Add more collateral
            </Link>
          </div>
          <div className="oove-card">
            <h3 className="oove-section-title">Supplied balances</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {(p?.collateral ?? []).length === 0 ? <li>No collateral yet.</li> : null}
              {(p?.collateral ?? []).map((c) => (
                <li key={c.asset} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-oove-card-muted/80">
                  <span className="font-semibold text-slate-900">{c.asset}</span>
                  <span className="font-mono text-xs">{c.balance}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="oove-card-lg">
        <h2 className="oove-section-title">Borrow requests</h2>
        <p className="mt-1 text-sm text-slate-500">Submitted amounts awaiting admin approval.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Amount USD</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {(requests.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{row.asset}</td>
                  <td className="px-3 py-2 tabular-nums">${row.amount_usd}</td>
                  <td className="px-3 py-2">{row.rate_mode}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(row.created_at).toLocaleString(locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(requests.data ?? []).length === 0 ? <p className="mt-2 text-sm text-slate-500">No requests yet.</p> : null}
        </div>
      </div>

      <div className="oove-card-lg">
        <h2 className="oove-section-title">Borrowing history</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Principal USD</th>
                <th className="px-3 py-2">Accrued int.</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Repay</th>
              </tr>
            </thead>
            <tbody>
              {activePositions.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{row.asset}</td>
                  <td className="px-3 py-2 tabular-nums">${row.principal_usd}</td>
                  <td className="px-3 py-2 tabular-nums">${row.interest_accrued_usd}</td>
                  <td className="px-3 py-2">{row.rate_mode}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="text-oove-blue hover:underline" onClick={() => setRepayId(row.id)}>
                      Repay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="oove-card-lg max-w-md space-y-4 shadow-xl">
            <h3 className="oove-section-title">Confirm borrow</h3>
            <p className="text-sm text-slate-600">
              Request <span className="font-semibold">{amount || "0"}</span> {asset} at{" "}
              <span className="font-semibold">{rateMode}</span> rate. Funds credit your wallet after an administrator approves the
              request (capacity and policy are checked at approval time).
            </p>
            <div className="flex gap-3">
              <button type="button" className="flex-1 rounded-xl border border-slate-200 py-2 font-semibold" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={borrowMut.isPending}
                className="flex-1 rounded-xl bg-oove-blue py-2 font-semibold text-white disabled:opacity-50"
                onClick={() => borrowMut.mutate()}
              >
                {borrowMut.isPending ? "…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {repayId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="oove-card-lg max-w-md space-y-4 shadow-xl">
            <h3 className="oove-section-title">Repay loan</h3>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-oove-border/50 dark:bg-oove-panel"
              placeholder="Amount (USD)"
              value={repayAmt}
              onChange={(e) => setRepayAmt(e.target.value)}
            />
            <div className="flex gap-3">
              <button type="button" className="flex-1 rounded-xl border border-slate-200 py-2 font-semibold" onClick={() => setRepayId(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={repayMut.isPending}
                className="flex-1 rounded-xl bg-oove-blue py-2 font-semibold text-white"
                onClick={() => repayMut.mutate()}
              >
                Pay
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
