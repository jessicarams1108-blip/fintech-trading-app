import { useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

const ASSET_CLASSES = [
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "stocks", label: "Stocks" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  balance: number;
  minAmount: number;
  canTrade: boolean;
  defaultAsset?: string;
  defaultClass?: string;
  onSubmit: (payload: { asset: string; amount: number; asset_class: string }) => Promise<void>;
};

export function StartTradeModal({
  open,
  onClose,
  balance,
  minAmount,
  canTrade,
  defaultAsset = "BTC",
  defaultClass = "crypto",
  onSubmit,
}: Props) {
  const [assetClass, setAssetClass] = useState(defaultClass);
  const [asset, setAsset] = useState(defaultAsset);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = Number.parseFloat(amount);
    if (!Number.isFinite(num) || num < minAmount) {
      setError(`Minimum trade is $${minAmount.toLocaleString()}`);
      return;
    }
    if (num > balance) {
      setError("Amount exceeds AI trading balance");
      return;
    }
    if (!canTrade) {
      setError("Weekly trade limit reached");
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ asset: asset.trim().toUpperCase(), amount: num, asset_class: assetClass });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start trade");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-[#1A1A1A] p-4 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Start AI trade</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#9CA3AF] hover:bg-white/10" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#9CA3AF]">Asset type</label>
            <div className="flex gap-2">
              {ASSET_CLASSES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAssetClass(c.id)}
                  className={clsx(
                    "flex-1 rounded-xl py-2 text-sm font-semibold",
                    assetClass === c.id ? "bg-white text-black" : "bg-[#0D0D0D] text-[#9CA3AF]",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#9CA3AF]">Symbol</label>
            <input
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-3 py-2.5 text-sm outline-none focus:border-white/30"
              placeholder="e.g. BTC, AAPL, EUR/USD"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#9CA3AF]">
              Amount (max ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })})
            </label>
            <input
              type="number"
              min={minAmount}
              max={balance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-3 py-2.5 text-sm outline-none focus:border-white/30"
              placeholder={`Min $${minAmount}`}
            />
          </div>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || !canTrade}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            {loading ? "AI Agent is analyzing market…" : "Start AI trading"}
          </button>
        </form>
      </div>
    </div>
  );
}
