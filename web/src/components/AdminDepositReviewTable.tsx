import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { PendingDepositDto } from "@/types";
import { apiFetch } from "@/lib/apiBase";
import { parseApiError } from "@/lib/apiError";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import { suggestDepositCreditAmount } from "@/lib/suggestDepositCreditAmount";

type Props = {
  refreshToken?: number;
  onQueuesChanged?: () => void;
};

export function AdminDepositReviewTable({ refreshToken = 0, onQueuesChanged }: Props) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<PendingDepositDto[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofBusyId, setProofBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      return;
    }
    setLoadError(null);
    let res: Response;
    try {
      res = await apiFetch("/api/admin/deposits/pending", {
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

  function openConfirmPanel(row: PendingDepositDto) {
    setConfirmingId(row.id);
    setConfirmAmount(suggestDepositCreditAmount(row));
    showToast("Enter the amount to credit below, then click Confirm & credit.");
  }

  async function openProof(depositId: string) {
    if (!token) return;
    setProofBusyId(depositId);
    try {
      const res = await apiFetch(`/api/admin/deposit/${depositId}/proof-file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(parseApiError(body, "Could not load proof file", res.status));
      }
      const blob = await res.blob();
      if (!blob.size) throw new Error("Proof file is empty");
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not open proof");
    } finally {
      setProofBusyId(null);
    }
  }

  async function submitConfirm(row: PendingDepositDto) {
    if (!token) return;
    const amount = confirmAmount.trim();
    if (!amount) {
      showToast("Enter an amount to credit.");
      return;
    }

    setBusyId(row.id);
    try {
      const res = await apiFetch(`/api/admin/deposit/${row.id}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(parseApiError(payload, "Confirm failed", res.status));
      }
      setConfirmingId(null);
      setConfirmAmount("");
      showToast(`Deposit confirmed — ${row.asset} credited. User gets email if Resend is configured.`);
      await load();
      onQueuesChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setBusyId(null);
    }
  }

  async function actReject(id: string) {
    if (!token) return;
    const reason =
      window.prompt("Rejection reason (required)?", "Mismatch on-chain evidence")?.trim() ?? "";
    if (!reason) {
      showToast("Rejection cancelled.");
      return;
    }
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/admin/deposit/${id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(parseApiError(payload, "Reject failed", res.status));
      }
      if (confirmingId === id) {
        setConfirmingId(null);
        setConfirmAmount("");
      }
      showToast("Deposit rejected.");
      await load();
      onQueuesChanged?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Reject failed");
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
            Click Confirm — a credit form opens in the row. Balance updates and email sends on success.
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
                  No queued deposits
                </td>
              </tr>
            ) : null}
            {sorted.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-t border-slate-100 dark:border-slate-800">
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
                      <button
                        type="button"
                        className="font-semibold text-oove-blue underline hover:brightness-110 disabled:opacity-50"
                        disabled={proofBusyId === row.id}
                        onClick={() => void openProof(row.id)}
                      >
                        {proofBusyId === row.id ? "Opening…" : "View proof"}
                      </button>
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
                        onClick={() => openConfirmPanel(row)}
                      >
                        {confirmingId === row.id ? "Confirming…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-500/15"
                        disabled={busyId === row.id}
                        onClick={() => void actReject(row.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
                {confirmingId === row.id ? (
                  <tr className="border-t border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <td colSpan={8} className="px-4 py-4">
                      <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                        Credit {row.userEmail} — {row.asset}
                      </p>
                      <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                        Declared ${row.declaredAmountUsd ?? "?"}. For USDT use the same number. For BTC/ETH/SOL use coin
                        amount (suggested below).
                      </p>
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <label className="block min-w-[12rem] flex-1">
                          <span className="text-xs font-medium text-slate-600">Amount ({row.asset})</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={confirmAmount}
                            onChange={(e) => setConfirmAmount(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-800"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busyId === row.id || !confirmAmount.trim()}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          onClick={() => void submitConfirm(row)}
                        >
                          {busyId === row.id ? "Saving…" : "Confirm & credit"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                          onClick={() => {
                            setConfirmingId(null);
                            setConfirmAmount("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
