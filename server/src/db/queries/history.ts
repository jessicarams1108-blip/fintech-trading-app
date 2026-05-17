import { pool } from "../index.js";
import { isPgUndefinedColumn } from "../../lib/pgErrors.js";

export type HistoryEntry = {
  id: string;
  at: string;
  type: string;
  asset: string | null;
  amount: string | null;
  direction: string | null;
  status: string;
  detail: string | null;
};

export async function listUnifiedHistory(
  userId: string,
  opts: { type?: string; limit: number; offset: number },
): Promise<HistoryEntry[]> {
  const limit = Math.min(100, Math.max(1, opts.limit));
  const offset = Math.max(0, opts.offset);
  const filter = (opts.type ?? "all").toLowerCase();

  const entries: HistoryEntry[] = [];

  const { rows: ledgerRows } = await pool.query<{
    id: string;
    created_at: Date;
    currency: string;
    direction: string;
    amount: string;
    reason: string;
    ref_type: string;
  }>(
    `SELECT id::text, created_at, currency, direction::text, amount::text, reason, ref_type
     FROM ledger_entries
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 400`,
    [userId],
  );
  for (const r of ledgerRows) {
    entries.push({
      id: `le:${r.id}`,
      at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      type: r.ref_type || "ledger",
      asset: r.currency,
      amount: r.amount,
      direction: r.direction,
      status: "completed",
      detail: r.reason,
    });
  }

  try {
    const { rows: depRows } = await pool.query<{
      id: string;
      created_at: Date;
      asset: string;
      status: string;
      tx_hash: string;
      credited_amount: string | null;
      declared_amount_usd: string | null;
    }>(
      `SELECT id::text, created_at, asset, status::text, tx_hash,
              credited_amount::text,
              declared_amount_usd::text
       FROM deposits
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId],
    );
    for (const r of depRows) {
      const amt = r.credited_amount ?? r.declared_amount_usd;
      entries.push({
        id: `dep:${r.id}`,
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        type: "deposit",
        asset: r.asset,
        amount: amt,
        direction: "credit",
        status: r.status,
        detail: r.credited_amount ? r.tx_hash : `${r.tx_hash} · declared $${r.declared_amount_usd ?? "?"} USD`,
      });
    }
  } catch (err) {
    if (!isPgUndefinedColumn(err)) throw err;
    const { rows: depRows } = await pool.query<{
      id: string;
      created_at: Date;
      asset: string;
      status: string;
      tx_hash: string;
      credited_amount: string | null;
    }>(
      `SELECT id::text, created_at, asset, status::text, tx_hash, credited_amount::text
       FROM deposits
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId],
    );
    for (const r of depRows) {
      entries.push({
        id: `dep:${r.id}`,
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        type: "deposit",
        asset: r.asset,
        amount: r.credited_amount,
        direction: "credit",
        status: r.status,
        detail: r.tx_hash,
      });
    }
  }

  try {
    const { rows: wdRows } = await pool.query<{
      id: string;
      created_at: Date;
      asset: string;
      amount: string;
      status: string;
      destination: string;
    }>(
      `SELECT id::text, created_at, asset, amount::text, status, destination
       FROM withdrawal_requests
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId],
    );
    for (const r of wdRows) {
      entries.push({
        id: `wd:${r.id}`,
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        type: "withdrawal",
        asset: r.asset,
        amount: r.amount,
        direction: "debit",
        status: r.status,
        detail: r.destination,
      });
    }
  } catch {
    /* withdrawal_requests missing */
  }

  try {
    const { rows: brRows } = await pool.query<{
      id: string;
      created_at: Date;
      asset: string;
      principal_usd: string;
      status: string;
    }>(
      `SELECT id::text, created_at, asset, principal_usd::text, status
       FROM borrow_positions
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId],
    );
    for (const r of brRows) {
      entries.push({
        id: `br:${r.id}`,
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        type: "borrow",
        asset: r.asset,
        amount: r.principal_usd,
        direction: "credit",
        status: r.status,
        detail: null,
      });
    }
  } catch {
    /* borrow_positions missing */
  }

  try {
    const { rows: brqRows } = await pool.query<{
      id: string;
      created_at: Date;
      asset: string;
      amount_usd: string;
      status: string;
    }>(
      `SELECT id::text, created_at, asset, amount_usd::text, status::text
       FROM borrow_requests
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId],
    );
    for (const r of brqRows) {
      entries.push({
        id: `brq:${r.id}`,
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        type: "borrow_request",
        asset: r.asset,
        amount: r.amount_usd,
        direction: "request",
        status: r.status,
        detail: "Borrow request — operator approval",
      });
    }
  } catch {
    /* borrow_requests missing */
  }

  try {
    const { rows: trRows } = await pool.query<{
      id: string;
      created_at: Date;
      asset: string;
      amount: string;
      status: string;
      from_user_id: string;
      to_user_id: string;
    }>(
      `SELECT id::text, created_at, asset, amount::text, status::text,
              from_user_id::text, to_user_id::text
       FROM transfer_requests
       WHERE from_user_id = $1::uuid OR to_user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`,
      [userId],
    );
    for (const r of trRows) {
      const outbound = r.from_user_id === userId;
      entries.push({
        id: `tr:${r.id}`,
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        type: "transfer",
        asset: r.asset,
        amount: r.amount,
        direction: outbound ? "send" : "receive",
        status: r.status,
        detail: outbound ? "Internal send (queued or settled)" : "Internal receive (queued or settled)",
      });
    }
  } catch {
    /* transfer_requests missing */
  }

  try {
    const { rows: fsRows } = await pool.query<{
      id: string;
      created_at: Date;
      amount: string;
      status: string;
      days: number;
      plan_name: string;
      goal_name: string | null;
    }>(
      `SELECT s.id::text, s.created_at, s.amount::text, s.status, s.days, p.name AS plan_name, s.goal_name
       FROM fixed_savings_subscriptions s
       JOIN fixed_savings_plans p ON p.id = s.plan_id
       WHERE s.user_id = $1::uuid
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [userId],
    );
    for (const r of fsRows) {
      entries.push({
        id: `fs:${r.id}`,
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        type: "fixed_savings",
        asset: "USD",
        amount: r.amount,
        direction: "lock",
        status: r.status,
        detail: r.goal_name ? `${r.plan_name} · ${r.goal_name}` : r.plan_name,
      });
    }
  } catch {
    /* fixed savings tables missing */
  }

  try {
    const { rows: idRows } = await pool.query<{
      id: string;
      created_at: Date;
      status: string;
    }>(
      `SELECT id::text, created_at, status::text
       FROM identity_verification_submissions
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    );
    for (const r of idRows) {
      entries.push({
        id: `idv:${r.id}`,
        at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        type: "identity",
        asset: null,
        amount: null,
        direction: null,
        status: r.status,
        detail: "Identity verification",
      });
    }
  } catch {
    /* identity table missing */
  }

  entries.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  let filtered = entries;
  if (filter !== "all") {
    filtered = entries.filter((e) => e.type === filter);
  }

  return filtered.slice(offset, offset + limit);
}
