import { FALLBACK_STOCKS, HARDCODED_BONDS, HARDCODED_OPTIONS } from "@/lib/aiMarketsData";

export const AI_ASSET_CLASSES = [
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "stocks", label: "Stocks" },
] as const;

export type AiAssetClassId = (typeof AI_ASSET_CLASSES)[number]["id"];

export type AiTradeSymbolOption = { symbol: string; label: string };

const CRYPTO_SYMBOLS: AiTradeSymbolOption[] = [
  { symbol: "BTC", label: "BTC — Bitcoin" },
  { symbol: "ETH", label: "ETH — Ethereum" },
  { symbol: "XRP", label: "XRP — Ripple" },
  { symbol: "SOL", label: "SOL — Solana" },
  { symbol: "BNB", label: "BNB — BNB" },
  { symbol: "DOGE", label: "DOGE — Dogecoin" },
  { symbol: "ADA", label: "ADA — Cardano" },
  { symbol: "TRX", label: "TRX — TRON" },
  { symbol: "DOT", label: "DOT — Polkadot" },
  { symbol: "LINK", label: "LINK — Chainlink" },
  { symbol: "AVAX", label: "AVAX — Avalanche" },
  { symbol: "LTC", label: "LTC — Litecoin" },
  { symbol: "UNI", label: "UNI — Uniswap" },
  { symbol: "NEAR", label: "NEAR — NEAR" },
  { symbol: "ARB", label: "ARB — Arbitrum" },
  { symbol: "APT", label: "APT — Aptos" },
  { symbol: "AAVE", label: "AAVE — Aave" },
  { symbol: "PEPE", label: "PEPE — Pepe" },
  { symbol: "SUI", label: "SUI — Sui" },
  { symbol: "XLM", label: "XLM — Stellar" },
];

const FOREX_SYMBOLS: AiTradeSymbolOption[] = [
  { symbol: "EUR/USD", label: "EUR/USD" },
  { symbol: "GBP/USD", label: "GBP/USD" },
  { symbol: "USD/JPY", label: "USD/JPY" },
  { symbol: "USD/CHF", label: "USD/CHF" },
  { symbol: "AUD/USD", label: "AUD/USD" },
  { symbol: "USD/CAD", label: "USD/CAD" },
  { symbol: "NZD/USD", label: "NZD/USD" },
  { symbol: "EUR/GBP", label: "EUR/GBP" },
  { symbol: "EUR/JPY", label: "EUR/JPY" },
  { symbol: "GBP/JPY", label: "GBP/JPY" },
];

function uniqueSymbolOptions(rows: { symbol: string; name: string }[]): AiTradeSymbolOption[] {
  const seen = new Set<string>();
  const out: AiTradeSymbolOption[] = [];
  for (const s of rows) {
    const key = s.symbol.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ symbol: s.symbol, label: `${s.symbol} — ${s.name}` });
  }
  return out;
}

const STOCK_SYMBOLS: AiTradeSymbolOption[] = uniqueSymbolOptions([
  ...FALLBACK_STOCKS,
  ...HARDCODED_OPTIONS,
  ...HARDCODED_BONDS,
]);

const SYMBOLS_BY_CLASS: Record<AiAssetClassId, AiTradeSymbolOption[]> = {
  crypto: CRYPTO_SYMBOLS,
  forex: FOREX_SYMBOLS,
  stocks: STOCK_SYMBOLS,
};

export function isAiAssetClass(id: string): id is AiAssetClassId {
  return id === "crypto" || id === "forex" || id === "stocks";
}

export function symbolsForAssetClass(assetClass: string): AiTradeSymbolOption[] {
  if (isAiAssetClass(assetClass)) return SYMBOLS_BY_CLASS[assetClass];
  return SYMBOLS_BY_CLASS.crypto;
}

export function defaultSymbolForAssetClass(assetClass: string): string {
  return symbolsForAssetClass(assetClass)[0]?.symbol ?? "BTC";
}

export function findAssetClassForSymbol(symbol: string): AiAssetClassId | null {
  const upper = symbol.trim().toUpperCase();
  for (const id of ["crypto", "forex", "stocks"] as const) {
    if (symbolsForAssetClass(id).some((o) => o.symbol.toUpperCase() === upper)) return id;
  }
  return null;
}

export function resolveSymbolForAssetClass(assetClass: string, symbol: string): string {
  const options = symbolsForAssetClass(assetClass);
  const upper = symbol.trim().toUpperCase();
  const exact = options.find((o) => o.symbol.toUpperCase() === upper);
  if (exact) return exact.symbol;
  return defaultSymbolForAssetClass(assetClass);
}

export function resolveAssetClassAndSymbol(
  preferredClass: string,
  symbol: string,
): { assetClass: AiAssetClassId; symbol: string } {
  const fromSymbol = findAssetClassForSymbol(symbol);
  const assetClass = fromSymbol ?? (isAiAssetClass(preferredClass) ? preferredClass : "crypto");
  return { assetClass, symbol: resolveSymbolForAssetClass(assetClass, symbol) };
}
