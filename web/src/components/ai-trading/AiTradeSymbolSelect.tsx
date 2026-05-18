import clsx from "clsx";
import { ai } from "@/lib/aiTradingTheme";
import {
  AI_ASSET_CLASSES,
  defaultSymbolForAssetClass,
  resolveSymbolForAssetClass,
  symbolsForAssetClass,
} from "@/lib/aiTradeSymbols";

type Props = {
  assetClass: string;
  symbol: string;
  onAssetClassChange: (assetClass: string) => void;
  onSymbolChange: (symbol: string) => void;
  assetTypeLabel?: string;
  symbolLabel?: string;
  symbolSelectId?: string;
};

export function AiTradeSymbolSelect({
  assetClass,
  symbol,
  onAssetClassChange,
  onSymbolChange,
  assetTypeLabel = "Asset type",
  symbolLabel = "Symbol",
  symbolSelectId = "ai-trade-symbol",
}: Props) {
  const options = symbolsForAssetClass(assetClass);

  function pickAssetClass(nextClass: string) {
    onAssetClassChange(nextClass);
    onSymbolChange(defaultSymbolForAssetClass(nextClass));
  }

  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">{assetTypeLabel}</label>
        <div className="flex gap-2">
          {AI_ASSET_CLASSES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickAssetClass(c.id)}
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
        <label htmlFor={symbolSelectId} className="mb-1 block text-xs font-medium text-slate-500">
          {symbolLabel}
        </label>
        <select
          id={symbolSelectId}
          value={resolveSymbolForAssetClass(assetClass, symbol)}
          onChange={(e) => onSymbolChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-oove-blue"
        >
          {options.map((o) => (
            <option key={o.symbol} value={o.symbol}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
