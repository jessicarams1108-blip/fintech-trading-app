import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import {
  fetchAdminFixedSubscriptions,
  matureAdminSubscription,
  type FixedSubscription,
} from "@/lib/fixedSavingsApi";
import { formatRate, formatUsd } from "@/lib/fixedSavingsUtils";

export function AdminFixedSavingsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");

  const listQ = useQuery({
    queryKey: ["admin-fixed-savings", status, userId],
    queryFn: () =>
      fetchAdminFixedSubscriptions(token!, {
        status: status || undefined,
        userId: userId.trim() || undefined,
      }),
    enabled: Boolean(token),
  });

  const actionM = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "payout" | "renew" }) =>
      matureAdminSubscription(token!, id, action),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-fixed-savings"] });
      showToast("Subscription processed", "success");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Admin</p>
          <h1 className="text-2xl font-semibold text-slate-900">Fixed savings</h1>
        </div>
        <Link to="/admin/console" className="text-sm font-semibold text-oove-blue hover:underline">
          ← Console
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="matured">Matured</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="renewed">Renewed</option>
        </select>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Filter by user UUID"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      {listQ.isError ? <p className="text-sm text-red-600">{(listQ.error as Error).message}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(listQ.data ?? []).map((row: FixedSubscription) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-4 py-3 text-xs">{row.user_email ?? row.user_id.slice(0, 8)}</td>
                <td className="px-4 py-3">
                  {row.plan_name}
                  <span className="block text-xs text-slate-500">{formatRate(row.rate)}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">{formatUsd(Number.parseFloat(row.amount))}</td>
                <td className="px-4 py-3">{row.days}</td>
                <td className="px-4 py-3 capitalize">{row.status}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {row.start_date} → {row.end_date}
                </td>
                <td className="px-4 py-3">
                  {row.status === "active" ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actionM.isPending}
                        onClick={() => actionM.mutate({ id: row.id, action: "payout" })}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Payout
                      </button>
                      <button
                        type="button"
                        disabled={actionM.isPending}
                        onClick={() => actionM.mutate({ id: row.id, action: "renew" })}
                        className="rounded-full border border-violet-300 px-3 py-1 text-xs font-semibold text-violet-700"
                      >
                        Renew
                      </button>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(listQ.data ?? []).length === 0 && !listQ.isLoading ? (
          <p className="p-6 text-sm text-slate-500">No subscriptions match filters.</p>
        ) : null}
      </div>
    </div>
  );
}
