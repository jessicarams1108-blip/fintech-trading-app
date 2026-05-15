import type { PoolClient } from "pg";
import { pool } from "../index.js";

export async function sumActiveBorrowUsd(userId: string): Promise<number> {
  try {
    const { rows } = await pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(principal_usd + interest_accrued_usd), 0)::text AS total
       FROM borrow_positions
       WHERE user_id = $1::uuid AND status = 'active'`,
      [userId],
    );
    const n = Number.parseFloat(rows[0]?.total ?? "0");
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  } catch {
    return 0;
  }
}

export type BorrowPositionRow = {
  id: string;
  asset: string;
  principal_usd: string;
  rate_mode: string;
  variable_apr: string;
  stable_apr: string;
  interest_accrued_usd: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export async function listBorrowPositions(userId: string, limit = 50): Promise<BorrowPositionRow[]> {
  try {
    const { rows } = await pool.query<BorrowPositionRow>(
      `SELECT id, asset,
            principal_usd::text,
            rate_mode,
            variable_apr::text,
            stable_apr::text,
            interest_accrued_usd::text,
            status,
            created_at,
            updated_at
     FROM borrow_positions
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT $2`,
      [userId, limit],
    );
    return rows;
  } catch {
    return [];
  }
}

/** Accrue simple interest since updated_at (continuous), then stamp updated_at. */
export async function touchBorrowAccrual(userId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE borrow_positions
     SET interest_accrued_usd = interest_accrued_usd + principal_usd * (
         CASE WHEN rate_mode = 'stable' THEN stable_apr ELSE variable_apr END
       ) / 100.0 / 86400.0 * EXTRACT(EPOCH FROM (NOW() - updated_at)),
         updated_at = NOW()
     WHERE user_id = $1::uuid AND status = 'active'`,
      [userId],
    );
  } catch {
    /* table may not exist yet */
  }
}

export async function createBorrowPosition(input: {
  userId: string;
  asset: string;
  principalUsd: number;
  rateMode: "variable" | "stable";
  variableApr: number;
  stableApr: number;
}): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO borrow_positions (
       user_id, asset, principal_usd, rate_mode, variable_apr, stable_apr, interest_accrued_usd, status
     ) VALUES ($1::uuid, $2::text, $3::numeric, $4::text, $5::numeric, $6::numeric, 0, 'active')
     RETURNING id`,
    [
      input.userId,
      input.asset,
      input.principalUsd,
      input.rateMode,
      input.variableApr,
      input.stableApr,
    ],
  );
  return rows[0]!.id;
}

export type BorrowDisburseInput = {
  userId: string;
  asset: string;
  principalUsd: number;
  rateMode: "variable" | "stable";
  variableApr: number;
  stableApr: number;
};

/** Use inside an outer transaction (caller owns BEGIN/COMMIT). */
export async function executeBorrowDisburseInTransaction(
  client: PoolClient,
  input: BorrowDisburseInput,
): Promise<{ positionId: string }> {
  const amt = String(input.principalUsd);
  const ins = await client.query<{ id: string }>(
    `INSERT INTO borrow_positions (
       user_id, asset, principal_usd, rate_mode, variable_apr, stable_apr, interest_accrued_usd, status
     ) VALUES ($1::uuid, $2::text, $3::numeric, $4::text, $5::numeric, $6::numeric, 0, 'active')
     RETURNING id`,
    [
      input.userId,
      input.asset,
      input.principalUsd,
      input.rateMode,
      input.variableApr,
      input.stableApr,
    ],
  );
  const positionId = ins.rows[0]!.id;
  await client.query(
    `INSERT INTO wallets (user_id, currency, balance)
     VALUES ($1::uuid, $2::text, $3::numeric)
     ON CONFLICT (user_id, currency)
     DO UPDATE SET balance = wallets.balance + EXCLUDED.balance`,
    [input.userId, input.asset, amt],
  );
  await client.query(
    `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
     VALUES ($1::uuid, $2::text, 'credit', $3::numeric, 'borrow_disburse', 'borrow', $4::uuid)`,
    [input.userId, input.asset, amt, positionId],
  );
  return { positionId };
}

export async function executeBorrowDisburse(input: BorrowDisburseInput): Promise<{ positionId: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await executeBorrowDisburseInTransaction(client, input);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function getBorrowPositionForUser(positionId: string, userId: string) {
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    asset: string;
    principal_usd: string;
    interest_accrued_usd: string;
    status: string;
    rate_mode: string;
  }>(
    `SELECT id, user_id, asset, principal_usd::text, interest_accrued_usd::text, status, rate_mode
     FROM borrow_positions
     WHERE id = $1::uuid AND user_id = $2::uuid`,
    [positionId, userId],
  );
  return rows[0] ?? null;
}

export async function executeRepayUsd(input: {
  userId: string;
  positionId: string;
  payUsd: number;
  asset: string;
}): Promise<{ closed: boolean }> {
  const pay = String(input.payUsd);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deb = await client.query(
      `UPDATE wallets SET balance = balance - $3::numeric
       WHERE user_id = $1::uuid AND currency = $2::text AND balance >= $3::numeric
       RETURNING balance`,
      [input.userId, input.asset, pay],
    );
    if (deb.rowCount !== 1) {
      throw new Error("Insufficient wallet balance to repay");
    }

    const pos = await client.query<{
      id: string;
      principal_usd: string;
      interest_accrued_usd: string;
      status: string;
    }>(
      `SELECT id, principal_usd::text, interest_accrued_usd::text, status
       FROM borrow_positions
       WHERE id = $1::uuid AND user_id = $2::uuid FOR UPDATE`,
      [input.positionId, input.userId],
    );
    const row = pos.rows[0];
    if (!row || row.status !== "active") {
      throw new Error("Borrow position not active");
    }
    let interest = Number.parseFloat(row.interest_accrued_usd);
    let principal = Number.parseFloat(row.principal_usd);
    let remaining = input.payUsd;
    const toInterest = Math.min(remaining, interest);
    interest -= toInterest;
    remaining -= toInterest;
    const toPrincipal = Math.min(remaining, principal);
    principal -= toPrincipal;
    remaining -= toPrincipal;

    if (principal <= 0.000001) {
      await client.query(
        `UPDATE borrow_positions
         SET principal_usd = 0, interest_accrued_usd = GREATEST(0, $2::numeric), status = 'closed', updated_at = NOW()
         WHERE id = $1::uuid`,
        [input.positionId, interest],
      );
    } else {
      await client.query(
        `UPDATE borrow_positions
         SET principal_usd = $2::numeric,
             interest_accrued_usd = $3::numeric,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [input.positionId, principal, interest],
      );
    }

    await client.query(
      `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
       VALUES ($1::uuid, $2::text, 'debit', $3::numeric, 'borrow_repay', 'borrow', $4::uuid)`,
      [input.userId, input.asset, pay, input.positionId],
    );

    await client.query("COMMIT");
    return { closed: principal <= 0.000001 };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
