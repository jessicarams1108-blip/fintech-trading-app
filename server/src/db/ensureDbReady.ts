import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { pool } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../../db/migrations");
const schemaPath = path.resolve(__dirname, "../../../db/schema.sql");

type DbNeeds = "none" | "schema" | "migrations";

export async function detectDbNeeds(client: Pick<Pool, "query"> = pool): Promise<DbNeeds> {
  const { rows } = await client.query<{
    has_users: boolean;
    identity_tbl: boolean;
    kyc_cols: boolean;
  }>(
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
  if (!row?.has_users) return "schema";
  if (!row.identity_tbl || !row.kyc_cols) return "migrations";
  return "none";
}

async function applySql(client: Pick<Pool, "query">, abs: string, label: string): Promise<void> {
  const sql = fs.readFileSync(abs, "utf8");
  await client.query(sql);
  console.log(`[db:ready] Applied ${label}`);
}

export async function ensureDbReady(client: Pick<Pool, "query"> = pool): Promise<void> {
  const needs = await detectDbNeeds(client);
  if (needs === "none") {
    console.log("[db:ready] Database schema OK (identity + KYC)");
    return;
  }

  if (needs === "schema") {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Missing schema file: ${schemaPath}`);
    }
    await applySql(client, schemaPath, "db/schema.sql");
  }

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Missing migrations directory: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    await applySql(client, path.join(migrationsDir, file), file);
  }

  const after = await detectDbNeeds(client);
  if (after !== "none") {
    throw new Error(
      "[db:ready] Migrations ran but identity/KYC schema is still incomplete. Check DATABASE_URL and migration logs.",
    );
  }
  console.log("[db:ready] Migrations applied; identity verification ready");
}
