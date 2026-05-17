/**
 * Applies all db/migrations/*.sql in numeric order (idempotent where migrations use IF NOT EXISTS).
 * Run from repo root: npm run db:migrate -w server
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isHostedRuntime = Boolean(
  process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RAILWAY_ENVIRONMENT,
);
if (!isHostedRuntime) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const migrationsDir = path.resolve(__dirname, "../../db/migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

function clientSslOption(url) {
  try {
    const host = new URL(url.replace(/^postgresql:/i, "http:")).hostname;
    if (/^dpg-[a-z0-9-]+$/i.test(host)) return undefined;
    if (/\.render\.com$/i.test(host) || /\.rlwy\.net$/i.test(host)) {
      return { rejectUnauthorized: false };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

const ssl = clientSslOption(databaseUrl);
const client = new pg.Client({
  connectionString: databaseUrl,
  ...(ssl !== undefined ? { ssl } : {}),
});

await client.connect();
try {
  for (const file of files) {
    const abs = path.join(migrationsDir, file);
    const sql = fs.readFileSync(abs, "utf8");
    await client.query(sql);
    console.log("Applied:", file);
  }
  console.log("All migrations applied.");
} catch (e) {
  console.error("Migration failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
