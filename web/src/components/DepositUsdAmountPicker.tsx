const PRESETS = [100, 250, 500, 1000, 2500] as const;

type Props = {
  minUsd: number;
  value: string;
  onChange: (next: string) => void;
  /** Asset whose USD spot price is used for crypto estimate */
  assetSymbol: string;
  /** USD price for one unit of asset (from API); null while loading or on error */
  spotUsdPerUnit: number | null;
  /** When true, spot failed to load */
  spotError?: boolean;
};

export function DepositUsdAmountPicker({
  minUsd,
  value,
  onChange,
  assetSymbol,
  spotUsdPerUnit,
  spotError,
}: Props) {
  const amountNum = Number.parseFloat(value);
  const ok = Number.isFinite(amountNum) && amountNum >= minUsd;
  const estQty =
    ok && spotUsdPerUnit != null && spotUsdPerUnit > 0 ? amountNum / spotUsdPerUnit : null;

  function fmtQty(q: number): string {
    if (!Number.isFinite(q)) return "—";
    if (assetSymbol === "BTC" || assetSymbol === "ETH") return q.toFixed(8).replace(/\.?0+$/, "") || "0";
    if (q >= 1) return q.toFixed(6).replace(/\.?0+$/, "") || "0";
    return q.toFixed(8).replace(/\.?0+$/, "") || "0";
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-inner">
      <label className="text-sm font-medium text-slate-800">Amount to deposit (USD equivalent)</label>
      <p className="mt-1 text-xs text-slate-500">
        Choose how much you intend to send (minimum ${minUsd.toLocaleString("en-US")}). You’ll declare the same amount when you submit proof.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              value === String(p)
                ? "bg-oove-blue text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={() => onChange(String(p))}
          >
            ${p.toLocaleString("en-US")}
          </button>
        ))}
      </div>
      <input
        type="number"
        min={minUsd}
        step="0.01"
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm tabular-nums text-slate-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-2 text-sm text-slate-700">
        ≈{" "}
        <span className="font-mono font-semibold tabular-nums text-slate-900">
          {estQty == null ? "—" : fmtQty(estQty)}
        </span>{" "}
        <span className="font-semibold">{assetSymbol}</span>
        {spotError ? (
          <span className="text-xs text-amber-700"> (could not load live rate — estimate unavailable)</span>
        ) : spotUsdPerUnit == null ? (
          <span className="text-xs text-slate-500"> (loading spot…)</span>
        ) : (
          <span className="text-xs text-slate-500">
            {" "}
            @ {fmtUsd(spotUsdPerUnit)}/{assetSymbol}
          </span>
        )}
      </p>
    </div>
  );
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 6 : 2 });
}
