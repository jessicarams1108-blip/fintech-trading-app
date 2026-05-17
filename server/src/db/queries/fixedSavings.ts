import type { PoolClient } from "pg";
import { pool } from "../index.js";
import { computeReturn, computeTotalPayout } from "../../lib/fixedSavingsMath.js";
import {
  CASHBOX_SPENDABLE_CURRENCIES,
  cashBoxUsdPrice,
  getUserKyc,
  getUserWallets,
  spendableCashBoxUsdFromWallets,
} from "./liquidity.js";
import { rethrowPgSchemaError } from "../../lib/pgErrors.js";

export { computeTotalPayout } from "../../lib/fixedSavingsMath.js";

export type FixedPlanRow = {
  id: string;
  name: string;
  rate: string;
  min_days: number;
  max_days: number;
  min_amount: string;
  max_amount: string;
  status: string;
  sort_order: number;
};

export type FixedSubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  amount: string;
  days: number;
  start_date: string;
  end_date: string;
  interest_earned: string;
  accrued_interest: string;
  last_interest_credit_at: Date | string | null;
  status: string;
  goal_name: string | null;
  auto_renewal: boolean;
  disable_interest: boolean;
  created_at: Date | string;
  matured_at: Date | string | null;
  closed_at: Date | string | null;
};

export type FixedSubscriptionWithPlan = FixedSubscriptionRow & {
  plan_name: string;
  rate: string;
  plan_min_days: number;
  user_email?: string;
};

export async function matureSubscriptionsPastEndDate(): Promise<number> {
  try {
    const res = await pool.query(
      `UPDATE fixed_savings_subscriptions
       SET status = 'matured',
           matured_at = COALESCE(matured_at, NOW()),
           interest_earned = accrued_interest
       WHERE status = 'active' AND end_date <= CURRENT_DATE`,
    );
    return res.rowCount ?? 0;
  } catch (e) {
    rethrowPgSchemaError(e);
  }
}

export async function accrueDailyInterestForActiveSubscriptions(): Promise<number> {
  try {
    const res = await pool.query(
      `UPDATE fixed_savings_subscriptions s
       SET accrued_interest = s.accrued_interest + (s.amount * p.rate / 100.0 / GREATEST(s.days, 1)),
           last_interest_credit_at = NOW()
       FROM fixed_savings_plans p
       WHERE p.id = s.plan_id
         AND s.status = 'active'
         AND NOT s.disable_interest
         AND (s.last_interest_credit_at IS NULL OR s.last_interest_credit_at::date < CURRENT_DATE)`,
    );
    return res.rowCount ?? 0;
  } catch (e) {
    rethrowPgSchemaError(e);
  }
}

export async function listActivePlans(): Promise<FixedPlanRow[]> {
  try {
    const { rows } = await pool.query<FixedPlanRow>(
      `SELECT id, name, rate::text, min_days, max_days, min_amount::text, max_amount::text, status, sort_order
       FROM fixed_savings_plans
       WHERE status = 'active'
       ORDER BY sort_order ASC, min_days ASC`,
    );
    return rows;
  } catch (e) {
    rethrowPgSchemaError(e);
  }
}

export async function getPlanById(planId: string): Promise<FixedPlanRow | null> {
  try {
    const { rows } = await pool.query<FixedPlanRow>(
      `SELECT id, name, rate::text, min_days, max_days, min_amount::text, max_amount::text, status, sort_order
       FROM fixed_savings_plans WHERE id = $1::uuid LIMIT 1`,
      [planId],
    );
    return rows[0] ?? null;
  } catch (e) {
    rethrowPgSchemaError(e);
  }
}

export async function getCashBoxBalanceUsd(userId: string): Promise<number> {
  const wallets = await getUserWallets(userId);
  return spendableCashBoxUsdFromWallets(wallets);
}

