import { useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/state/AuthContext";
import { fetchCashBoxBalance } from "@/lib/fixedSavingsApi";
import { depositToAiWallet, withdrawFromAiWallet } from "@/lib/aiTradingApi";
import { ai } from "@/lib/aiTradingTheme";

type Props = {
  open: boolean;
  onClose: () => void;
  minAmount: number;
  aiBalanceUsd: number;
  onFunded: () => void;
};

export function FundAiWalletModal({ open, onClose, minAmount, aiBalanceUsd, onFunded }: Props) {
  const { token } = useAuth();
  const [mode, setMode] = useState<"choose" | "cashbox-deposit" | "cashbox-withdraw">("choose");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashboxQ = useQuery({
    queryKey: ["cashbox-balance", token],
    enabled: open && !!token,
    queryFn: () => fetchCashBoxBalance(token!),
  });

  if (!open) return null;

  const cashBoxUsd = cashboxQ.data?.cashBoxUsd ?? 0;

  async function transferFromCashBox() {
    setError(null);
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n < minAmount) {
      setError(`Minimum is $${minAmount}`);
      return;
    }
    if (n > cashBoxUsd) {
      setError("Amount exceeds your CashBox balance");
      return;
    }
    setLoading(true);
    try {
      await depositToAiWallet(token!, n);
      onFunded();
      onClose();
      setMode("choose");
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  async function transferToCashBox() {
    setError(null);
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n < minAmount) {
      setError(`Minimum is $${minAmount}`);
      return;
    }
    if (n > aiBalanceUsd) {
      setError("Amount exceeds your AI wallet balance");
      return;
    }
    setLoading(true);
    try {
      await withdrawFromAiWallet(token!, n);
      onFunded();
      onClose();
      setMode("choose");
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI wallet · CashBox</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mode === "choose" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Move funds between your CashBox balance and AI trading wallet.</p>
            <button
              type="button"
              onClick={() => setMode("cashbox-deposit")}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:border-oove-blue"
            >
              <p className="font-semibold text-slate-900">Fund from CashBox</p>
              <p className="mt-1 text-xs text-slate-500">
                CashBox available ${cashBoxUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("cashbox-withdraw")}
              disabled={aiBalanceUsd < minAmount}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:border-oove-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              <p className="font-semibold text-slate-900">Withdraw to CashBox</p>
              <p className="mt-1 text-xs text-slate-500">
                AI wallet ${aiBalanceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} available
              </p>
            </button>
            <Link
              to="/deposit"
              onClick={onClose}
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:border-oove-blue"
            >
              <p className="font-semibold text-slate-900">Add new deposit</p>
              <p className="mt-1 text-xs text-slate-500">Submit a deposit proof to fund your CashBox first</p>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <button type="button" className="text-xs text-oove-blue" onClick={() => setMode("choose")}>
              ← Back
            </button>
            {mode === "cashbox-deposit" ? (
              <p className="text-xs text-slate-500">CashBox available: ${cashBoxUsd.toLocaleString()}</p>
            ) : (
              <p className="text-xs text-slate-500">AI wallet available: ${aiBalanceUsd.toLocaleString()}</p>
            )}
            <input
              type="number"
              min={minAmount}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount USD (min $${minAmount})`}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-oove-blue"
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => void (mode === "cashbox-deposit" ? transferFromCashBox() : transferToCashBox())}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: ai.blue }}
            >
              {loading
                ? "Transferring…"
                : mode === "cashbox-deposit"
                  ? "Transfer to AI wallet"
                  : "Withdraw to CashBox"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

