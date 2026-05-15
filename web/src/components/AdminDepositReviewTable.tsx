import { useCallback, useEffect, useMemo, useState } from "react";
import type { PendingDepositDto } from "@/types";
import { useAuth } from "@/state/AuthContext";

type Props = {
  refreshToken?: number;
  /** Called after a deposit confirm/reject succeeds (e.g. refresh other admin queues). */
  onQueuesChanged?: () => void;
};

export function AdminDepositReviewTable({ refreshToken = 0, onQueuesChanged }: Props) {
  const { token } = useAuth();
  const [rows, setRows] = useState<PendingDepositDto[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      return;
    }
    setLoadError(null);
    let res: Response;
    try {
      res = await fetch("/api/admin/deposits/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setRows([]);
      throw new Error("Cannot reach the server. Start the backend: npm run dev:server");
    }
    const payload = (await res.json().catch(() => ({}))) as { data?: PendingDepositDto[]; error?: string };
    if (!res.ok) {
      throw new Error(payload.error ?? "Unable to fetch pending deposits");
    }
    setRows(payload.data ?? []);
  }, [token]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      setLoadError(err instanceof Error ? err.message : "Unable to load pending deposits"),
    );
  }, [load, refreshToken]);

  const sorted = useMemo(() => [...rows].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [rows]);

  async function act(id: string, action: "confirm" | "reject") {
    if (!token) return;
    setBusyId(id);
    try {
      const endpoint =
        action === "confirm"
          ? `/api/admin/deposit/${id}/confirm`
          : `/api/admin/deposit/${id}/reject`;

      let body: Record<string, string>;
      if (action === "confirm") {
        const amount = window.prompt("Amount credited to the user ledger (decimals allowed)?")?.trim() ?? "";
        if (!amount) throw new Error("Amount is required to confirm deposits");
        body = { amount };
      } else {
        const reason =
          window.prompt("Rejection reason (required)?", "Mismatch on-chain evidence")?.trim() ?? "";
        if (!reason) throw new Error("Reason is required to reject deposits");
        body = { reason };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Action failed");
      }

      await load();
      onQueuesChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!token) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Sign in as the administrator to review deposits.</p>;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold">Pending deposits</h2>
          <p className="text-sm text-slate-500">
            Server enforces admins via bearer tokens + middleware. Always verify explorers before approving.
          </p>
          {loadError ? <p className="mt-2 text-xs text-red-600">{loadError}</p> : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Declared USD</th>
              <th className="px-4 py-3">Credited</th>
              <th className="px-4 py-3">Tx hash</th>
              <th className="px-4 py-3">Proof</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={8}>
                  No queued deposits 🎉
                </td>
              </tr>
            ) : null}
            {sorted.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3">{row.userEmail}</td>
                <td className="px-4 py-3 font-semibold">{row.asset}</td>
                <td className="px-4 py-3 tabular-nums">
                  {row.declaredAmountUsd != null
                    ? `$${Number.parseFloat(row.declaredAmountUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                    : "—"}
                </td>
                <td className="px-4 py-3">{row.amount ?? "— pending verify"}</td>
                <td className="px-4 py-3 font-mono text-xs break-all">{row.txHash}</td>
                <td className="px-4 py-3">
                  {row.proofImageUrl ? (
                    <a className="text-accent underline" href={row.proofImageUrl}>
                      View
                    </a>
                  ) : (
                    <span className="text-slate-400">None</span>
                  )}
                </td>
                <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      disabled={busyId === row.id}
                      onClick={() => act(row.id, "confirm")}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-500/15"
                      disabled={busyId === row.id}
                      onClick={() => act(row.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
