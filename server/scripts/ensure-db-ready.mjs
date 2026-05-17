/**
 * Ensures identity/KYC tables exist (runs migrations on existing DBs).
 * Used before `node dist/index.js` on Render.
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
if (!databaseUrl?.startsWith("postgres")) {
  console.log("[db:ready] Skip — DATABASE_URL not Postgres");
  process.exit(0);
}

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

const migrationsDir = path.resolve(__dirname, "../../db/migrations");
const schemaPath = path.resolve(__dirname, "../../db/schema.sql");

async function detectNeeds() {
  const { rows } = await client.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'users'
       ) AS has_users,
       to_regclass('public.identity_verification_submissions') IS NOT NULL AS identity_tbl,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'kyc_status'
       ) AS kyc_cols`,
  );
  const row = rows[0];
  if (!row.has_users) return "schema";
  if (!row.identity_tbl || !row.kyc_cols) return "migrations";
  return "none";
}

async function applyFile(abs, label) {
  await client.query(fs.readFileSync(abs, "utf8"));
  console.log("[db:ready] Applied", label);
}

await client.connect();
try {
  const needs = await detectNeeds();
  if (needs === "none") {
    console.log("[db:ready] OK");
    process.exit(0);
  }
  if (needs === "schema") {
    await applyFile(schemaPath, "db/schema.sql");
  }
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await applyFile(path.join(migrationsDir, file), file);
  }
  const after = await detectNeeds();
  if (after !== "none") {
    console.error("[db:ready] Still incomplete after migrations");
    process.exit(1);
  }
  console.log("[db:ready] Migrations complete");
} catch (e) {
  console.error("[db:ready] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
