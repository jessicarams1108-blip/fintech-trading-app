import pg from "pg";
import { env } from "../env.js";
export const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
});
pool.on("error", (err) => {
    console.error("[pg pool] Unexpected error:", err.message);
});