export async function sumActiveFixedSavingsUsd(userId: string): Promise<number> {
  try {
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM fixed_savings_subscriptions
       WHERE user_id = $1::uuid AND status = 'active'`,
      [userId],
    );
    return Number.parseFloat(rows[0]?.total ?? "0") || 0;
  } catch (e) {
    rethrowPgSchemaError(e);
  }
}

export async function listUserSubscriptions(userId: string): Promise<FixedSubscriptionWithPlan[]> {
  try {
    const { rows } = await pool.query<FixedSubscriptionWithPlan>(
      `SELECT s.*, p.name AS plan_name, p.rate::text AS rate, p.min_days AS plan_min_days
       FROM fixed_savings_subscriptions s
       JOIN fixed_savings_plans p ON p.id = s.plan_id
       WHERE s.user_id = $1::uuid
       ORDER BY s.created_at DESC`,
      [userId],
    );
    return rows;
  } catch (e) {
    rethrowPgSchemaError(e);
  }
}

export async function listAllSubscriptions(filters: {
  status?: string;
  userId?: string;
  from?: string;
  to?: string;
}): Promise<FixedSubscriptionWithPlan[]> {
  try {
    const clauses: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (filters.status) {
      clauses.push(`s.status = $${i++}`);
      params.push(filters.status);
    }
    if (filters.userId) {
      clauses.push(`s.user_id = $${i++}::uuid`);
      params.push(filters.userId);
    }
    if (filters.from) {
      clauses.push(`s.created_at >= $${i++}::timestamptz`);
      params.push(filters.from);
    }
    if (filters.to) {
      clauses.push(`s.created_at <= $${i++}::timestamptz`);
      params.push(filters.to);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { rows } = await pool.query<FixedSubscriptionWithPlan>(
      `SELECT s.*, p.name AS plan_name, p.rate::text AS rate, p.min_days AS plan_min_days, u.email AS user_email
       FROM fixed_savings_subscriptions s
       JOIN fixed_savings_plans p ON p.id = s.plan_id
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT 500`,
      params,
    );
    return rows;
  } catch (e) {
    rethrowPgSchemaError(e);
  }
}

const STABLE_DEBIT_ORDER = CASHBOX_SPENDABLE_CURRENCIES;

const INSUFFICIENT_CASHBOX_MSG = "Insufficient CashBox balance";

async function debitUsdEquivalent(
  client: PoolClient,
  userId: string,
  amountUsd: number,
  refId: string,
): Promise<void> {
  let remaining = Math.round(amountUsd * 100) / 100;
  if (remaining <= 0) throw new Error("Invalid amount");

  for (const currency of STABLE_DEBIT_ORDER) {
    if (remaining <= 0) break;
    const px = cashBoxUsdPrice(currency);
    if (px <= 0) continue;

    const { rows } = await client.query<{ balance: string }>(
      `SELECT balance::text AS balance FROM wallets
       WHERE user_id = $1::uuid AND currency = $2::text FOR UPDATE`,
      [userId, currency],
    );
    const bal = Number.parseFloat(rows[0]?.balance ?? "0");
    if (!Number.isFinite(bal) || bal <= 0) continue;

    const balUsd = Math.round(bal * px * 100) / 100;
    const takeUsd = Math.min(balUsd, remaining);
    if (takeUsd <= 0) continue;

    const take =
      currency === "BTC"
        ? Math.round((takeUsd / px) * 1e8) / 1e8
        : Math.round(takeUsd * 100) / 100;

    const deb = await client.query(
      `UPDATE wallets SET balance = balance - $3::numeric
       WHERE user_id = $1::uuid AND currency = $2::text AND balance >= $3::numeric
       RETURNING balance`,
      [userId, currency, take.toFixed(8)],
    );
    if (deb.rowCount !== 1) continue;
    await client.query(
      `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
       VALUES ($1::uuid, $2::text, 'debit', $3::numeric, 'fixed_savings_lock', 'fixed_savings', $4::uuid)`,
      [userId, currency, take.toFixed(8), refId],
    );
    remaining = Math.round((remaining - takeUsd) * 100) / 100;
  }

  if (remaining > 0.01) {
    throw new Error(INSUFFICIENT_CASHBOX_MSG);
  }
}

async function creditUsdEquivalent(
  client: PoolClient,
  userId: string,
  amountUsd: number,
  reason: string,
  refId: string,
): Promise<void> {
  const amt = amountUsd.toFixed(2);
  await client.query(
    `INSERT INTO wallets (user_id, currency, balance)
     VALUES ($1::uuid, 'USDT', $2::numeric)
     ON CONFLICT (user_id, currency)
     DO UPDATE SET balance = wallets.balance + EXCLUDED.balance`,
    [userId, amt],
  );
  await client.query(
    `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
     VALUES ($1::uuid, 'USDT', 'credit', $3::numeric, $4, 'fixed_savings', $5::uuid)`,
    [userId, amt, reason, refId],
  );
}

export async function subscribeFixedSavings(input: {
  userId: string;
  planId: string;
  amount: number;
  days: number;
  goalName?: string;
  autoRenewal: boolean;
  disableInterest: boolean;
}): Promise<{ subscription: FixedSubscriptionWithPlan; totalPayout: number }> {
  const kyc = await getUserKyc(input.userId);
  if (kyc.kyc_status !== "verified") {
    throw new Error("Identity verification must be approved before fixed savings");
  }

  const plan = await getPlanById(input.planId);
  if (!plan || plan.status !== "active") {
    throw new Error("Plan not found");
  }

  const minAmt = Number.parseFloat(plan.min_amount);
  const maxAmt = Number.parseFloat(plan.max_amount);
  const ratePct = Number.parseFloat(plan.rate);
  const termDays = plan.min_days;
  const totalPayout = computeTotalPayout(input.amount, ratePct, input.disableInterest);

  if (input.amount < minAmt || input.amount > maxAmt) {
    throw new Error(`Amount must be between $${minAmt.toLocaleString()} and $${maxAmt.toLocaleString()}`);
  }
  if (input.days !== termDays) {
    throw new Error(`This plan has a fixed ${termDays}-day term (${plan.name})`);
  }

  const balance = await getCashBoxBalanceUsd(input.userId);
  if (input.amount > balance) {
    throw new Error(INSUFFICIENT_CASHBOX_MSG);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const subRes = await client.query<FixedSubscriptionRow>(
      `INSERT INTO fixed_savings_subscriptions (
         user_id, plan_id, amount, days, start_date, end_date, status,
         goal_name, auto_renewal, disable_interest
       ) VALUES (
         $1::uuid, $2::uuid, $3::numeric, $4, CURRENT_DATE,
         (CURRENT_DATE + ($4::int) * INTERVAL '1 day')::date,
         'active', $5, $6, $7
       )
       RETURNING *`,
      [
        input.userId,
        input.planId,
        input.amount,
        input.days,
        input.goalName?.trim() || null,
        input.autoRenewal,
        input.disableInterest,
      ],
    );
    const sub = subRes.rows[0]!;
    await debitUsdEquivalent(client, input.userId, input.amount, sub.id);

    await client.query("COMMIT");

    const full = await getSubscriptionById(sub.id);
    if (!full) throw new Error("Subscription created but not found");
    return { subscription: full, totalPayout };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function withdrawFixedSavings(input: {
  userId: string;
  subscriptionId: string;
}): Promise<{ payout: number; subscription: FixedSubscriptionWithPlan }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<FixedSubscriptionRow & { rate: string }>(
      `SELECT s.*, p.rate::text AS rate
       FROM fixed_savings_subscriptions s
       JOIN fixed_savings_plans p ON p.id = s.plan_id
       WHERE s.id = $1::uuid AND s.user_id = $2::uuid
       FOR UPDATE`,
      [input.subscriptionId, input.userId],
    );
    const sub = rows[0];
    if (!sub) {
      await client.query("ROLLBACK");
      throw new Error("Subscription not found");
    }
    if (sub.status !== "matured") {
      await client.query("ROLLBACK");
      const endRaw = String(sub.end_date).slice(0, 10);
      const endLabel = new Date(`${endRaw}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      throw new Error(`Not yet matured. Available on ${endLabel}`);
    }

    const principal = Number.parseFloat(sub.amount);
    const accrued = Number.parseFloat(sub.accrued_interest ?? "0");
    const payout = Math.round((principal + accrued) * 100) / 100;

    await creditUsdEquivalent(client, sub.user_id, payout, "fixed_savings_withdraw", sub.id);
    await client.query(
      `UPDATE fixed_savings_subscriptions
       SET status = 'withdrawn', interest_earned = $2::numeric, closed_at = NOW()
       WHERE id = $1::uuid`,
      [sub.id, accrued],
    );
    await client.query("COMMIT");

    const updated = await getSubscriptionById(sub.id);
    if (!updated) throw new Error("Withdrawal completed but subscription not found");
    return { payout, subscription: updated };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getSubscriptionById(id: string): Promise<FixedSubscriptionWithPlan | null> {
  try {
    const { rows } = await pool.query<FixedSubscriptionWithPlan>(
      `SELECT s.*, p.name AS plan_name, p.rate::text AS rate, p.min_days AS plan_min_days
       FROM fixed_savings_subscriptions s
       JOIN fixed_savings_plans p ON p.id = s.plan_id
       WHERE s.id = $1::uuid LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  } catch (e) {
    rethrowPgSchemaError(e);
  }
}

export async function closeSubscriptionAdmin(input: {
  subscriptionId: string;
  adminUserId: string;
  action: "payout" | "renew";
}): Promise<FixedSubscriptionWithPlan | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<FixedSubscriptionRow & { rate: string; plan_min_days: number }>(
      `SELECT s.*, p.rate::text AS rate, p.min_days AS plan_min_days
       FROM fixed_savings_subscriptions s
       JOIN fixed_savings_plans p ON p.id = s.plan_id
       WHERE s.id = $1::uuid AND s.status = 'active'
       FOR UPDATE`,
      [input.subscriptionId],
    );
    const sub = rows[0];
    if (!sub) {
      await client.query("ROLLBACK");
      return null;
    }

    const amount = Number.parseFloat(sub.amount);
    const accrued = Number.parseFloat(sub.accrued_interest ?? "0");
    const rate = Number.parseFloat(sub.rate);
    const projectedReturn = sub.disable_interest ? 0 : computeReturn(amount, rate, false);
    const interest = sub.disable_interest ? 0 : accrued > 0 ? accrued : projectedReturn;
    const principal = amount;
    const payout = principal + interest;

    const shouldRenew = input.action === "renew" || sub.auto_renewal;

    if (shouldRenew) {
      await client.query(
        `UPDATE fixed_savings_subscriptions
         SET status = 'renewed', interest_earned = $2::numeric, matured_at = now(), closed_at = now()
         WHERE id = $1::uuid`,
        [sub.id, interest],
      );
      const renewAmount = Math.round((principal + interest) * 100) / 100;
      await client.query(
        `INSERT INTO fixed_savings_subscriptions (
           user_id, plan_id, amount, days, start_date, end_date, status,
           goal_name, auto_renewal, disable_interest
         ) VALUES (
           $1::uuid, $2::uuid, $3::numeric, $4, CURRENT_DATE,
           (CURRENT_DATE + ($4::int) * INTERVAL '1 day')::date,
           'active', $5, $6, $7
         )`,
        [
          sub.user_id,
          sub.plan_id,
          renewAmount,
          sub.days,
          sub.goal_name,
          sub.auto_renewal,
          sub.disable_interest,
        ],
      );
    } else {
      await creditUsdEquivalent(client, sub.user_id, payout, "fixed_savings_maturity", sub.id);
      await client.query(
        `UPDATE fixed_savings_subscriptions
         SET status = 'matured', interest_earned = $2::numeric, matured_at = now(), closed_at = now()
         WHERE id = $1::uuid`,
        [sub.id, interest],
      );
    }

    await client.query("COMMIT");
    return getSubscriptionById(sub.id);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
