import pg from "pg";
import { env } from "../env.js";
/** Hostname from a postgres URL (no port) — safe for logs. */
export function pgHost(connectionString) {
    try {
        return new URL(connectionString.replace(/^postgresql:/i, "http:")).hostname;
    }
    catch {
        return "";
    }
}
/**
 * TLS for public cloud Postgres URLs only.
 * Private network hosts must NOT use SSL (Railway internal, Render `dpg-*` hostname).
 */
function poolSslOption() {
    const url = env.DATABASE_URL;
    const host = pgHost(url);
    if (/\.railway\.internal$/i.test(host))
        return undefined;
    if (/^dpg-[a-z0-9-]+/i.test(host))
        return undefined;
    if (/render\.com/i.test(host) || /\.rlwy\.net$/i.test(host)) {
        return { rejectUnauthorized: false };
    }
    return undefined;
}
const ssl = poolSslOption();
export const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    ...(ssl !== undefined ? { ssl } : {}),
});
pool.on("error", (err) => {
    console.error("[pg pool] Unexpected error:", err.message);
});
