import { apiFetch } from "@/lib/apiBase";
import type { MarketRow } from "@/lib/aiMarketsData";

const CRYPTO_IDS = [
  "bitcoin",
  "ethereum",
  "ripple",
  "solana",
  "binancecoin",
  "dogecoin",
  "cardano",
  "tron",
  "polkadot",
  "near",
  "arbitrum",
  "aptos",
  "aave",
  "pepe",
  "ethena",
  "chainlink",
  "avalanche-2",
  "stellar",
  "sui",
  "litecoin",
  "uniswap",
  "cosmos",
  "internet-computer",
  "ethereum-classic",
  "render-token",
  "matic-network",
  "filecoin",
  "maker",
  "injective-protocol",
  "optimism",
  "the-open-network",
  "fetch-ai",
  "bittensor",
  "celestia",
  "sei-network",
  "jupiter-exchange-solana",
  "pump-fun",
  "morpho",
  "pax-gold",
].join(",");

type CgMarket = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
};

export async function fetchLiveCrypto(): Promise<MarketRow[]> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${CRYPTO_IDS}&order=market_cap_desc&sparkline=false`,
  );
  if (!res.ok) throw new Error("Could not load crypto");
  const data = (await res.json()) as CgMarket[];
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol.toUpperCase(),
    price: c.current_price ?? 0,
    change24h: c.price_change_percentage_24h ?? 0,
    logo: c.image,
  }));
}

const STOCK_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "META",
  "TSLA",
  "BRK-B",
  "JPM",
  "V",
  "UNH",
  "XOM",
  "LLY",
  "AVGO",
  "MA",
  "HD",
  "PG",
  "COST",
  "NFLX",
  "AMD",
  "CRM",
  "ORCL",
  "ADBE",
  "INTC",
  "DIS",
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "VOO",
];

export async function fetchLiveStocks(): Promise<MarketRow[]> {
  const res = await apiFetch(`/api/market/equity-quotes?symbols=${STOCK_SYMBOLS.join(",")}`);
  const body = (await res.json().catch(() => ({}))) as { data?: MarketRow[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not load stocks");
  return body.data ?? [];
}
