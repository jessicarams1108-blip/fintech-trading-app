import { pool } from "../index.js";
/** Always safe on legacy DBs (wallets CHECK before migration 005). */
const CORE_STARTER = ["USD", "BTC", "ETH", "USDT"];
/** Extra stables — only after `005_oove_platform.sql` widens `wallets_currency_check`. */
const EXTENDED_STARTER = ["USDC", "DAI"];
function isCheckConstraintError(err) {
    return typeof err === "object" && err !== null && err.code === "23514";
}
/** Ensures each new user has zero-balance wallet rows for supported currencies. Idempotent. */
export async function ensureStarterWalletsForUser(userId) {
    for (const currency of CORE_STARTER) {
        await pool.query(`INSERT INTO wallets (user_id, currency, balance)
       VALUES ($1::uuid, $2::text, 0)
       ON CONFLICT (user_id, currency) DO NOTHING`, [userId, currency]);
    }
    for (const currency of EXTENDED_STARTER) {
        try {
            await pool.query(`INSERT INTO wallets (user_id, currency, balance)
         VALUES ($1::uuid, $2::text, 0)
         ON CONFLICT (user_id, currency) DO NOTHING`, [userId, currency]);
        }
        catch (err) {
            if (isCheckConstraintError(err)) {
                continue;
            }
            throw err;
        }
    }
}
