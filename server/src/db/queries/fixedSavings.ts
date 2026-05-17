import type { PoolClient } from "pg";
import { pool } from "../index.js";
import { getUserKyc, suppliedUsdFromWallets, getUserWallets } from "./liquidity.js";
import { rethrowPgSchemaError } from "../../lib/pgErrors.js";

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
  user_email?: string;
};

export function computeInterest(amount: number, ratePct: number, days: number, disableInterest: boolean): number {
  if (disableInterest) return 0;
  return Math.round(amount * (ratePct / 100) * (days / 365) * 1_000_000) / 1_000_000;
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
  return suppliedUsdFromWallets(wallets);
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
      `SELECT s.*, p.name AS plan_name, p.rate::text AS rate
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
      `SELECT s.*, p.name AS plan_name, p.rate::text AS rate, u.email AS user_email
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

const STABLE_DEBIT_ORDER = ["USDT", "USDC", "USD", "DAI"] as const;

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
    const { rows } = await client.query<{ balance: string }>(
      `SELECT balance::text AS balance FROM wallets
       WHERE user_id = $1::uuid AND currency = $2::text FOR UPDATE`,
      [userId, currency],
    );
    const bal = Number.parseFloat(rows[0]?.balance ?? "0");
    if (!Number.isFinite(bal) || bal <= 0) continue;
    const take = Math.min(bal, remaining);
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
    remaining = Math.round((remaining - take) * 100) / 100;
  }

  if (remaining > 0.01) {
    throw new Error("Insufficient CashBox balance");
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
}): Promise<FixedSubscriptionWithPlan> {
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
  if (input.amount < minAmt || input.amount > maxAmt) {
    throw new Error(`Amount must be between $${minAmt.toLocaleString()} and $${maxAmt.toLocaleString()}`);
  }
  if (input.days < plan.min_days || input.days > plan.max_days) {
    throw new Error(`Duration must be between ${plan.min_days} and ${plan.max_days} days`);
  }

  const balance = await getCashBoxBalanceUsd(input.userId);
  if (input.amount > balance) {
    throw new Error("Insufficient CashBox balance");
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
         (CURRENT_DATE + ($4::int - 1) * INTERVAL '1 day')::date,
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
    return full!;
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
      `SELECT s.*, p.name AS plan_name, p.rate::text AS rate
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
    const { rows } = await client.query<FixedSubscriptionRow & { rate: string }>(
      `SELECT s.*, p.rate::text AS rate
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
    const rate = Number.parseFloat(sub.rate);
    const interest = computeInterest(amount, rate, sub.days, sub.disable_interest);
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
           (CURRENT_DATE + ($4::int - 1) * INTERVAL '1 day')::date,
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
