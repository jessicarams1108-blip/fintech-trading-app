import pg from "pg";
import { env } from "../env.js";
/** Render-hosted Postgres (and many cloud URLs) expect TLS from Node clients. */
function poolSslOption() {
    const url = env.DATABASE_URL;
    if (/\.render\.com/i.test(url) || process.env.RENDER === "true") {
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
