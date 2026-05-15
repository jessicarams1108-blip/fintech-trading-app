/**
 * Connects to the "postgres" maintenance DB and creates the target DB from
 * DATABASE_URL if it is missing. Run: npm run db:create -w server
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set (check .env or server/.env).");
  process.exit(1);
}

const u = new URL(databaseUrl);
const dbName = (u.pathname || "").replace(/^\//, "");
if (!dbName || dbName === "postgres") {
  console.error("DATABASE_URL must end with a database name (e.g. .../trading_app).");
  process.exit(1);
}
if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
  console.error("Unsupported database name in DATABASE_URL.");
  process.exit(1);
}

u.pathname = "/postgres";
const adminUrl = u.toString();

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
try {
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );
  if (rowCount) {
    console.log(`Database "${dbName}" already exists.`);
  } else {
    await client.query(`CREATE DATABASE ${pg.escapeIdentifier(dbName)}`);
    console.log(`Created database "${dbName}".`);
  }
} finally {
  await client.end();
}
