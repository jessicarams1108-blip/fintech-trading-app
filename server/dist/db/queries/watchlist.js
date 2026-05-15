import { pool } from "../index.js";
export async function listWatchlist(userId) {
    try {
        const { rows } = await pool.query(`SELECT symbol, created_at FROM watchlist_items WHERE user_id = $1::uuid ORDER BY created_at DESC`, [userId]);
        return rows;
    }
    catch {
        return [];
    }
}
export async function addWatchlistItem(userId, symbol) {
    const s = symbol.trim().toUpperCase();
    if (!s)
        throw new Error("Symbol required");
    try {
        await pool.query(`INSERT INTO watchlist_items (user_id, symbol) VALUES ($1::uuid, $2::text)
     ON CONFLICT (user_id, symbol) DO NOTHING`, [userId, s]);
    }
    catch {
        throw new Error("Watchlist not available — run migration 005.");
    }
}
export async function removeWatchlistItem(userId, symbol) {
    await pool.query(`DELETE FROM watchlist_items WHERE user_id = $1::uuid AND symbol = $2::text`, [
        userId,
        symbol.trim().toUpperCase(),
    ]);
}
