import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import { addWatchlistItem, listWatchlist, removeWatchlistItem } from "../db/queries/watchlist.js";
import { getUsdPrices } from "../lib/market.js";
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
export const watchlistRouter = Router();
watchlistRouter.use(authenticateRequired);
watchlistRouter.get("/", limiter, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const rows = await listWatchlist(userId);
        const prices = await getUsdPrices();
        const data = rows.map((r) => {
            const sym = r.symbol.toUpperCase();
            const px = prices[sym] ?? 0;
            return {
                symbol: sym,
                priceUsd: px,
                change24hPct: 0,
                marketCapUsd: null,
                addedAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
            };
        });
        res.json({ data });
    }
    catch (e) {
        next(e);
    }
});
const addSchema = z.object({ symbol: z.string().min(1).max(12) });
watchlistRouter.post("/add", limiter, async (req, res, next) => {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: parsed.error.flatten() });
        return;
    }
    try {
        await addWatchlistItem(req.user.id, parsed.data.symbol);
        res.status(201).json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
watchlistRouter.delete("/:symbol", limiter, async (req, res, next) => {
    try {
        const rawSym = req.params.symbol;
        const symbol = typeof rawSym === "string" ? rawSym : Array.isArray(rawSym) ? String(rawSym[0] ?? "") : String(rawSym ?? "");
        await removeWatchlistItem(req.user.id, symbol);
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
