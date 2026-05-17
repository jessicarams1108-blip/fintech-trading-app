/**
 * Ensures schema + incremental migrations are applied before `node dist/index.js` (Render/Railway).
 * Migrations are idempotent (IF NOT EXISTS / ON CONFLICT) and safe to re-run each deploy.
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

async function applyFile(abs, label) {
  await client.query(fs.readFileSync(abs, "utf8"));
  console.log("[db:ready] Applied", label);
}

await client.connect();
try {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'users'
     ) AS has_users`,
  );
  if (!rows[0]?.has_users) {
    await applyFile(schemaPath, "db/schema.sql");
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await applyFile(path.join(migrationsDir, file), file);
  }

  console.log("[db:ready] Database ready");
} catch (e) {
  console.error("[db:ready] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
