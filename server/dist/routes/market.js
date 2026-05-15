import { Router } from "express";
import { getUsdPrices } from "../lib/market.js";
/** Popular symbols for home “top assets” strip — prices from CoinGecko when available, else static fallbacks. */
const TOP_MARKET_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "DOT", "MATIC"];
export const marketRouter = Router();
marketRouter.get("/top-prices", async (_req, res, next) => {
    try {
        const px = await getUsdPrices();
        const data = TOP_MARKET_SYMBOLS.map((symbol) => ({
            symbol,
            priceUsd: typeof px[symbol] === "number" && Number.isFinite(px[symbol]) ? px[symbol] : 0,
        }));
        res.json({ data });
    }
    catch (e) {
        next(e);
    }
});
/** Single-symbol USD price (CoinGecko-backed when available). Used for USD→asset conversions (e.g. admin credits). */
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
    }
    catch (e) {
        next(e);
    }
});
