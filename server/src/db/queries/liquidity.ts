import { pool } from "../index.js";
import { STATIC_USD } from "../../lib/market.js";
import { isPgUndefinedColumn, rethrowPgSchemaError } from "../../lib/pgErrors.js";

const ORACLE_USD: Record<string, number> = STATIC_USD;

export type WalletBalanceRow = {
  currency: string;
  balance: string;
};

export async function getUserWallets(userId: string): Promise<WalletBalanceRow[]> {
  const res = await pool.query<WalletBalanceRow>(
    `SELECT currency, balance::text AS balance FROM wallets WHERE user_id = $1::uuid`,
    [userId],
  );
  return res.rows;
}

export function suppliedUsdFromWallets(rows: WalletBalanceRow[]): number {
  let total = 0;
  for (const row of rows) {
    const px = ORACLE_USD[row.currency] ?? 0;
    const amt = Number.parseFloat(row.balance);
    if (!Number.isFinite(amt)) continue;
    total += amt * px;
  }
  return Math.round(total * 100) / 100;
}

export async function getUserKyc(userId: string): Promise<{ kyc_status: string; kyc_tier: number }> {
  try {
    const res = await pool.query<{ kyc_status: string; kyc_tier: number }>(
      `SELECT kyc_status, kyc_tier FROM users WHERE id = $1::uuid LIMIT 1`,
      [userId],
    );
    const row = res.rows[0];
    if (!row) return { kyc_status: "unverified", kyc_tier: 0 };
    return {
      kyc_status: row.kyc_status || "unverified",
      kyc_tier: Number(row.kyc_tier) || 0,
    };
  } catch (err) {
    if (isPgUndefinedColumn(err)) {
      return { kyc_status: "unverified", kyc_tier: 0 };
    }
    throw err;
  }
}

export async function setKycPending(userId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE users SET kyc_status = 'pending', kyc_tier = 0 WHERE id = $1::uuid`,
      [userId],
    );
  } catch (err) {
    rethrowPgSchemaError(err);
  }
}

export async function setKycRejected(userId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE users SET kyc_status = 'rejected', kyc_tier = 0 WHERE id = $1::uuid`,
      [userId],
    );
  } catch (err) {
    rethrowPgSchemaError(err);
  }
}

export async function setKycVerifiedDemo(userId: string, tier: number): Promise<void> {
  const t = Math.min(3, Math.max(1, Math.floor(tier)));
  try {
    await pool.query(
      `UPDATE users SET kyc_status = 'verified', kyc_tier = $2::smallint WHERE id = $1::uuid`,
      [userId, t],
    );
  } catch (err) {
    rethrowPgSchemaError(err);
  }
}
