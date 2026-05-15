import { STATIC_USD } from "../lib/market.js";
const USD_PER_UNIT = STATIC_USD;
/** Minimum USD equivalent for any single accepted deposit (user declaration + admin credit). */
export const MIN_DEPOSIT_USD = 100;
export function assetAmountToUsd(asset, amount) {
    const px = USD_PER_UNIT[asset.toUpperCase()] ?? 0;
    const n = typeof amount === "number" ? amount : Number.parseFloat(String(amount));
    if (!Number.isFinite(n) || n <= 0)
        return 0;
    return Math.round(n * px * 100) / 100;
}
