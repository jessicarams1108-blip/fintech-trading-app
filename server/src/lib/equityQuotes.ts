export type EquityQuoteRow = {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
};

export const EQUITY_META: Record<string, string> = {
  AAPL: "Apple",
  MSFT: "Microsoft",
  NVDA: "NVIDIA",
  GOOGL: "Alphabet",
  AMZN: "Amazon",
  META: "Meta Platforms",
  TSLA: "Tesla",
  "BRK-B": "Berkshire Hathaway",
  JPM: "JPMorgan Chase",
  V: "Visa",
  UNH: "UnitedHealth",
  XOM: "Exxon Mobil",
  LLY: "Eli Lilly",
  AVGO: "Broadcom",
  MA: "Mastercard",
  HD: "Home Depot",
  PG: "Procter & Gamble",
  COST: "Costco",
  NFLX: "Netflix",
  AMD: "AMD",
  CRM: "Salesforce",
  ORCL: "Oracle",
  ADBE: "Adobe",
  INTC: "Intel",
  DIS: "Walt Disney",
  SPY: "SPDR S&P 500 ETF",
  QQQ: "Invesco QQQ",
  IWM: "iShares Russell 2000",
  DIA: "SPDR Dow Jones ETF",
  VOO: "Vanguard S&P 500 ETF",
};

/** Snapshot prices when external quote feeds are unavailable (e.g. blocked on host). */
export const EQUITY_SNAPSHOT: Record<string, { price: number; change24h: number }> = {
  AAPL: { price: 227.42, change24h: 1.24 },
  MSFT: { price: 418.65, change24h: -0.42 },
  NVDA: { price: 892.1, change24h: 2.88 },
  GOOGL: { price: 171.3, change24h: 0.65 },
  AMZN: { price: 198.4, change24h: -1.1 },
  META: { price: 512.8, change24h: 1.95 },
  TSLA: { price: 248.5, change24h: -2.15 },
  "BRK-B": { price: 468.2, change24h: 0.32 },
  JPM: { price: 198.7, change24h: 0.88 },
  V: { price: 278.4, change24h: -0.21 },
  UNH: { price: 512.3, change24h: -0.55 },
  XOM: { price: 118.2, change24h: 1.12 },
  LLY: { price: 782.5, change24h: 0.94 },
  AVGO: { price: 168.4, change24h: 1.45 },
  MA: { price: 478.9, change24h: 0.38 },
  HD: { price: 368.2, change24h: -0.62 },
  PG: { price: 165.8, change24h: 0.15 },
  COST: { price: 812.4, change24h: 0.72 },
  NFLX: { price: 628.5, change24h: 1.88 },
  AMD: { price: 168.2, change24h: 2.42 },
  CRM: { price: 298.4, change24h: -0.88 },
  ORCL: { price: 142.6, change24h: 0.55 },
  ADBE: { price: 528.3, change24h: -1.22 },
  INTC: { price: 22.48, change24h: 0.92 },
  DIS: { price: 112.4, change24h: -0.45 },
  SPY: { price: 528.4, change24h: -0.38 },
  QQQ: { price: 458.2, change24h: -0.72 },
  IWM: { price: 208.5, change24h: -0.55 },
  DIA: { price: 392.8, change24h: -0.28 },
  VOO: { price: 486.2, change24h: -0.35 },
};

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function yahooSymbol(sym: string): string {
  return sym.replace(/\./g, "-");
}

export function snapshotQuotes(symbols: string[]): EquityQuoteRow[] {
  return symbols.map((sym) => {
    const snap = EQUITY_SNAPSHOT[sym] ?? { price: 100, change24h: 0 };
    return {
      id: sym.toLowerCase(),
      name: EQUITY_META[sym] ?? sym,
      symbol: sym,
      price: snap.price,
      change24h: snap.change24h,
    };
  });
}

export async function fetchYahooEquityQuotes(symbols: string[]): Promise<EquityQuoteRow[]> {
  if (symbols.length === 0) return [];
  const yahooSyms = symbols.map(yahooSymbol);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSyms.join(","))}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const yres = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": YAHOO_UA,
        Accept: "application/json",
      },
    });
    if (!yres.ok) return [];
    const body = (await yres.json()) as {
      quoteResponse?: {
        result?: Array<{
          symbol?: string;
          shortName?: string;
          regularMarketPrice?: number;
          regularMarketChangePercent?: number;
        }>;
      };
    };
    const byYahoo = new Map<string, EquityQuoteRow>();
    for (const q of body.quoteResponse?.result ?? []) {
      const raw = String(q.symbol ?? "").toUpperCase();
      const sym = raw.replace(".", "-");
      if (!sym) continue;
      byYahoo.set(sym, {
        id: sym.toLowerCase(),
        name: q.shortName ?? EQUITY_META[sym] ?? sym,
        symbol: sym,
        price: Number(q.regularMarketPrice) || 0,
        change24h: Number(q.regularMarketChangePercent) || 0,
      });
    }
    return symbols
      .map((s) => byYahoo.get(s) ?? byYahoo.get(yahooSymbol(s)))
      .filter((r): r is EquityQuoteRow => !!r && r.price > 0);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function resolveEquityQuotes(symbols: string[]): Promise<EquityQuoteRow[]> {
  const live = await fetchYahooEquityQuotes(symbols);
  if (live.length >= Math.min(5, symbols.length)) {
    const liveSet = new Set(live.map((r) => r.symbol));
    const missing = symbols.filter((s) => !liveSet.has(s));
    return [...live, ...snapshotQuotes(missing)];
  }
  return snapshotQuotes(symbols);
}
