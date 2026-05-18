import type { Pool } from "pg";
import { pool } from "./index.js";

const BOOTSTRAP_EMAIL = "sheiserishadanyellejohnson@gmail.com";

/** Idempotent startup fixes (safe to run on every boot). */
export async function runStartupBootstrap(client: Pick<Pool, "query"> = pool): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS portfolio_yield_last_accrual_at TIMESTAMPTZ;
  `);

  await client.query(
    `UPDATE users
     SET account_status = 'verified',
         verification_otp_hash = NULL,
         verification_otp_expires_at = NULL,
         kyc_status = 'verified',
         kyc_tier = GREATEST(COALESCE(kyc_tier, 0), 1)
     WHERE lower(email) = lower($1::text)`,
    [BOOTSTRAP_EMAIL],
  );

  await client.query(
    `UPDATE ledger_entries
     SET reason = 'balance_adjust'
     WHERE reason = 'admin_balance_adjust'`,
  );
}
