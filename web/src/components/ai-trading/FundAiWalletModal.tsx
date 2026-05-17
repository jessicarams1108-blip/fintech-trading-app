import { useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/state/AuthContext";
import { fetchCashBoxBalance } from "@/lib/fixedSavingsApi";
import { depositToAiWallet } from "@/lib/aiTradingApi";

type Props = {
  open: boolean;
  onClose: () => void;
  minAmount: number;
  onFunded: () => void;
};

export function FundAiWalletModal({ open, onClose, minAmount, onFunded }: Props) {
  const { token } = useAuth();
  const [mode, setMode] = useState<"choose" | "cashbox">("choose");
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

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-[#1C1C1E] p-4 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Fund AI wallet</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#8E8E93]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {mode === "choose" ? (
          <div className="space-y-3">
            <p className="text-sm text-[#8E8E93]">Choose how to add buying power for AI trading.</p>
            <button
              type="button"
              onClick={() => setMode("cashbox")}
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-4 text-left hover:border-oove-blue"
            >
              <p className="font-semibold text-white">Use asset balance</p>
              <p className="mt-1 text-xs text-[#8E8E93]">
                Transfer from CashBox · available ${cashBoxUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </button>
            <Link
              to="/deposit"
              onClick={onClose}
              className="block w-full rounded-xl border border-white/10 bg-black px-4 py-4 text-left hover:border-oove-blue"
            >
              <p className="font-semibold text-white">Add new deposit</p>
              <p className="mt-1 text-xs text-[#8E8E93]">Submit a deposit proof to fund your CashBox first</p>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <button type="button" className="text-xs text-oove-blue" onClick={() => setMode("choose")}>
              ← Back
            </button>
            <p className="text-xs text-[#8E8E93]">CashBox available: ${cashBoxUsd.toLocaleString()}</p>
            <input
              type="number"
              min={minAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount (min $${minAmount})`}
              className="w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm outline-none focus:border-oove-blue"
            />
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => void transferFromCashBox()}
              className="w-full rounded-xl bg-oove-blue py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Transferring…" : "Transfer to AI wallet"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
