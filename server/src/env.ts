import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** On Render/Railway, use platform env only — never let committed `.env` override DATABASE_URL. */
const isHostedRuntime = Boolean(
  process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RAILWAY_ENVIRONMENT,
);

if (!isHostedRuntime) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
}

function boolFromEnv(val: unknown, defaultVal: boolean): boolean {
  if (val === undefined || val === "") return defaultVal;
  const s = String(val).toLowerCase().trim();
  if (["true", "1", "yes"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;
  return defaultVal;
}

function emptyToUndef(val: unknown): unknown {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s === "" ? undefined : s;
}

/**
 * Validates required secrets at startup to avoid half-configured deployments.
 */
const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(12, "DATABASE_URL must be set to a Postgres connection string")
    .refine((v) => /^postgres(ql)?:\/\//i.test(v), {
      message: "DATABASE_URL must start with postgresql:// (not a website URL)",
    }),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  /** Case-insensitive allowlist gate for MVP admin tooling. Prefer role column longer term. */
  ADMIN_PRIMARY_EMAIL: z.string().email().optional(),
  /** Comma-separated admin emails (overrides single ADMIN_PRIMARY_EMAIL when set). */
  ADMIN_EMAILS: z.preprocess(emptyToUndef, z.string().min(3).optional()),
  APP_ORIGIN: z.string().optional(),
  PORT: z.coerce.number().default(4000),
  /** Resend.com API key. If unset, OTP is logged to stdout and email is skipped (local dev). */
  RESEND_API_KEY: z.preprocess((v) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s === "" ? undefined : s;
  }, z.string().min(8).optional()),
  RESEND_FROM_EMAIL: z.preprocess((v) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s === "" ? undefined : s;
  }, z.string().min(3).optional()),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  /** When true, POST /api/kyc/demo-verify may elevate KYC for local testing. Never enable in production. */
  OOVE_DEMO_KYC: z.preprocess((v) => boolFromEnv(v, false), z.boolean()),
  /** Local-only: allow passwordless session mint for legacy demos. */
  DEV_PASSWORDLESS_SESSION: z.preprocess((v) => boolFromEnv(v, false), z.boolean()),
  /** Optional: S3-compatible bucket for deposit proof uploads (presigned PUT). */
  S3_DEPOSIT_BUCKET: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  S3_REGION: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  S3_ACCESS_KEY_ID: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  S3_SECRET_ACCESS_KEY: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  /** Public base URL for objects (no trailing slash). Shown to admins with the proof key. */
  S3_PUBLIC_BASE_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  /** Custom API endpoint (R2, MinIO). Omit for AWS S3. */
  S3_ENDPOINT: z.preprocess(emptyToUndef, z.string().url().optional()),
  /** CoinMarketCap Pro API key — optional. When set, live price / mcap / volume / 24h% use CMC; chart history still uses CoinGecko. */
  COINMARKETCAP_API_KEY: z.preprocess(emptyToUndef, z.string().min(16).optional()),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_PRIMARY_EMAIL: process.env.ADMIN_PRIMARY_EMAIL,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  APP_ORIGIN: process.env.APP_ORIGIN,
  PORT: process.env.PORT,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  OTP_EXPIRY_MINUTES: process.env.OTP_EXPIRY_MINUTES,
  DEV_PASSWORDLESS_SESSION: process.env.DEV_PASSWORDLESS_SESSION,
  OOVE_DEMO_KYC: process.env.OOVE_DEMO_KYC,
  S3_DEPOSIT_BUCKET: process.env.S3_DEPOSIT_BUCKET,
  S3_REGION: process.env.S3_REGION,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  COINMARKETCAP_API_KEY: process.env.COINMARKETCAP_API_KEY,
});
