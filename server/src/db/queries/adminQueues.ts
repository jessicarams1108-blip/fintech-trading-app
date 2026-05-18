import { getUsdPrices } from "../../lib/market.js";
import { isPgCheckViolation } from "../../lib/pgErrors.js";
import { pool } from "../index.js";
import { executeBorrowDisburseInTransaction } from "./borrow.js";
import { syncHoldingsFromWallets } from "./portfolio.js";
import { internalTransferInTransaction } from "./transfers.js";

import { SUPPORTED_WALLET_CURRENCY_SET } from "../../lib/walletAssets.js";

export async function sumPendingBorrowUsdForUser(userId: string): Promise<number> {
  try {
    const { rows } = await pool.query<{ t: string | null }>(
      `SELECT COALESCE(SUM(amount_usd), 0)::text AS t
       FROM borrow_requests
       WHERE user_id = $1::uuid AND status = 'pending_admin'`,
      [userId],
    );
    const n = Number.parseFloat(rows[0]?.t ?? "0");
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  } catch {
    return 0;
  }
}

export async function insertBorrowRequest(input: {
  userId: string;
  asset: string;
  amountUsd: number;
  rateMode: "variable" | "stable";
  variableApr: number;
  stableApr: number;
}): Promise<{ id: string }> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO borrow_requests (
       user_id, asset, amount_usd, rate_mode, variable_apr, stable_apr, status
     ) VALUES ($1::uuid, $2::text, $3::numeric, $4::text, $5::numeric, $6::numeric, 'pending_admin')
     RETURNING id`,
    [
      input.userId,
      input.asset,
      input.amountUsd,
      input.rateMode,
      input.variableApr,
      input.stableApr,
    ],
  );
  return { id: rows[0]!.id };
}

export type BorrowRequestRow = {
  id: string;
  asset: string;
  amount_usd: string;
  rate_mode: string;
  variable_apr: string;
  stable_apr: string;
  status: string;
  created_at: Date;
};

export async function listBorrowRequestsForUser(userId: string, limit = 50): Promise<BorrowRequestRow[]> {
  try {
    const { rows } = await pool.query<BorrowRequestRow>(
      `SELECT id, asset, amount_usd::text, rate_mode, variable_apr::text, stable_apr::text, status, created_at
       FROM borrow_requests
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

export type BorrowRequestAdminRow = BorrowRequestRow & { user_email: string; user_id: string };

export async function listPendingBorrowRequestsAdmin(): Promise<BorrowRequestAdminRow[]> {
  try {
    const { rows } = await pool.query<BorrowRequestAdminRow>(
      `SELECT br.id, br.user_id, u.email AS user_email, br.asset, br.amount_usd::text, br.rate_mode,
            br.variable_apr::text, br.stable_apr::text, br.status, br.created_at
     FROM borrow_requests br
     JOIN users u ON u.id = br.user_id
     WHERE br.status = 'pending_admin'
     ORDER BY br.created_at ASC`,
    );
    return rows;
  } catch {
    return [];
  }
}

export async function approveBorrowRequestAdmin(input: {
  requestId: string;
  adminUserId: string;
}): Promise<{ ok: true; positionId: string } | { ok: false; error: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query<{
      id: string;
      user_id: string;
      asset: string;
      amount_usd: string;
      rate_mode: string;
      variable_apr: string;
      stable_apr: string;
      status: string;
    }>(
      `SELECT id, user_id, asset, amount_usd::text, rate_mode, variable_apr::text, stable_apr::text, status
       FROM borrow_requests
       WHERE id = $1::uuid
       FOR UPDATE`,
      [input.requestId],
    );
    const row = r.rows[0];
    if (!row || row.status !== "pending_admin") {
      await client.query("ROLLBACK");
      return { ok: false, error: "Borrow request not found or not pending" };
    }
    const principalUsd = Number.parseFloat(row.amount_usd);
    if (!Number.isFinite(principalUsd) || principalUsd <= 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Invalid amount on borrow request" };
    }
    const { positionId } = await executeBorrowDisburseInTransaction(client, {
      userId: row.user_id,
      asset: row.asset,
      principalUsd,
      rateMode: row.rate_mode === "stable" ? "stable" : "variable",
      variableApr: Number.parseFloat(row.variable_apr),
      stableApr: Number.parseFloat(row.stable_apr),
    });
    await client.query(
      `UPDATE borrow_requests
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = $2::uuid
       WHERE id = $1::uuid`,
      [row.id, input.adminUserId],
    );
    await client.query("COMMIT");
    return { ok: true, positionId };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = e instanceof Error ? e.message : "Borrow approve failed";
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}

