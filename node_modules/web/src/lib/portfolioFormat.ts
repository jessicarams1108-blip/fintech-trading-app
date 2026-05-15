/**
 * Display rules for portfolio UI: headline totals like $100 (no trailing .00 when whole dollars),
 * and on-chain-style asset amounts like 0.0012569 BTC (trim trailing zeros, cap precision by asset class).
 */
export function formatPortfolioTotalUsd(usd: number): string {
  if (!Number.isFinite(usd)) return "$0";
  const abs = Math.abs(usd);
  if (abs >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(usd);
  }
  if (abs < 1e-12) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(usd);
}

const STABLE = new Set(["USDT", "USDC", "DAI", "BUSD", "TUSD", "USDP"]);

/** Format wallet quantity for display (e.g. BTC 0.0012569). */
export function formatAssetQuantity(symbol: string, quantity: string | number): string {
  const sym = symbol.trim().toUpperCase();
  const q = typeof quantity === "number" ? quantity : Number.parseFloat(String(quantity).trim());
  if (!Number.isFinite(q) || q === 0) return "0";
  const maxFrac = STABLE.has(sym) ? 6 : 8;
  let s = q.toFixed(maxFrac).replace(/\.?0+$/, "");
  if (s === "-0") return "0";
  return s;
}

/** Total USD value expressed in whole BTC units at the given BTC/USD spot (for dual fiat + BTC headline). */
export function formatBtcEquivalent(totalUsd: number, btcUsdSpot: number): string {
  if (!Number.isFinite(totalUsd) || totalUsd <= 0) return "≈ 0 BTC";
  if (!Number.isFinite(btcUsdSpot) || btcUsdSpot <= 0) return "—";
  const btc = totalUsd / btcUsdSpot;
  return `≈ ${formatAssetQuantity("BTC", btc)} BTC`;
}
