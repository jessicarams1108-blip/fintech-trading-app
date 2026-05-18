import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ai } from "@/lib/aiTradingTheme";
import { AiTradeSymbolSelect } from "@/components/ai-trading/AiTradeSymbolSelect";
import { resolveAssetClassAndSymbol } from "@/lib/aiTradeSymbols";

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
  const initial = resolveAssetClassAndSymbol(defaultClass, defaultAsset);
  const [assetClass, setAssetClass] = useState<string>(initial.assetClass);
  const [asset, setAsset] = useState(initial.symbol);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = resolveAssetClassAndSymbol(defaultClass, defaultAsset);
    setAssetClass(next.assetClass);
    setAsset(next.symbol);
    setAmount("");
    setError(null);
  }, [open, defaultAsset, defaultClass]);

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
      const resolved = resolveAssetClassAndSymbol(assetClass, asset);
      await onSubmit({ asset: resolved.symbol, amount: num, asset_class: resolved.assetClass });
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
          <AiTradeSymbolSelect
            assetClass={assetClass}
            symbol={asset}
            onAssetClassChange={setAssetClass}
            onSymbolChange={setAsset}
            symbolSelectId="ai-start-trade-symbol"
          />

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
