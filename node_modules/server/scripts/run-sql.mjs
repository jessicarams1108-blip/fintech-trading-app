import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rel = process.argv[2];
if (!rel) {
  console.error("Usage: node run-sql.mjs <path-to.sql>");
  process.exit(1);
}
const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
if (!fs.existsSync(abs)) {
  console.error("File not found:", abs);
  process.exit(1);
}
const sql = fs.readFileSync(abs, "utf8");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  console.log("Applied SQL:", abs);
} finally {
  await client.end();
}
