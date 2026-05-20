import { pool } from "../index.js";
import { CASHBOX_SPENDABLE_CURRENCIES, cashBoxUsdPrice } from "./liquidity.js";
function isUndefinedColumn(e, column) {
    const msg = e instanceof Error ? e.message : String(e);
    return (new RegExp(column, "i").test(msg) && /(does not exist|undefined column)/i.test(msg));
}
function isAmountUsdColumnMissing(e) {
    return isUndefinedColumn(e, "amount_usd");
}
function isBankColumnMissing(e) {
    return (isUndefinedColumn(e, "method") ||
        isUndefinedColumn(e, "bank_name") ||
        isUndefinedColumn(e, "bank_account_number") ||
        isUndefinedColumn(e, "bank_routing_number"));
}
export async function createWithdrawalRequest(input) {
    const method = input.method ?? "crypto";
    try {
        const { rows } = await pool.query(`INSERT INTO withdrawal_requests (
         user_id, asset, amount, destination, fee_usd, amount_usd, status,
         method, bank_name, bank_account_number, bank_routing_number
       )
       VALUES ($1::uuid, $2::text, $3::numeric, $4::text, $5::numeric, $6::numeric,
               'pending_admin', $7::text, $8::text, $9::text, $10::text)
       RETURNING id`, [
            input.userId,
            input.asset,
            input.amount,
            input.destination,
            input.feeUsd,
            input.amountUsd ?? null,
            method,
            input.bankName ?? null,
            input.bankAccountNumber ?? null,
            input.bankRoutingNumber ?? null,
        ]);
        return rows[0].id;
    }
    catch (e) {
        if (isBankColumnMissing(e)) {
            // Old DB without bank/method columns — fall back to original insert.
            try {
                const { rows } = await pool.query(`INSERT INTO withdrawal_requests (user_id, asset, amount, destination, fee_usd, amount_usd, status)
           VALUES ($1::uuid, $2::text, $3::numeric, $4::text, $5::numeric, $6::numeric, 'pending_admin')
           RETURNING id`, [
                    input.userId,
                    input.asset,
                    input.amount,
                    input.destination,
                    input.feeUsd,
                    input.amountUsd ?? null,
                ]);
                return rows[0].id;
            }
            catch (inner) {
                if (isAmountUsdColumnMissing(inner)) {
                    const { rows } = await pool.query(`INSERT INTO withdrawal_requests (user_id, asset, amount, destination, fee_usd, status)
             VALUES ($1::uuid, $2::text, $3::numeric, $4::text, $5::numeric, 'pending_admin')
             RETURNING id`, [input.userId, input.asset, input.amount, input.destination, input.feeUsd]);
                    return rows[0].id;
                }
                throw inner;
            }
        }
        if (isAmountUsdColumnMissing(e)) {
            const { rows } = await pool.query(`INSERT INTO withdrawal_requests (user_id, asset, amount, destination, fee_usd, status)
         VALUES ($1::uuid, $2::text, $3::numeric, $4::text, $5::numeric, 'pending_admin')
         RETURNING id`, [input.userId, input.asset, input.amount, input.destination, input.feeUsd]);
            return rows[0].id;
        }
        throw e;
    }
}
export async function listWithdrawals(userId, limit = 50) {
    const select = `id, asset, amount::text, amount_usd::text, destination, fee_usd::text, status,
                  method, bank_name, bank_account_number, bank_routing_number,
                  created_at::text, admin_notes`;
    try {
        const { rows } = await pool.query(`SELECT ${select}
     FROM withdrawal_requests
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT $2`, [userId, limit]);
        return rows;
    }
    catch (e) {
        if (isBankColumnMissing(e)) {
            try {
                const { rows } = await pool.query(`SELECT id, asset, amount::text, amount_usd::text, destination, fee_usd::text, status, created_at::text, admin_notes
           FROM withdrawal_requests
           WHERE user_id = $1::uuid
           ORDER BY created_at DESC
           LIMIT $2`, [userId, limit]);
                return rows;
            }
            catch {
                return [];
            }
        }
        if (!isAmountUsdColumnMissing(e))
            return [];
        try {
            const { rows } = await pool.query(`SELECT id, asset, amount::text, destination, fee_usd::text, status, created_at::text
       FROM withdrawal_requests
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2`, [userId, limit]);
            return rows;
        }
        catch {
            return [];
        }
    }
}
/** Caller owns BEGIN/COMMIT. */
export async function internalTransferInTransaction(client, input) {
    const debit = await client.query(`UPDATE wallets SET balance = balance - $3::numeric
     WHERE user_id = $1::uuid AND currency = $2::text AND balance >= $3::numeric
     RETURNING balance`, [input.fromUserId, input.asset, input.amount]);
    if (debit.rowCount !== 1) {
        throw new Error("Insufficient balance");
    }
    await client.query(`INSERT INTO wallets (user_id, currency, balance)
     VALUES ($1::uuid, $2::text, $3::numeric)
     ON CONFLICT (user_id, currency)
     DO UPDATE SET balance = wallets.balance + EXCLUDED.balance`, [input.toUserId, input.asset, input.amount]);
    await client.query(`INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
     VALUES ($1::uuid, $2::text, 'debit', $3::numeric, 'internal_send', 'transfer', NULL)`, [input.fromUserId, input.asset, input.amount]);
    await client.query(`INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
     VALUES ($1::uuid, $2::text, 'credit', $3::numeric, 'internal_receive', 'transfer', NULL)`, [input.toUserId, input.asset, input.amount]);
}
export async function internalTransfer(input) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await internalTransferInTransaction(client, input);
        await client.query("COMMIT");
    }
    catch (e) {
        await client.query("ROLLBACK").catch(() => { });
        throw e;
    }
    finally {
        client.release();
    }
}
export async function listPendingWithdrawalsAdmin() {
    try {
        const { rows } = await pool.query(`SELECT w.id, w.user_id, u.email AS user_email, w.asset, w.amount::text,
              w.amount_usd::text, w.destination, w.fee_usd::text, w.status,
              w.method, w.bank_name, w.bank_account_number, w.bank_routing_number,
              w.admin_notes, w.created_at
       FROM withdrawal_requests w
       JOIN users u ON u.id = w.user_id
       WHERE w.status = 'pending_admin'
       ORDER BY w.created_at ASC`);
        return rows;
    }
    catch (e) {
        if (isBankColumnMissing(e) || isAmountUsdColumnMissing(e)) {
            try {
                const { rows } = await pool.query(`SELECT w.id, w.user_id, u.email AS user_email, w.asset, w.amount::text, w.destination,
                  w.fee_usd::text, w.status, w.admin_notes, w.created_at
           FROM withdrawal_requests w
           JOIN users u ON u.id = w.user_id
           WHERE w.status = 'pending_admin'
           ORDER BY w.created_at ASC`);
                return rows.map((r) => ({
                    ...r,
                    amount_usd: null,
                    method: "crypto",
                    bank_name: null,
                    bank_account_number: null,
                    bank_routing_number: null,
                }));
            }
            catch {
                return [];
            }
        }
        return [];
    }
}
/** Debit USD value across the user's spendable cash currencies (USDT, USDC, USD, DAI, BTC). */
async function debitCashBalanceUsd(client, userId, amountUsd, refId) {
    let remaining = Math.round(amountUsd * 100) / 100;
    if (remaining <= 0)
        return { ok: false, error: "Invalid withdrawal amount" };
    for (const currency of CASHBOX_SPENDABLE_CURRENCIES) {
        if (remaining <= 0)
            break;
        const px = cashBoxUsdPrice(currency);
        if (px <= 0)
            continue;
        const { rows } = await client.query(`SELECT balance::text AS balance FROM wallets
       WHERE user_id = $1::uuid AND currency = $2::text FOR UPDATE`, [userId, currency]);
        const bal = Number.parseFloat(rows[0]?.balance ?? "0");
        if (!Number.isFinite(bal) || bal <= 0)
            continue;
        const balUsd = Math.round(bal * px * 100) / 100;
        const takeUsd = Math.min(balUsd, remaining);
        if (takeUsd <= 0)
            continue;
        const take = currency === "BTC"
            ? Math.round((takeUsd / px) * 1e8) / 1e8
            : Math.round((takeUsd / px) * 100) / 100;
        const deb = await client.query(`UPDATE wallets SET balance = balance - $3::numeric
       WHERE user_id = $1::uuid AND currency = $2::text AND balance >= $3::numeric
       RETURNING balance`, [userId, currency, take.toFixed(8)]);
        if (deb.rowCount !== 1)
            continue;
        await client.query(`INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
       VALUES ($1::uuid, $2::text, 'debit', $3::numeric, 'wire_withdrawal', 'withdrawal', $4::uuid)`, [userId, currency, take.toFixed(8), refId]);
        remaining = Math.round((remaining - takeUsd) * 100) / 100;
    }
    if (remaining > 0.01) {
        return { ok: false, error: "Cash balance is not enough to cover this withdrawal" };
    }
    return { ok: true };
}
export async function approveWithdrawalAdmin(input) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        let row;
        try {
            const w = await client.query(`SELECT id, user_id, asset, amount::text, amount_usd::text, status, method
         FROM withdrawal_requests
         WHERE id = $1::uuid
         FOR UPDATE`, [input.withdrawalId]);
            row = w.rows[0];
        }
        catch (e) {
            if (!isBankColumnMissing(e) && !isAmountUsdColumnMissing(e))
                throw e;
            const fallback = await client.query(`SELECT id, user_id, asset, amount::text, status
         FROM withdrawal_requests
         WHERE id = $1::uuid
         FOR UPDATE`, [input.withdrawalId]);
            const r = fallback.rows[0];
            if (r) {
                row = { ...r, amount_usd: null, method: "crypto" };
            }
        }
        if (!row || row.status !== "pending_admin") {
            await client.query("ROLLBACK");
            return { ok: false, error: "Withdrawal not found or not pending" };
        }
        if (row.method === "wire") {
            const usd = row.amount_usd != null
                ? Number.parseFloat(row.amount_usd)
                : Number.parseFloat(row.amount);
            if (!Number.isFinite(usd) || usd <= 0) {
                await client.query("ROLLBACK");
                return { ok: false, error: "Withdrawal USD amount missing or invalid" };
            }
            const out = await debitCashBalanceUsd(client, row.user_id, usd, row.id);
            if (!out.ok) {
                await client.query("ROLLBACK");
                return out;
            }
        }
        else {
            const deb = await client.query(`UPDATE wallets SET balance = balance - $3::numeric
         WHERE user_id = $1::uuid AND currency = $2::text AND balance >= $3::numeric
         RETURNING balance`, [row.user_id, row.asset, row.amount]);
            if (deb.rowCount !== 1) {
                await client.query("ROLLBACK");
                return { ok: false, error: "User wallet balance insufficient to approve this withdrawal" };
            }
            await client.query(`INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
         VALUES ($1::uuid, $2::text, 'debit', $3::numeric, 'withdrawal_sent', 'withdrawal', $4::uuid)`, [row.user_id, row.asset, row.amount, row.id]);
        }
        const note = input.notes?.trim() || null;
        await client.query(`UPDATE withdrawal_requests
       SET status = 'completed', reviewed_at = NOW(), admin_notes = COALESCE($2::text, admin_notes)
       WHERE id = $1::uuid`, [row.id, note]);
        await client.query("COMMIT");
        void input.adminUserId;
        return { ok: true };
    }
    catch (e) {
        await client.query("ROLLBACK").catch(() => { });
        throw e;
    }
    finally {
        client.release();
    }
}
export async function rejectWithdrawalAdmin(input) {
    const res = await pool.query(`UPDATE withdrawal_requests
     SET status = 'rejected', reviewed_at = NOW(), admin_notes = $2::text
     WHERE id = $1::uuid AND status = 'pending_admin'`, [input.withdrawalId, input.reason.trim()]);
    return (res.rowCount ?? 0) > 0;
}
