import { env } from "../env.js";
import { COINGECKO_IDS } from "./market.js";

export const ASSET_OVERVIEW_RANGES = ["1d", "7d", "30d", "90d", "365d", "max"] as const;
export type AssetOverviewRange = (typeof ASSET_OVERVIEW_RANGES)[number];

export type AssetMarketOverview = {
  symbol: string;
  name: string;
  priceUsd: number;
  percentChange24h: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  circulatingSupply: number | null;
  lastUpdated: string;
  /** Where headline stats came from for this response */
  statsSource: "coinmarketcap" | "coingecko";
  /** Spot series — always CoinGecko `market_chart` today */
  chartSource: "coingecko";
  history: { time: number; price: number }[];
};

const ALLOWED_SYMBOLS = new Set(Object.keys(COINGECKO_IDS));

let cmcMultiCache: { at: number; key: string; data: Record<string, CmcUsdQuote> } | null = null;
const CMC_CACHE_MS = 55_000;

type CmcUsdQuote = {
  price: number;
  volume_24h: number;
  market_cap: number;
  percent_change_24h: number;
  last_updated: string;
};

async function fetchCmcQuotesLatest(symbols: string[]): Promise<Record<string, CmcUsdQuote> | null> {
  const apiKey = env.COINMARKETCAP_API_KEY;
  if (!apiKey || symbols.length === 0) return null;

  const symParam = [...new Set(symbols.map((s) => s.toUpperCase()))].sort().join(",");
  const now = Date.now();
  if (cmcMultiCache && now - cmcMultiCache.at < CMC_CACHE_MS && cmcMultiCache.key === symParam) {
    return cmcMultiCache.data;
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symParam)}&convert=USD`,
      { headers: { "X-CMC_PRO_API_KEY": apiKey }, signal: ctrl.signal },
    );
    clearTimeout(t);
    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: Record<string, { quote?: { USD?: Record<string, unknown> } }>;
    };
    const raw = body.data;
    if (!raw || typeof raw !== "object") return null;

    const out: Record<string, CmcUsdQuote> = {};
    for (const [symKey, row] of Object.entries(raw)) {
      const usd = row.quote?.USD;
      if (!usd || typeof usd.price !== "number" || !Number.isFinite(usd.price)) continue;
      const sym = symKey.toUpperCase();
      out[sym] = {
        price: usd.price,
        volume_24h: typeof usd.volume_24h === "number" ? usd.volume_24h : 0,
        market_cap: typeof usd.market_cap === "number" ? usd.market_cap : 0,
        percent_change_24h: typeof usd.percent_change_24h === "number" ? usd.percent_change_24h : 0,
        last_updated:
          typeof usd.last_updated === "string" ? usd.last_updated : new Date().toISOString(),
      };
    }
    if (Object.keys(out).length === 0) return null;

    cmcMultiCache = { at: now, key: symParam, data: out };
    return out;
  } catch {
    return null;
  }
}

type CgDetail = {
  name: string;
  price: number;
  mcap: number;
  volume: number;
  pct24h: number | null;
  circulating: number | null;
  updatedAt: string;
};

async function fetchCoinGeckoCoinDetail(id: string): Promise<CgDetail | null> {
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      name?: string;
      market_data?: {
        current_price?: { usd?: number };
        market_cap?: { usd?: number };
        total_volume?: { usd?: number };
        price_change_percentage_24h?: number;
        circulating_supply?: number;
        last_updated?: string;
      };
    };
    const md = body.market_data;
    const price = md?.current_price?.usd;
    if (!md || typeof price !== "number" || !Number.isFinite(price)) return null;
    return {
      name: typeof body.name === "string" ? body.name : id,
      price,
      mcap: typeof md.market_cap?.usd === "number" ? md.market_cap.usd : 0,
      volume: typeof md.total_volume?.usd === "number" ? md.total_volume.usd : 0,
      pct24h: typeof md.price_change_percentage_24h === "number" ? md.price_change_percentage_24h : null,
      circulating: typeof md.circulating_supply === "number" ? md.circulating_supply : null,
      updatedAt: typeof md.last_updated === "string" ? md.last_updated : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function rangeToCgDays(range: AssetOverviewRange): number | "max" {
  switch (range) {
    case "1d":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "365d":
      return 365;
    default:
      return "max";
  }
}

const chartCache = new Map<string, { at: number; points: { time: number; price: number }[] }>();
const CHART_CACHE_MS = 120_000;

async function fetchCoinGeckoMarketChart(
  id: string,
  range: AssetOverviewRange,
): Promise<{ time: number; price: number }[]> {
  const days = rangeToCgDays(range);
  const cacheKey = `${id}:${String(days)}`;
  const hit = chartCache.get(cacheKey);
  const now = Date.now();
  if (hit && now - hit.at < CHART_CACHE_MS) return hit.points;

  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const body = (await res.json()) as { prices?: [number, number][] };
    const prices = Array.isArray(body.prices) ? body.prices : [];
    const points = prices
      .map(([ms, price]) => ({
        time: Math.floor(ms / 1000),
        price: typeof price === "number" && Number.isFinite(price) ? price : 0,
      }))
      .filter((p) => p.time > 0 && p.price > 0);
    chartCache.set(cacheKey, { at: now, points });
    return points;
  } catch {
    return [];
  }
}

export function isAllowedOverviewSymbol(symbol: string): boolean {
  return ALLOWED_SYMBOLS.has(symbol.trim().toUpperCase());
}

export function parseOverviewRange(raw: string | undefined): AssetOverviewRange {
  const r = (raw ?? "30d").toLowerCase();
  return (ASSET_OVERVIEW_RANGES as readonly string[]).includes(r) ? (r as AssetOverviewRange) : "30d";
}

/** One combined payload: CMC headline stats when API key set, else CoinGecko; chart from CoinGecko. */
export async function getAssetMarketOverview(
  symbol: string,
  range: AssetOverviewRange,
): Promise<AssetMarketOverview> {
  const sym = symbol.trim().toUpperCase();
  if (!ALLOWED_SYMBOLS.has(sym)) {
    throw new Error("Unsupported symbol");
  }
  const cgId = COINGECKO_IDS[sym];
  if (!cgId) throw new Error("Unsupported symbol");

  const [cmcMap, cgDetail, history] = await Promise.all([
    fetchCmcQuotesLatest([sym]),
    fetchCoinGeckoCoinDetail(cgId),
    fetchCoinGeckoMarketChart(cgId, range),
  ]);

  const cmc = cmcMap?.[sym] ?? null;

  const priceUsd = cmc?.price ?? cgDetail?.price ?? 0;
  const name = cgDetail?.name ?? sym;

  const statsSource: "coinmarketcap" | "coingecko" = cmc ? "coinmarketcap" : "coingecko";

  const marketCapUsd =
    cmc && cmc.market_cap > 0 ? cmc.market_cap : cgDetail && cgDetail.mcap > 0 ? cgDetail.mcap : null;
  const volume24hUsd =
    cmc && cmc.volume_24h > 0 ? cmc.volume_24h : cgDetail && cgDetail.volume > 0 ? cgDetail.volume : null;
  const percentChange24h =
    cmc != null
      ? cmc.percent_change_24h
      : cgDetail?.pct24h != null
        ? cgDetail.pct24h
        : null;
  const lastUpdated =
    cmc?.last_updated ?? cgDetail?.updatedAt ?? new Date().toISOString();

  return {
    symbol: sym,
    name,
    priceUsd,
    percentChange24h,
    marketCapUsd,
    volume24hUsd,
    circulatingSupply: cgDetail?.circulating ?? null,
    lastUpdated,
    statsSource,
    chartSource: "coingecko",
    history,
  };
}
