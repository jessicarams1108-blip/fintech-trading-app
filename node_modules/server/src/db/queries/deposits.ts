import type { DepositAsset, PendingDepositDto } from "../../types/deposit.js";
import { pool } from "../index.js";
import { isPgUndefinedColumn } from "../../lib/pgErrors.js";

export type { DepositAsset };

type DepositRow = {
  id: string;
  user_id: string;
  user_email: string;
  asset: string;
  tx_hash: string;
  proof_image_url: string | null;
  declared_amount_usd: string | null;
  created_at: Date | string;
  status: PendingDepositDto["status"];
  credited_amount: string | null;
};

function mapPending(row: DepositRow): PendingDepositDto {
  return {
    id: row.id,
    userEmail: row.user_email,
    asset: row.asset as PendingDepositDto["asset"],
    amount: row.credited_amount,
    declaredAmountUsd: row.declared_amount_usd,
    txHash: row.tx_hash,
    proofImageUrl: row.proof_image_url,
    createdAt:
      typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString(),
    status: row.status,
  };
}

/** Inserts deposit with status pending_review — duplicates TX hash prevented while not rejected. */
export async function insertDeposit(input: {
  userId: string;
  asset: DepositAsset;
  txHash: string;
  proofImageUrl: string | null;
  declaredAmountUsd: number;
}): Promise<PendingDepositDto> {
  const dup = await pool.query(
    `SELECT 1 FROM deposits
     WHERE lower(tx_hash) = lower($1::text)
       AND status <> 'rejected'
     LIMIT 1`,
    [input.txHash],
  );
  if (dup.rows.length > 0) {
    throw new Error("TX hash already submitted");
  }

  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    email: string;
    asset: string;
    tx_hash: string;
    proof_image_url: string | null;
    declared_amount_usd: string | null;
    created_at: Date;
    status: PendingDepositDto["status"];
    credited_amount: string | null;
  }>(
    `INSERT INTO deposits (user_id, asset, tx_hash, proof_image_url, declared_amount_usd, status)
     VALUES ($1::uuid, $2::text, $3::text, $4::text, $5::numeric, 'pending_review')
     RETURNING
       deposits.id,
       deposits.user_id,
       (SELECT email FROM users WHERE users.id = deposits.user_id) AS email,
       deposits.asset,
       deposits.tx_hash,
       deposits.proof_image_url,
       deposits.declared_amount_usd::text AS declared_amount_usd,
       deposits.created_at,
       deposits.status,
       deposits.credited_amount`,
    [input.userId, input.asset, input.txHash, input.proofImageUrl, input.declaredAmountUsd],
  );

  const row = rows[0]!;
  return mapPending({
    id: row.id,
    user_id: row.user_id,
    user_email: row.email,
    asset: row.asset,
    tx_hash: row.tx_hash,
    proof_image_url: row.proof_image_url,
    declared_amount_usd: row.declared_amount_usd,
    created_at: row.created_at,
    status: row.status,
    credited_amount: row.credited_amount,
  });
}

/** Lists deposits awaiting ops review joined with owning user emails. */
export async function getPendingDeposits(): Promise<PendingDepositDto[]> {
  const run = async (includeDeclared: boolean): Promise<PendingDepositDto[]> => {
    const declaredSql = includeDeclared
      ? "d.declared_amount_usd::text AS declared_amount_usd"
      : "NULL::text AS declared_amount_usd";
    const { rows } = await pool.query<DepositRow>(
      `SELECT
         d.id,
         d.user_id,
         u.email AS user_email,
         d.asset,
         d.tx_hash,
         d.proof_image_url,
         ${declaredSql},
         d.created_at,
         d.status,
         d.credited_amount::text AS credited_amount
       FROM deposits d
       JOIN users u ON u.id = d.user_id
       WHERE d.status::text = 'pending_review'
       ORDER BY d.created_at DESC`,
    );
    return rows.map(mapPending);
  };

  try {
    return await run(true);
  } catch (err) {
    if (isPgUndefinedColumn(err)) {
      return run(false);
    }
    throw err;
  }
}

export async function getDepositById(depositId: string) {
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    asset: string;
    credited_amount: string | null;
    status: PendingDepositDto["status"];
    tx_hash: string;
  }>(
    `SELECT id, user_id, asset, credited_amount, status, tx_hash
     FROM deposits
     WHERE id = $1::uuid`,
    [depositId],
  );
  const row = rows[0];
  return row ?? null;
}

