/**
 * Applies db/schema.sql to DATABASE_URL (idempotent-ish: fails if tables exist).
 * Run from repo root: npm run db:schema -w server
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

const schemaPath = path.resolve(__dirname, "../../db/schema.sql");
if (!fs.existsSync(schemaPath)) {
  console.error("Missing file:", schemaPath);
  process.exit(1);
}

const sql = fs.readFileSync(schemaPath, "utf8");

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
  await client.query(sql);
  console.log("Applied db/schema.sql OK.");
} catch (e) {
  console.error("Schema apply failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
