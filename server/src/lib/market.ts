/** USD reference prices (fallback). Merged with live CoinGecko when fetch succeeds. */
export const STATIC_USD: Record<string, number> = {
  USD: 1,
  USDT: 1,
  USDC: 1,
  DAI: 1,
  BTC: 98_000,
  ETH: 3200,
  SOL: 140,
  ADA: 0.45,
  BNB: 620,
  XRP: 0.52,
  DOGE: 0.16,
  AVAX: 36,
  DOT: 7.2,
  MATIC: 0.42,
};

/** CoinGecko `/coins/{id}` id per symbol — shared with extended market overview. */
export const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
  DAI: "dai",
  SOL: "solana",
  ADA: "cardano",
  BNB: "binancecoin",
  XRP: "ripple",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
};

let cache: { at: number; prices: Record<string, number> } | null = null;
const CACHE_MS = 45_000;

export async function getUsdPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return { ...STATIC_USD, ...cache.prices };
  }

  const ids = [...new Set(Object.values(COINGECKO_IDS))].join(",");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as Record<string, { usd?: number }>;
    const live: Record<string, number> = {};
    for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
      const px = body[id]?.usd;
      if (typeof px === "number" && Number.isFinite(px)) {
        live[sym] = Math.round(px * 10_000) / 10_000;
      }
    }
    cache = { at: now, prices: live };
    return { ...STATIC_USD, ...live };
  } catch {
    return { ...STATIC_USD };
  }
}

export function borrowAprFor(asset: string): { variable: number; stable: number } {
  const a = asset.toUpperCase();
  const table: Record<string, { variable: number; stable: number }> = {
    USDC: { variable: 5.15, stable: 6.1 },
    USDT: { variable: 5.05, stable: 6.0 },
    DAI: { variable: 5.35, stable: 6.25 },
    ETH: { variable: 3.4, stable: 4.2 },
    BTC: { variable: 2.9, stable: 3.6 },
  };
  return table[a] ?? { variable: 4.5, stable: 5.5 };
}
