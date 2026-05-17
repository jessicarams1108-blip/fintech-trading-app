export type MarketRow = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  logo?: string;
  maturity?: string;
  yieldPct?: number;
};

export const HARDCODED_OPTIONS: MarketRow[] = [
  { id: "spx", name: "S&P 500 Index", symbol: "SPX", price: 5920.5, change24h: -1.24 },
  { id: "ndx", name: "NASDAQ 100 Index", symbol: "NDX", price: 21480.2, change24h: -1.87 },
  { id: "rut", name: "Russell 2000 Index", symbol: "RUT", price: 2088.4, change24h: -0.92 },
  { id: "vix", name: "CBOE Volatility Index", symbol: "VIX", price: 18.42, change24h: 6.78 },
  { id: "spy-c580", name: "SPY $580 Call", symbol: "SPY C580", price: 4.25, change24h: 12.4 },
  { id: "spy-p560", name: "SPY $560 Put", symbol: "SPY P560", price: 2.85, change24h: -3.1 },
  { id: "qqq-c500", name: "QQQ $500 Call", symbol: "QQQ C500", price: 6.12, change24h: 9.8 },
  { id: "qqq-p480", name: "QQQ $480 Put", symbol: "QQQ P480", price: 2.1, change24h: -5.2 },
  { id: "aapl-c230", name: "AAPL $230 Call", symbol: "AAPL C230", price: 3.85, change24h: 8.1 },
  { id: "nvda-c950", name: "NVDA $950 Call", symbol: "NVDA C950", price: 18.4, change24h: 15.2 },
  { id: "tsla-c250", name: "TSLA $250 Call", symbol: "TSLA C250", price: 5.6, change24h: -2.4 },
  { id: "meta-c520", name: "META $520 Call", symbol: "META C520", price: 7.2, change24h: 4.5 },
  { id: "iwm-c210", name: "IWM $210 Call", symbol: "IWM C210", price: 1.95, change24h: 6.2 },
  { id: "btc-etp-c", name: "Bitcoin ETP Call", symbol: "BITO C25", price: 0.88, change24h: 11.3 },
];

export const HARDCODED_BONDS: MarketRow[] = [
  { id: "us10y", name: "US 10Y Treasury", symbol: "US10Y", price: 4.28, change24h: -0.03, maturity: "Jul 15, 2034", yieldPct: 4.28 },
  { id: "us2y", name: "US 2Y Treasury", symbol: "US2Y", price: 4.62, change24h: 0.01, maturity: "May 31, 2026", yieldPct: 4.62 },
  { id: "us30y", name: "US 30Y Treasury", symbol: "US30Y", price: 4.51, change24h: -0.05, maturity: "Feb 15, 2054", yieldPct: 4.51 },
  { id: "lqd", name: "iShares IG Corporate Bond", symbol: "LQD", price: 108.4, change24h: 0.12, maturity: "ETF", yieldPct: 4.85 },
  { id: "hyg", name: "iShares High Yield Corporate", symbol: "HYG", price: 76.2, change24h: -0.08, maturity: "ETF", yieldPct: 6.42 },
  { id: "tlt", name: "iShares 20+ Year Treasury", symbol: "TLT", price: 92.8, change24h: -0.42, maturity: "ETF", yieldPct: 4.12 },
  { id: "bnd", name: "Vanguard Total Bond", symbol: "BND", price: 72.1, change24h: 0.05, maturity: "ETF", yieldPct: 3.88 },
  { id: "agg", name: "iShares Core US Aggregate", symbol: "AGG", price: 98.6, change24h: 0.03, maturity: "ETF", yieldPct: 4.05 },
  { id: "tip", name: "iShares TIPS Bond", symbol: "TIP", price: 108.2, change24h: 0.11, maturity: "ETF", yieldPct: 2.15 },
  { id: "mub", name: "iShares National Muni Bond", symbol: "MUB", price: 105.4, change24h: 0.02, maturity: "ETF", yieldPct: 3.25 },
  { id: "emb", name: "iShares EM Bond", symbol: "EMB", price: 88.9, change24h: -0.15, maturity: "ETF", yieldPct: 5.92 },
  { id: "getty", name: "Getty Images Holdings", symbol: "ABEGET", price: 98.5, change24h: 0.0, maturity: "Mar 01, 2028", yieldPct: 17.56 },
];

export const STOCK_FILTER_PILLS = ["Today's top gainers", "Today's top losers", "Popular stocks", "ETFs"] as const;

export const BOND_FILTER_PILLS = ["Highest coupon", "Highest yield", "Short-term"] as const;

export const OPTIONS_FILTER_PILLS = ["Indices", "Stocks", "ETFs", "Bitcoin ETPs"] as const;