export type DepositActivityDto = {
  id: string;
  asset: DepositAsset;
  txHash: string;
  status: PendingDepositDto["status"];
  declaredAmountUsd: string | null;
  creditedAmount: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export async function listUserDepositActivity(userId: string, limit = 50): Promise<DepositActivityDto[]> {
  const run = async (includeDeclared: boolean): Promise<DepositActivityDto[]> => {
    const declaredCol = includeDeclared
      ? "declared_amount_usd::text AS declared_amount_usd"
      : "NULL::text AS declared_amount_usd";
    const { rows } = await pool.query<{
      id: string;
      asset: string;
      tx_hash: string;
      status: PendingDepositDto["status"];
      declared_amount_usd: string | null;
      credited_amount: string | null;
      created_at: Date;
      reviewed_at: Date | null;
    }>(
      `SELECT id, asset, tx_hash, status,
              ${declaredCol},
              credited_amount::text AS credited_amount,
              created_at, reviewed_at
       FROM deposits
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      asset: r.asset as DepositAsset,
      txHash: r.tx_hash,
      status: r.status,
      declaredAmountUsd: r.declared_amount_usd,
      creditedAmount: r.credited_amount,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      reviewedAt: r.reviewed_at
        ? r.reviewed_at instanceof Date
          ? r.reviewed_at.toISOString()
          : String(r.reviewed_at)
        : null,
    }));
  };

  try {
    return await run(true);
  } catch (err) {
    if (isPgUndefinedColumn(err)) {
      return run(false);
    }
    throw err;
  }
}

/**
 * Credits user wallet, inserts ledger marker, audits admin action atomically.
 * Ledger: direction credit, positive amount, ref_type 'deposit'.
 */
export async function confirmDeposit(input: {
  depositId: string;
  creditedAmount: string;
  adminUserId: string;
  notes?: string;
}) {
  const adminNotes =
    typeof input.notes === "string" && input.notes.trim().length > 0
      ? input.notes.trim()
      : "confirmed programmatically";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const depositResult = await client.query<{
      id: string;
      user_id: string;
      asset: string;
      tx_hash: string;
    }>(
      `UPDATE deposits
       SET status = 'confirmed',
           credited_amount = $2::numeric,
           reviewed_at = NOW(),
           reviewed_by = $3::uuid,
           admin_notes = $4::text
       WHERE id = $1::uuid
         AND status = 'pending_review'
       RETURNING id, user_id, asset, tx_hash`,
      [input.depositId, input.creditedAmount, input.adminUserId, adminNotes],
    );

    if (depositResult.rowCount !== 1) {
      await client.query("ROLLBACK");
      throw new Error("Deposit not pending or missing");
    }

    const deposit = depositResult.rows[0]!;

    await client.query(
      `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
       VALUES ($1::uuid, $2::text, 'credit', $3::numeric, $4::text, 'deposit', $5::uuid)`,
      [
        deposit.user_id,
        deposit.asset,
        input.creditedAmount,
        "deposit",
        deposit.id,
      ],
    );

    await client.query(
      `INSERT INTO wallets (user_id, currency, balance)
       VALUES ($1::uuid, $2::text, $3::numeric)
       ON CONFLICT (user_id, currency)
       DO UPDATE SET balance = wallets.balance + EXCLUDED.balance`,
      [deposit.user_id, deposit.asset, input.creditedAmount],
    );

    await client.query(
      `INSERT INTO admin_audit_log (admin_id, action, payload)
       VALUES ($1::uuid, $2::text, $3::jsonb)`,
      [
        input.adminUserId,
        "deposit_confirm",
        JSON.stringify({
          depositId: deposit.id,
          userId: deposit.user_id,
          asset: deposit.asset,
          creditedAmount: input.creditedAmount,
          txHash: deposit.tx_hash,
        }),
      ],
    );

    await client.query("COMMIT");
    return deposit;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectDeposit(input: {
  depositId: string;
  reason: string;
  adminUserId: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const dep = await client.query<{ id: string; user_id: string; asset: string; tx_hash: string }>(
      `UPDATE deposits
       SET status = 'rejected',
           admin_notes = $2::text,
           reviewed_at = NOW(),
           reviewed_by = $3::uuid
       WHERE id = $1::uuid
         AND status = 'pending_review'
       RETURNING id, user_id, asset, tx_hash`,
      [input.depositId, input.reason, input.adminUserId],
    );

    if (dep.rowCount !== 1) {
      await client.query("ROLLBACK");
      throw new Error("Deposit not pending or missing");
    }

    const deposit = dep.rows[0]!;

    await client.query(
      `INSERT INTO admin_audit_log (admin_id, action, payload)
       VALUES ($1::uuid, $2::text, $3::jsonb)`,
      [
        input.adminUserId,
        "deposit_reject",
        JSON.stringify({
          depositId: deposit.id,
          userId: deposit.user_id,
          asset: deposit.asset,
          txHash: deposit.tx_hash,
          reason: input.reason,
        }),
      ],
    );

    await client.query("COMMIT");
    return deposit;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
