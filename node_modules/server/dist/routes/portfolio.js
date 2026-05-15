import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import { getUsdPrices } from "../lib/market.js";
import { getUserWallets } from "../db/queries/liquidity.js";
import { listHoldings, listSnapshots, portfolioTotalFromWallets, syncHoldingsFromWallets, upsertSnapshot, } from "../db/queries/portfolio.js";
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
export const portfolioRouter = Router();
portfolioRouter.use(authenticateRequired);
portfolioRouter.get("/summary", limiter, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const prices = await getUsdPrices();
        const wallets = await getUserWallets(userId);
        const total = portfolioTotalFromWallets(wallets, prices);
        await upsertSnapshot(userId, total);
        await syncHoldingsFromWallets(userId, prices);
        const snaps = await listSnapshots(userId, 14);
        const sorted = [...snaps].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
        let change24hPct = 0;
        if (sorted.length >= 2) {
            const cur = Number.parseFloat(sorted[sorted.length - 1].total_usd);
            const prev = Number.parseFloat(sorted[sorted.length - 2].total_usd);
            if (prev > 0)
                change24hPct = Math.round(((cur - prev) / prev) * 10_000) / 100;
        }
        const allocation = wallets
            .map((w) => {
            const px = prices[w.currency.toUpperCase()] ?? 0;
            const q = Number.parseFloat(w.balance);
            const v = Number.isFinite(q) ? q * px : 0;
            return { symbol: w.currency, valueUsd: Math.round(v * 100) / 100 };
        })
            .filter((x) => x.valueUsd > 0);
        res.json({
            data: {
                totalValueUsd: total,
                change24hPct,
                allocation,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
portfolioRouter.get("/holdings", limiter, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const prices = await getUsdPrices();
        await syncHoldingsFromWallets(userId, prices);
        const rows = await listHoldings(userId);
        const data = rows.map((h) => {
            const qty = Number.parseFloat(h.quantity);
            const avg = Number.parseFloat(h.avg_cost_usd);
            const px = prices[h.symbol] ?? 0;
            const value = qty * px;
            const pnlPct = avg > 0 ? Math.round(((px - avg) / avg) * 10_000) / 100 : 0;
            return {
                symbol: h.symbol,
                quantity: h.quantity,
                avgCostUsd: h.avg_cost_usd,
                currentPriceUsd: px,
                valueUsd: Math.round(value * 100) / 100,
                pnlPct,
            };
        });
        res.json({ data });
    }
    catch (e) {
        next(e);
    }
});
portfolioRouter.get("/history", limiter, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const range = String(req.query.range ?? "1m").toLowerCase();
        const days = range === "1d" ? 2 : range === "1w" ? 8 : range === "1y" ? 370 : range === "all" ? 4000 : 32;
        const rows = await listSnapshots(userId, days);
        const points = rows.map((r) => ({
            time: r.snapshot_date,
            value: Number.parseFloat(r.total_usd),
        }));
        res.json({ data: { range, points } });
    }
    catch (e) {
        next(e);
    }
});
