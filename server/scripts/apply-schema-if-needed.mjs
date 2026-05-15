/**
 * Applies db/schema.sql when the database has no app tables yet.
 * Used on Render free tier (no Shell / no external DB access).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("postgres")) {
  console.log("[db:schema] Skip — DATABASE_URL not set to Postgres");
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

const schemaPath = path.resolve(__dirname, "../../db/schema.sql");
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

await client.connect();
try {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`,
  );
  if (rows.length > 0) {
    console.log("[db:schema] Tables already exist — skip");
    process.exit(0);
  }

  console.log("[db:schema] Applying db/schema.sql …");
  await client.query(fs.readFileSync(schemaPath, "utf8"));

  if (fs.existsSync(migrationsDir)) {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      console.log(`[db:schema] Applying migration ${file} …`);
      await client.query(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    }
  }

  console.log("[db:schema] Applied OK");
} catch (e) {
  console.error("[db:schema] Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end();
}
