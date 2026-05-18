import { useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { ai } from "@/lib/aiTradingTheme";

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
  maxAmount: number;
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
  maxAmount,
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
    if (num > maxAmount) {
      setError(`Maximum trade is $${maxAmount.toLocaleString()}`);
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
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Start AI trade</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Asset type</label>
            <div className="flex gap-2">
              {ASSET_CLASSES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAssetClass(c.id)}
                  className={clsx(
                    "flex-1 rounded-xl py-2 text-sm font-semibold",
                    assetClass === c.id ? "text-white" : "bg-slate-100 text-slate-600",
                  )}
                  style={assetClass === c.id ? { backgroundColor: ai.blue } : undefined}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Symbol</label>
            <input
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-oove-blue"
              placeholder="e.g. BTC, AAPL, EUR/USD"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Amount (${minAmount.toLocaleString()} – ${maxAmount.toLocaleString()} USD)
            </label>
            <input
              type="number"
              min={minAmount}
              max={Math.min(balance, maxAmount)}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-oove-blue"
              placeholder={`$${minAmount.toLocaleString()} – $${maxAmount.toLocaleString()}`}
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Buying power: ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || !canTrade}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: ai.blue }}
          >
            {loading ? "AI Agent is analyzing market…" : "Start AI trading"}
          </button>
        </form>
      </div>
    </div>
  );
}

