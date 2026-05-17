import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import clsx from "clsx";
import { useAuth } from "@/state/AuthContext";
import { adminListAiTrades, adminSetAiResult, formatTradeResult, type AiTrade } from "@/lib/aiTradingApi";

function ResultModal({
  trade,
  mode,
  onClose,
  onConfirm,
}: {
  trade: AiTrade;
  mode: "profit" | "loss";
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Mark {mode === "profit" ? "Profit" : "Loss"} — {trade.asset}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Principal ${trade.amount.toLocaleString()} · {trade.user_email}
        </p>
        <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {mode === "profit" ? "Profit amount (credited on top of principal)" : "Loss amount (for display)"}
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const n = Number.parseFloat(amount);
              if (Number.isFinite(n) && n >= 0) onConfirm(n);
            }}
            className={clsx(
              "flex-1 rounded-lg py-2 text-sm font-semibold text-white",
              mode === "profit" ? "bg-emerald-600" : "bg-red-600",
            )}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminAiTradingPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"running" | "completed">("running");
  const [modal, setModal] = useState<{ trade: AiTrade; mode: "profit" | "loss" } | null>(null);

  const q = useQuery({
    queryKey: ["admin-ai-trades", token, tab],
    enabled: !!token,
    queryFn: () => adminListAiTrades(token!, tab),
    refetchInterval: 15_000,
  });

  const setMut = useMutation({
    mutationFn: (payload: { trade_id: string; result_type: "profit" | "loss"; profit_loss_amount: number }) =>
      adminSetAiResult(token!, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-ai-trades"] });
      setModal(null);
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">AI Agent Trading</h1>
        <p className="mt-1 text-sm text-slate-500">
          Set profit or loss on running trades. Profit returns principal + profit to the user&apos;s AI wallet.
        </p>
      </div>

      <div className="flex gap-2">
        {(["running", "completed"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-full px-4 py-1.5 text-sm font-semibold capitalize",
              tab === t ? "bg-oove-blue text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          No {tab} trades
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((t) => (
                <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800/80">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.user_email ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{t.asset}</td>
                  <td className="px-4 py-3">${t.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(t.start_time).toLocaleString()}</td>
                  <td className="px-4 py-3">{formatTradeResult(t)}</td>
                  <td className="px-4 py-3">
                    {t.status === "running" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setModal({ trade: t, mode: "profit" })}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Mark profit
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal({ trade: t, mode: "loss" })}
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Mark loss
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {setMut.isError ? <p className="text-sm text-red-600">{(setMut.error as Error).message}</p> : null}

      {modal ? (
        <ResultModal
          trade={modal.trade}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onConfirm={(amount) =>
            setMut.mutate({
              trade_id: modal.trade.id,
              result_type: modal.mode,
              profit_loss_amount: amount,
            })
          }
        />
      ) : null}
    </div>
  );
}
