import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DepositActivityDto } from "@/types";

function statusLabel(s: DepositActivityDto["status"]): string {
  if (s === "pending_review") return "Pending review";
  if (s === "confirmed") return "Confirmed";
  return "Rejected";
}

function statusClass(s: DepositActivityDto["status"]): string {
  if (s === "confirmed") return "text-emerald-700";
  if (s === "rejected") return "text-red-700";
  return "text-amber-800";
}

export function useDepositActivity(token: string | null, limit: number, reloadToken = 0) {
  const [rows, setRows] = useState<DepositActivityDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deposit/my-activity?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as {
        data?: DepositActivityDto[];
        error?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "Could not load activity");
        setRows([]);
        return;
      }
      setRows(data?.data ?? []);
    } catch {
      setError("Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, limit]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const hasPending = rows.some((r) => r.status === "pending_review");
  useEffect(() => {
    if (!hasPending || !token) return;
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [hasPending, token, load]);

  return { rows, loading, error, reload: load };
}

export function DepositActivityList({ rows }: { rows: DepositActivityDto[] }) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">No deposits yet. Start from Supply to fund your account.</p>;
  }
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2.5 text-sm text-slate-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{r.asset}</span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${statusClass(r.status)}`}>
              {statusLabel(r.status)}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500 break-all">{r.txHash}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {r.declaredAmountUsd != null ? (
              <span>
                Declared:{" "}
                <span className="font-medium tabular-nums">
                  ${Number.parseFloat(r.declaredAmountUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>{" "}
                USD
              </span>
            ) : null}
            {r.creditedAmount != null ? (
              <span>
                Credited:{" "}
                <span className="font-medium tabular-nums">
                  {Number.parseFloat(r.creditedAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </span>{" "}
                {r.asset}
              </span>
            ) : null}
            <span className="text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

type PanelProps = {
  token: string | null;
  /** Max rows to fetch from API */
  limit?: number;
  /** If set, only show this many rows (rest still loaded for “pending” checks on parent) */
  maxDisplay?: number;
  title?: string;
  showViewAll?: boolean;
  /** Called when rows change (e.g. dashboard “next steps”) */
  onRowsChange?: (rows: DepositActivityDto[]) => void;
  /** Increment to force an immediate refetch (e.g. after submitting a new deposit). */
  reloadToken?: number;
};

export function DepositActivityPanel({
  token,
  limit = 50,
  maxDisplay,
  title = "Deposit activity",
  showViewAll,
  onRowsChange,
  reloadToken = 0,
}: PanelProps) {
  const { rows, loading, error } = useDepositActivity(token, limit, reloadToken);
  const shown = maxDisplay != null ? rows.slice(0, maxDisplay) : rows;

  useEffect(() => {
    onRowsChange?.(rows);
  }, [rows, onRowsChange]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {showViewAll ? (
          <Link to="/history" className="text-sm font-semibold text-oove-blue hover:underline">
            View all
          </Link>
        ) : null}
      </div>
      {!token ? (
        <p className="mt-4 text-sm text-slate-500">Sign in to see your deposit submissions.</p>
      ) : loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : (
        <DepositActivityList rows={shown} />
      )}
    </div>
  );
}
