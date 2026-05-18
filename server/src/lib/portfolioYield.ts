import { pool } from "../db/index.js";

/** Annual portfolio yield shown in product copy (5% APY). */
export const PORTFOLIO_APY_ANNUAL = 0.05;
/** Accrue yield to USDT wallet every N days. */
export const PORTFOLIO_ACCRUAL_DAYS = 5;

const MS_PER_DAY = 86_400_000;

function periodRateFromApy(): number {
  return Math.pow(1 + PORTFOLIO_APY_ANNUAL, PORTFOLIO_ACCRUAL_DAYS / 365) - 1;
}

export type PortfolioYieldUser = {
  id: string;
  created_at: Date;
  portfolio_yield_last_accrual_at: Date | null;
};

export async function loadPortfolioYieldUser(userId: string): Promise<PortfolioYieldUser | null> {
  const { rows } = await pool.query<{
    id: string;
    created_at: Date;
    portfolio_yield_last_accrual_at: Date | null;
  }>(
    `SELECT id, created_at, portfolio_yield_last_accrual_at
     FROM users
     WHERE id = $1::uuid
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** Credit missed 5-day APY accruals to the user's USDT wallet (idempotent per period). */
export async function applyPortfolioYieldAccruals(
  userId: string,
  baseUsd: number,
): Promise<{ creditedUsd: number; periodsApplied: number }> {
  if (!Number.isFinite(baseUsd) || baseUsd <= 0) {
    return { creditedUsd: 0, periodsApplied: 0 };
  }

  const user = await loadPortfolioYieldUser(userId);
  if (!user) return { creditedUsd: 0, periodsApplied: 0 };

  const intervalMs = PORTFOLIO_ACCRUAL_DAYS * MS_PER_DAY;
  const anchor = user.portfolio_yield_last_accrual_at ?? user.created_at;
  const anchorMs = new Date(anchor).getTime();
  const nowMs = Date.now();
  let periods = Math.floor((nowMs - anchorMs) / intervalMs);
  if (periods <= 0) return { creditedUsd: 0, periodsApplied: 0 };

  periods = Math.min(periods, 52);
  const rate = periodRateFromApy();
  let principal = baseUsd;
  let totalCredit = 0;
  for (let i = 0; i < periods; i++) {
    const interest = Math.round(principal * rate * 100) / 100;
    if (interest > 0) totalCredit += interest;
    principal += interest;
  }
  if (totalCredit <= 0) {
    await pool.query(`UPDATE users SET portfolio_yield_last_accrual_at = NOW() WHERE id = $1::uuid`, [userId]);
    return { creditedUsd: 0, periodsApplied: periods };
  }

  const creditStr = totalCredit.toFixed(2);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO wallets (user_id, currency, balance)
       VALUES ($1::uuid, 'USDT', 0)
       ON CONFLICT (user_id, currency) DO NOTHING`,
      [userId],
    );
    await client.query(
      `UPDATE wallets
       SET balance = balance + $3::numeric
       WHERE user_id = $1::uuid AND currency = 'USDT'`,
      [userId, "USDT", creditStr],
    );
    await client.query(
      `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
       VALUES ($1::uuid, 'USDT', 'credit', $2::numeric, 'portfolio_yield_accrual', 'system', NULL)`,
      [userId, creditStr],
    );
    await client.query(
      `UPDATE users
       SET portfolio_yield_last_accrual_at = $2::timestamptz
       WHERE id = $1::uuid`,
      [userId, new Date(anchorMs + periods * intervalMs)],
    );
    await client.query("COMMIT");
    return { creditedUsd: totalCredit, periodsApplied: periods };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
