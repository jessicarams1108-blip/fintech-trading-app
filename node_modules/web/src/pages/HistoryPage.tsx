import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { DepositActivityPanel } from "@/components/DepositActivity";

type Row = {
  id: string;
  at: string;
  type: string;
  asset: string | null;
  amount: string | null;
  direction: string | null;
  status: string;
  detail: string | null;
};

const HISTORY_TYPES = ["all", "deposit", "withdrawal", "borrow", "borrow_request", "transfer", "ledger"] as const;

async function authFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

export function HistoryPage() {
  const { token } = useAuth();
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [depositActivityBump, setDepositActivityBump] = useState(0);

  useEffect(() => {
    const fn = () => setDepositActivityBump((n) => n + 1);
    window.addEventListener("oove:deposits-activity-refresh", fn);
    return () => window.removeEventListener("oove:deposits-activity-refresh", fn);
  }, []);

  const q = useQuery({
    queryKey: ["history", token, type, page],
    enabled: !!token,
    queryFn: () =>
      authFetch<{ data: { rows: Row[]; page: number; pageSize: number } }>(
        `/api/history?type=${encodeURIComponent(type)}&page=${page}&pageSize=30`,
        token!,
      ).then((r) => r.data),
  });

  const csv = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const header = ["Date", "Type", "Asset", "Amount", "Direction", "Status", "Detail"];
    const lines = [header.join(",")].concat(
      rows.map((r) =>
        [
          r.at,
          r.type,
          r.asset ?? "",
          r.amount ?? "",
          r.direction ?? "",
          r.status,
          (r.detail ?? "").replace(/,/g, ";"),
        ].join(","),
      ),
    );
    return lines.join("\n");
  }, [q.data?.rows]);

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oove-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">History</h1>
          <p className="mt-2 text-slate-600">
            Unified ledger, deposits, withdrawals, borrows, borrow requests, internal transfers, and other entries.
          </p>
        </div>
        <button type="button" onClick={downloadCsv} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {HISTORY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              setPage(1);
            }}
            className={
              type === t
                ? "rounded-full bg-oove-blue px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            }
          >
            {t === "borrow_request" ? "borrow req." : t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : null}
            {(q.data?.rows ?? []).map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-600">{new Date(r.at).toLocaleString()}</td>
                <td className="px-4 py-2 font-medium">{r.type}</td>
                <td className="px-4 py-2">{r.asset ?? "—"}</td>
                <td className="px-4 py-2 tabular-nums">{r.amount ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{r.direction ?? "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      r.status === "confirmed" || r.status === "completed" || r.status === "approved"
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                        : r.status === "pending_admin" || r.status === "pending_review"
                          ? "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="max-w-xs truncate px-4 py-2 text-xs text-slate-500">{r.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={page <= 1}
          className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>

      <DepositActivityPanel
        token={token}
        limit={8}
        maxDisplay={5}
        title="Recent deposits (detail)"
        reloadToken={depositActivityBump}
      />

      <p className="text-sm text-slate-500">
        Need funding proofs? Use <Link className="text-oove-blue underline" to="/deposit">Supply</Link>.
      </p>
    </div>
  );
}
