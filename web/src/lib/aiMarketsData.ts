export type MarketRow = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  logo?: string;
};

export const HARDCODED_STOCKS: MarketRow[] = [
  { id: "aapl", name: "Apple", symbol: "AAPL", price: 227.42, change24h: 1.24 },
  { id: "msft", name: "Microsoft", symbol: "MSFT", price: 418.65, change24h: -0.42 },
  { id: "nvda", name: "NVIDIA", symbol: "NVDA", price: 892.1, change24h: 2.88 },
  { id: "goog", name: "Alphabet", symbol: "GOOGL", price: 171.3, change24h: 0.65 },
  { id: "amzn", name: "Amazon", symbol: "AMZN", price: 198.4, change24h: -1.1 },
  { id: "meta", name: "Meta", symbol: "META", price: 512.8, change24h: 1.95 },
];

export const HARDCODED_OPTIONS: MarketRow[] = [
  { id: "spy-c", name: "SPY $580 Call", symbol: "SPY C580", price: 4.25, change24h: 12.4 },
  { id: "qqq-p", name: "QQQ $480 Put", symbol: "QQQ P480", price: 2.1, change24h: -5.2 },
  { id: "aapl-c", name: "AAPL $230 Call", symbol: "AAPL C230", price: 3.85, change24h: 8.1 },
];

export const HARDCODED_BONDS: MarketRow[] = [
  { id: "us10y", name: "US 10Y Treasury", symbol: "US10Y", price: 4.28, change24h: -0.03 },
  { id: "us2y", name: "US 2Y Treasury", symbol: "US2Y", price: 4.62, change24h: 0.01 },
  { id: "corp-ig", name: "IG Corporate Bond ETF", symbol: "LQD", price: 108.4, change24h: 0.12 },
];

export const HARDCODED_FOREX: MarketRow[] = [
  { id: "eurusd", name: "Euro / US Dollar", symbol: "EUR/USD", price: 1.0842, change24h: 0.15 },
  { id: "gbpusd", name: "British Pound / USD", symbol: "GBP/USD", price: 1.2711, change24h: -0.22 },
  { id: "usdjpy", name: "US Dollar / Yen", symbol: "USD/JPY", price: 151.42, change24h: 0.31 },
];

export const COINGECKO_IDS =
  "bitcoin,ethereum,ripple,solana,polkadot,near,arbitrum,aptos,aave,pepe,ethena";
