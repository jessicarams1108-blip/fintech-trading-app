import type { PoolClient } from "pg";
import { pool } from "../index.js";

export async function createWithdrawalRequest(input: {
  userId: string;
  asset: string;
  amount: string;
  destination: string;
  feeUsd: number;
}): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO withdrawal_requests (user_id, asset, amount, destination, fee_usd, status)
     VALUES ($1::uuid, $2::text, $3::numeric, $4::text, $5::numeric, 'pending_admin')
     RETURNING id`,
    [input.userId, input.asset, input.amount, input.destination, input.feeUsd],
  );
  return rows[0]!.id;
}

export async function listWithdrawals(userId: string, limit = 50) {
  try {
    const { rows } = await pool.query(
      `SELECT id, asset, amount::text, destination, fee_usd::text, status, created_at::text
     FROM withdrawal_requests
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

export type InternalTransferInput = {
  fromUserId: string;
  toUserId: string;
  asset: string;
  amount: string;
};

/** Caller owns BEGIN/COMMIT. */
export async function internalTransferInTransaction(client: PoolClient, input: InternalTransferInput): Promise<void> {
  const debit = await client.query(
    `UPDATE wallets SET balance = balance - $3::numeric
     WHERE user_id = $1::uuid AND currency = $2::text AND balance >= $3::numeric
     RETURNING balance`,
    [input.fromUserId, input.asset, input.amount],
  );
  if (debit.rowCount !== 1) {
    throw new Error("Insufficient balance");
  }
  await client.query(
    `INSERT INTO wallets (user_id, currency, balance)
     VALUES ($1::uuid, $2::text, $3::numeric)
     ON CONFLICT (user_id, currency)
     DO UPDATE SET balance = wallets.balance + EXCLUDED.balance`,
    [input.toUserId, input.asset, input.amount],
  );
  await client.query(
    `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
     VALUES ($1::uuid, $2::text, 'debit', $3::numeric, 'internal_send', 'transfer', NULL)`,
    [input.fromUserId, input.asset, input.amount],
  );
  await client.query(
    `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
     VALUES ($1::uuid, $2::text, 'credit', $3::numeric, 'internal_receive', 'transfer', NULL)`,
    [input.toUserId, input.asset, input.amount],
  );
}

export async function internalTransfer(input: InternalTransferInput): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await internalTransferInTransaction(client, input);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export type WithdrawalAdminRow = {
  id: string;
  user_id: string;
  user_email: string;
  asset: string;
  amount: string;
  destination: string;
  fee_usd: string;
  status: string;
  admin_notes: string | null;
  created_at: Date;
};

export async function listPendingWithdrawalsAdmin(): Promise<WithdrawalAdminRow[]> {
  try {
    const { rows } = await pool.query<WithdrawalAdminRow>(
      `SELECT w.id, w.user_id, u.email AS user_email, w.asset, w.amount::text, w.destination,
            w.fee_usd::text, w.status, w.admin_notes, w.created_at
     FROM withdrawal_requests w
     JOIN users u ON u.id = w.user_id
     WHERE w.status = 'pending_admin'
     ORDER BY w.created_at ASC`,
    );
    return rows;
  } catch {
    return [];
  }
}

export async function approveWithdrawalAdmin(input: {
  withdrawalId: string;
  adminUserId: string;
  notes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const w = await client.query<{
      id: string;
      user_id: string;
      asset: string;
      amount: string;
      status: string;
    }>(
      `SELECT id, user_id, asset, amount::text, status
       FROM withdrawal_requests
       WHERE id = $1::uuid
       FOR UPDATE`,
      [input.withdrawalId],
    );
    const row = w.rows[0];
    if (!row || row.status !== "pending_admin") {
      await client.query("ROLLBACK");
      return { ok: false, error: "Withdrawal not found or not pending" };
    }
    const deb = await client.query(
      `UPDATE wallets SET balance = balance - $3::numeric
       WHERE user_id = $1::uuid AND currency = $2::text AND balance >= $3::numeric
       RETURNING balance`,
      [row.user_id, row.asset, row.amount],
    );
    if (deb.rowCount !== 1) {
      await client.query("ROLLBACK");
      return { ok: false, error: "User wallet balance insufficient to approve this withdrawal" };
    }
    await client.query(
      `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
       VALUES ($1::uuid, $2::text, 'debit', $3::numeric, 'withdrawal_sent', 'withdrawal', $4::uuid)`,
      [row.user_id, row.asset, row.amount, row.id],
    );
    const note = input.notes?.trim() || null;
    await client.query(
      `UPDATE withdrawal_requests
       SET status = 'completed', reviewed_at = NOW(), admin_notes = COALESCE($2::text, admin_notes)
       WHERE id = $1::uuid`,
      [row.id, note],
    );
    await client.query("COMMIT");
    void input.adminUserId;
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function rejectWithdrawalAdmin(input: {
  withdrawalId: string;
  reason: string;
}): Promise<boolean> {
  const res = await pool.query(
    `UPDATE withdrawal_requests
     SET status = 'rejected', reviewed_at = NOW(), admin_notes = $2::text
     WHERE id = $1::uuid AND status = 'pending_admin'`,
    [input.withdrawalId, input.reason.trim()],
  );
  return (res.rowCount ?? 0) > 0;
}
