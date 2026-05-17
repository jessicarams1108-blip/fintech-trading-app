import { Router } from "express";
import { getUsdPrices } from "../lib/market.js";
import {
  getAssetMarketOverview,
  isAllowedOverviewSymbol,
  parseOverviewRange,
} from "../lib/marketOverview.js";

/** Popular symbols for home “top assets” strip — prices from CoinGecko when available, else static fallbacks. */
const TOP_MARKET_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "DOT", "MATIC"] as const;

export const marketRouter = Router();

marketRouter.get("/top-prices", async (_req, res, next) => {
  try {
    const px = await getUsdPrices();
    const data = TOP_MARKET_SYMBOLS.map((symbol) => ({
      symbol,
      priceUsd: typeof px[symbol] === "number" && Number.isFinite(px[symbol]) ? px[symbol]! : 0,
    }));
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

marketRouter.get("/asset-overview", async (req, res, next) => {
  const rawSym = typeof req.query.symbol === "string" ? req.query.symbol.trim().toUpperCase() : "";
  const range = parseOverviewRange(typeof req.query.range === "string" ? req.query.range : undefined);
  if (!rawSym || !isAllowedOverviewSymbol(rawSym)) {
    res.status(400).json({ error: "symbol must be a supported asset (e.g. BTC, ETH, SOL)" });
    return;
  }
  try {
    const data = await getAssetMarketOverview(rawSym, range);
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

const EQUITY_META: Record<string, string> = {
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

marketRouter.get("/equity-quotes", async (req, res, next) => {
  const raw = typeof req.query.symbols === "string" ? req.query.symbols : "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40);
  if (symbols.length === 0) {
    res.status(400).json({ error: "symbols query required" });
    return;
  }
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const yres = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!yres.ok) throw new Error(`quote feed ${yres.status}`);
    const body = (await yres.json()) as {
      quoteResponse?: { result?: Array<{
        symbol?: string;
        shortName?: string;
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
      }> };
    };
    const rows = (body.quoteResponse?.result ?? []).map((q) => {
      const sym = String(q.symbol ?? "").toUpperCase();
      return {
        id: sym.toLowerCase(),
        name: q.shortName ?? EQUITY_META[sym] ?? sym,
        symbol: sym,
        price: Number(q.regularMarketPrice) || 0,
        change24h: Number(q.regularMarketChangePercent) || 0,
      };
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

marketRouter.get("/price", async (req, res, next) => {
  const raw = typeof req.query.symbol === "string" ? req.query.symbol.trim().toUpperCase() : "";
  if (!raw) {
    res.status(400).json({ error: "symbol query parameter is required" });
    return;
  }
  try {
    const px = await getUsdPrices();
    const priceUsd = px[raw];
    if (typeof priceUsd !== "number" || !Number.isFinite(priceUsd) || priceUsd <= 0) {
      res.status(404).json({ error: `No USD price available for ${raw}` });
      return;
    }
    res.json({ data: { symbol: raw, priceUsd } });
  } catch (e) {
    next(e);
  }
});
