import { pool } from "../index.js";
import { getUserWallets } from "./liquidity.js";
export async function syncHoldingsFromWallets(userId, prices) {
    try {
        const wallets = await getUserWallets(userId);
        for (const w of wallets) {
            const qty = Number.parseFloat(w.balance);
            const sym = w.currency.toUpperCase();
            if (!Number.isFinite(qty) || qty === 0) {
                await pool.query(`DELETE FROM portfolio_holdings WHERE user_id = $1::uuid AND symbol = $2::text`, [
                    userId,
                    sym,
                ]);
                continue;
            }
            const px = prices[sym] ?? 0;
            await pool.query(`INSERT INTO portfolio_holdings (user_id, symbol, quantity, avg_cost_usd, updated_at)
       VALUES ($1::uuid, $2::text, $3::numeric, $4::numeric, NOW())
       ON CONFLICT (user_id, symbol) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         avg_cost_usd = CASE
           WHEN portfolio_holdings.quantity = 0 THEN EXCLUDED.avg_cost_usd
           ELSE portfolio_holdings.avg_cost_usd
         END,
         updated_at = NOW()`, [userId, sym, qty, px]);
        }
    }
    catch {
        /* optional table */
    }
}
export async function listHoldings(userId) {
    try {
        const { rows } = await pool.query(`SELECT symbol, quantity::text, avg_cost_usd::text
     FROM portfolio_holdings
     WHERE user_id = $1::uuid AND quantity::numeric <> 0
     ORDER BY symbol`, [userId]);
        return rows;
    }
    catch {
        return [];
    }
}
export async function upsertSnapshot(userId, totalUsd) {
    try {
        const d = new Date().toISOString().slice(0, 10);
        await pool.query(`INSERT INTO portfolio_snapshots (user_id, snapshot_date, total_usd)
     VALUES ($1::uuid, $2::date, $3::numeric)
     ON CONFLICT (user_id, snapshot_date) DO UPDATE SET total_usd = EXCLUDED.total_usd`, [userId, d, totalUsd]);
    }
    catch {
        /* optional */
    }
}
export async function listSnapshots(userId, days) {
    try {
        const { rows } = await pool.query(`SELECT snapshot_date::text, total_usd::text
     FROM portfolio_snapshots
     WHERE user_id = $1::uuid
       AND snapshot_date >= CURRENT_DATE - ($2::integer)
     ORDER BY snapshot_date ASC`, [userId, days]);
        return rows;
    }
    catch {
        return [];
    }
}
export function portfolioTotalFromWallets(wallets, prices) {
    let t = 0;
    for (const w of wallets) {
        const px = prices[w.currency.toUpperCase()] ?? 0;
        const qty = Number.parseFloat(w.balance);
        if (!Number.isFinite(qty))
            continue;
        t += qty * px;
    }
    return Math.round(t * 100) / 100;
}
