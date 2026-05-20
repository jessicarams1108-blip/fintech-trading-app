import type { PendingDepositDto } from "@/types";

/** Rough USD prices for admin credit suggestions (matches server fallbacks). */
const USD_PER_UNIT: Record<string, number> = {
  USDT: 1,
  USDC: 1,
  DAI: 1,
  USD: 1,
  BTC: 98_000,
  ETH: 3_200,
  SOL: 140,
};

/** Suggest credited quantity from declared USD on the deposit row. */
export function suggestDepositCreditAmount(row: PendingDepositDto): string {
  const declared = row.declaredAmountUsd != null ? Number.parseFloat(row.declaredAmountUsd) : NaN;
  if (!Number.isFinite(declared) || declared <= 0) return "";

  const px = USD_PER_UNIT[row.asset.toUpperCase()] ?? 0;
  if (px <= 0) return "";

  const qty = declared / px;
  const stable = new Set(["USDT", "USDC", "DAI", "USD"]);
  if (stable.has(row.asset.toUpperCase())) {
    return qty.toFixed(2);
  }
  const s = qty.toFixed(8);
  return s.replace(/\.?0+$/, "") || s;
}
