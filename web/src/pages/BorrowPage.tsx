import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";

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
  const res = await fetch(path, {
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
        <h1 className="text-3xl font-semibold text-slate-900">Borrow</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Borrow stablecoins against supplied collateral. Rates are demo APRs; interest accrues continuously between
          visits. Repay from the same asset wallet you received.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Borrow form</h2>
          {power.isError ? <p className="text-sm text-red-600">{(power.error as Error).message}</p> : null}
          <label className="text-sm font-medium text-slate-700">Asset</label>
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2" value={asset} onChange={(e) => setAsset(e.target.value)}>
            {ASSETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <label className="text-sm font-medium text-slate-700">Amount (USD notional for stables)</label>
          <input className="w-full rounded-xl border px-3 py-2 tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Variable APR</p>
              <p className="text-lg font-semibold">{rates.data?.variableApr?.toFixed(2) ?? "—"}%</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs uppercase text-slate-500">Stable APR</p>
              <p className="text-lg font-semibold">{rates.data?.stableApr?.toFixed(2) ?? "—"}%</p>
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={rateMode === "variable"} onChange={() => setRateMode("variable")} />
              Variable
            </label>
            <label className="flex items-center gap-2 text-sm">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Collateral & power</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Pending requests</p>
                <p className="text-lg font-semibold tabular-nums">
                  {(p?.pendingBorrowUsd ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Available borrow</p>
                <p className="text-lg font-semibold tabular-nums">
                  {(p?.availableBorrowUsd ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Outstanding</p>
                <p className="text-lg font-semibold tabular-nums">
                  {(p?.outstandingBorrowUsd ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Max LTV (demo)</p>
                <p className="text-lg font-semibold">{p?.maxLtvPct ?? "—"}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Health factor</p>
                <p className="text-lg font-semibold tabular-nums">{p?.healthFactor ?? "—"}</p>
              </div>
            </div>
            <Link to="/deposit" className="inline-flex w-full justify-center rounded-full border border-slate-200 py-2 text-sm font-semibold hover:bg-slate-50">
              Add more collateral
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900">Supplied balances</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {(p?.collateral ?? []).length === 0 ? <li>No collateral yet.</li> : null}
              {(p?.collateral ?? []).map((c) => (
                <li key={c.asset} className="flex justify-between">
                  <span>{c.asset}</span>
                  <span className="font-mono text-xs">{c.balance}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Borrow requests</h2>
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
                  <td className="px-3 py-2 text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(requests.data ?? []).length === 0 ? <p className="mt-2 text-sm text-slate-500">No requests yet.</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Borrowing history</h2>
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
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold">Confirm borrow</h3>
            <p className="text-sm text-slate-600">
              Request <span className="font-semibold">{amount || "0"}</span> {asset} at{" "}
              <span className="font-semibold">{rateMode}</span> rate. Funds credit your wallet after an administrator approves the
              request (capacity and policy are checked at approval time).
            </p>
            <div className="flex gap-3">
              <button type="button" className="flex-1 rounded-xl border py-2 font-semibold" onClick={() => setModal(false)}>
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
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold">Repay loan</h3>
            <input className="w-full rounded-xl border px-3 py-2" placeholder="Amount (USD)" value={repayAmt} onChange={(e) => setRepayAmt(e.target.value)} />
            <div className="flex gap-3">
              <button type="button" className="flex-1 rounded-xl border py-2 font-semibold" onClick={() => setRepayId(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={repayMut.isPending}
                className="flex-1 rounded-xl bg-slate-900 py-2 font-semibold text-white"
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