export async function rejectBorrowRequestAdmin(input: {
  requestId: string;
  adminUserId: string;
  reason: string;
}): Promise<boolean> {
  const res = await pool.query(
    `UPDATE borrow_requests
     SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $2::uuid, admin_notes = $3::text
     WHERE id = $1::uuid AND status = 'pending_admin'`,
    [input.requestId, input.adminUserId, input.reason.trim()],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function insertTransferRequest(input: {
  fromUserId: string;
  toUserId: string;
  asset: string;
  amount: string;
}): Promise<{ id: string }> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO transfer_requests (from_user_id, to_user_id, asset, amount, status)
     VALUES ($1::uuid, $2::uuid, $3::text, $4::numeric, 'pending_admin')
     RETURNING id`,
    [input.fromUserId, input.toUserId, input.asset, input.amount],
  );
  return { id: rows[0]!.id };
}

export type TransferRequestRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  asset: string;
  amount: string;
  status: string;
  created_at: Date;
};

export async function listTransferRequestsForUser(userId: string, limit = 40): Promise<TransferRequestRow[]> {
  try {
    const { rows } = await pool.query<TransferRequestRow>(
      `SELECT id, from_user_id, to_user_id, asset, amount::text, status, created_at
       FROM transfer_requests
       WHERE from_user_id = $1::uuid OR to_user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows;
  } catch {
    return [];
  }
}

export type TransferRequestAdminRow = TransferRequestRow & { from_email: string; to_email: string };

export async function listPendingTransferRequestsAdmin(): Promise<TransferRequestAdminRow[]> {
  try {
    const { rows } = await pool.query<TransferRequestAdminRow>(
      `SELECT tr.id, tr.from_user_id, tr.to_user_id, tr.asset, tr.amount::text, tr.status, tr.created_at,
            u1.email AS from_email, u2.email AS to_email
     FROM transfer_requests tr
     JOIN users u1 ON u1.id = tr.from_user_id
     JOIN users u2 ON u2.id = tr.to_user_id
     WHERE tr.status = 'pending_admin'
     ORDER BY tr.created_at ASC`,
    );
    return rows;
  } catch {
    return [];
  }
}

