import { pool } from "../index.js";
export async function createSession(input) {
    try {
        const { rows } = await pool.query(`INSERT INTO user_sessions (user_id, user_agent, ip_address)
       VALUES ($1::uuid, $2::text, $3::text)
       RETURNING id`, [input.userId, input.userAgent ?? null, input.ipAddress ?? null]);
        return rows[0].id;
    }
    catch {
        return "";
    }
}
export async function listSessions(userId) {
    try {
        const { rows } = await pool.query(`SELECT id::text, user_agent, ip_address, created_at::text, revoked_at::text
       FROM user_sessions
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 50`, [userId]);
        return rows;
    }
    catch {
        return [];
    }
}
export async function revokeSession(sessionId, userId) {
    try {
        const r = await pool.query(`UPDATE user_sessions SET revoked_at = NOW()
       WHERE id = $1::uuid AND user_id = $2::uuid AND revoked_at IS NULL`, [sessionId, userId]);
        return r.rowCount === 1;
    }
    catch {
        return false;
    }
}
