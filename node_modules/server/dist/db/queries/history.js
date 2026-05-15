import { pool } from "../index.js";
import { isPgUndefinedColumn } from "../../lib/pgErrors.js";
export async function listUnifiedHistory(userId, opts) {
    const limit = Math.min(100, Math.max(1, opts.limit));
    const offset = Math.max(0, opts.offset);
    const filter = (opts.type ?? "all").toLowerCase();
    const entries = [];
    const { rows: ledgerRows } = await pool.query(`SELECT id::text, created_at, currency, direction::text, amount::text, reason, ref_type
     FROM ledger_entries
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 400`, [userId]);
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
        const { rows: depRows } = await pool.query(`SELECT id::text, created_at, asset, status::text, tx_hash,
              credited_amount::text,
              declared_amount_usd::text
       FROM deposits
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`, [userId]);
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
    }
    catch (err) {
        if (!isPgUndefinedColumn(err))
            throw err;
        const { rows: depRows } = await pool.query(`SELECT id::text, created_at, asset, status::text, tx_hash, credited_amount::text
       FROM deposits
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`, [userId]);
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
        const { rows: wdRows } = await pool.query(`SELECT id::text, created_at, asset, amount::text, status, destination
       FROM withdrawal_requests
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`, [userId]);
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
    }
    catch {
        /* withdrawal_requests missing */
    }
    try {
        const { rows: brRows } = await pool.query(`SELECT id::text, created_at, asset, principal_usd::text, status
       FROM borrow_positions
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`, [userId]);
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
    }
    catch {
        /* borrow_positions missing */
    }
    try {
        const { rows: brqRows } = await pool.query(`SELECT id::text, created_at, asset, amount_usd::text, status::text
       FROM borrow_requests
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`, [userId]);
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
    }
    catch {
        /* borrow_requests missing */
    }
    try {
        const { rows: trRows } = await pool.query(`SELECT id::text, created_at, asset, amount::text, status::text,
              from_user_id::text, to_user_id::text
       FROM transfer_requests
       WHERE from_user_id = $1::uuid OR to_user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`, [userId]);
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
    }
    catch {
        /* transfer_requests missing */
    }
    entries.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    let filtered = entries;
    if (filter !== "all") {
        filtered = entries.filter((e) => e.type === filter);
    }
    return filtered.slice(offset, offset + limit);
}