export async function approveTransferRequestAdmin(input: {
  requestId: string;
  adminUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query<{
      id: string;
      from_user_id: string;
      to_user_id: string;
      asset: string;
      amount: string;
      status: string;
    }>(
      `SELECT id, from_user_id, to_user_id, asset, amount::text, status
       FROM transfer_requests
       WHERE id = $1::uuid
       FOR UPDATE`,
      [input.requestId],
    );
    const row = r.rows[0];
    if (!row || row.status !== "pending_admin") {
      await client.query("ROLLBACK");
      return { ok: false, error: "Transfer request not found or not pending" };
    }
    await internalTransferInTransaction(client, {
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      asset: row.asset,
      amount: row.amount,
    });
    await client.query(
      `UPDATE transfer_requests
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = $2::uuid
       WHERE id = $1::uuid`,
      [row.id, input.adminUserId],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = e instanceof Error ? e.message : "Transfer approve failed";
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}

export async function rejectTransferRequestAdmin(input: {
  requestId: string;
  adminUserId: string;
  reason: string;
}): Promise<boolean> {
  const res = await pool.query(
    `UPDATE transfer_requests
     SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $2::uuid, admin_notes = $3::text
     WHERE id = $1::uuid AND status = 'pending_admin'`,
    [input.requestId, input.adminUserId, input.reason.trim()],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function adminAdjustWalletBalance(input: {
  userId: string;
  asset: string;
  delta: string;
  adminUserId: string;
  note?: string;
}): Promise<
  | { ok: true; newBalance: string; appliedDelta: string; debitClamped: boolean }
  | { ok: false; error: string }
> {
  const asset = input.asset.trim().toUpperCase();
  if (!SUPPORTED_WALLET_CURRENCY_SET.has(asset)) {
    return {
      ok: false,
      error: `Unsupported wallet currency "${input.asset.trim()}". Allowed: ${[...SUPPORTED_WALLET_CURRENCY_SET].sort().join(", ")}`,
    };
  }
  const delta = input.delta.trim().replace(/^\+/, "");
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(delta)) {
    return { ok: false, error: "delta must be a number (e.g. 100, -50, or +25)" };
  }
  const deltaNum = Number.parseFloat(delta);
  if (!Number.isFinite(deltaNum) || deltaNum === 0) {
    return { ok: false, error: "delta must be a non-zero number" };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO wallets (user_id, currency, balance)
       VALUES ($1::uuid, $2::text, 0)
       ON CONFLICT (user_id, currency) DO NOTHING`,
      [input.userId, asset],
    );
    const locked = await client.query<{ b: string }>(
      `SELECT balance::text AS b
       FROM wallets
       WHERE user_id = $1::uuid AND currency = $2::text
       FOR UPDATE`,
      [input.userId, asset],
    );
    if (locked.rowCount !== 1) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Wallet row missing after insert" };
    }
    const oldBal = locked.rows[0]!.b;
    const appliedRow = await client.query<{ applied: string; was_clamped: boolean }>(
      `SELECT (
         CASE
           WHEN ($1::numeric + $2::numeric) < 0 THEN (-($1::numeric))::text
           ELSE ($2::numeric)::text
         END
       ) AS applied,
       (($1::numeric + $2::numeric) < 0) AS was_clamped`,
      [oldBal, delta],
    );
    const appliedStr = appliedRow.rows[0]!.applied.trim();
    const wasClamped = appliedRow.rows[0]!.was_clamped;
    const appliedNum = Number.parseFloat(appliedStr);
    if (deltaNum < 0 && (!Number.isFinite(appliedNum) || appliedNum === 0)) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: `Insufficient ${asset} balance to debit (available: ${oldBal} ${asset}).`,
      };
    }
    const upd = await client.query<{ b: string }>(
      `UPDATE wallets
       SET balance = balance + $3::numeric
       WHERE user_id = $1::uuid AND currency = $2::text
       RETURNING balance::text AS b`,
      [input.userId, asset, appliedStr],
    );
    if (upd.rowCount !== 1) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Balance update failed unexpectedly" };
    }
    const newBal = upd.rows[0]!.b;
    const dir = appliedNum >= 0 ? "credit" : "debit";
    const ledgerAmt = appliedStr.startsWith("-") ? appliedStr.slice(1) : appliedStr;
    await client.query(
      `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
       VALUES ($1::uuid, $2::text, $3::ledger_direction, $4::numeric, 'balance_adjust', 'system', NULL)`,
      [input.userId, asset, dir, ledgerAmt],
    );
    void input.adminUserId;
    void input.note;
    await client.query("COMMIT");
    try {
      const prices = await getUsdPrices();
      await syncHoldingsFromWallets(input.userId, prices);
    } catch {
      /* portfolio table optional; wallet is source of truth */
    }
    return { ok: true, newBalance: newBal, appliedDelta: appliedStr, debitClamped: wasClamped };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    if (isPgCheckViolation(e)) {
      return { ok: false, error: "Invalid currency for wallet (database check failed)." };
    }
    const msg = e instanceof Error ? e.message : "Balance adjustment failed";
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}
