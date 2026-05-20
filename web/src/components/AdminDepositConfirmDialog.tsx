import { useEffect, useState } from "react";
import type { PendingDepositDto } from "@/types";
import { suggestDepositCreditAmount } from "@/lib/suggestDepositCreditAmount";

type Props = {
  row: PendingDepositDto | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (amount: string) => void;
};

export function AdminDepositConfirmDialog({ row, busy, onClose, onConfirm }: Props) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (row) setAmount(suggestDepositCreditAmount(row));
    else setAmount("");
  }, [row]);

  if (!row) return null;

  const declared =
    row.declaredAmountUsd != null
      ? `$${Number.parseFloat(row.declaredAmountUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-labelledby="confirm-deposit-title"
      >
        <h2 id="confirm-deposit-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Confirm deposit
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Credit <span className="font-semibold">{row.userEmail}</span> for{" "}
          <span className="font-semibold">{row.asset}</span>. Declared: {declared} USD.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-800 dark:text-slate-200">
          Amount to credit ({row.asset})
        </label>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          disabled={busy}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-800"
          placeholder="e.g. 500 for USDT, or BTC quantity"
        />
        <p className="mt-2 text-xs text-slate-500">
          Must be at least $100 USD equivalent. User wallet balance updates and a confirmation email is sent.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !amount.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            onClick={() => onConfirm(amount.trim())}
          >
            {busy ? "Confirming…" : "Confirm & credit"}
          </button>
        </div>
      </div>
    </div>
  );
}
