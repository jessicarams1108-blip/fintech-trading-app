import { pool } from "../index.js";
import { getCashBoxBalanceUsd } from "./fixedSavings.js";
import { CASHBOX_SPENDABLE_CURRENCIES, cashBoxUsdPrice } from "./liquidity.js";
import { currentUtcWeekBounds } from "../../lib/aiTradingWeek.js";

export const MIN_TRADE_USD = 1000;
export const MAX_TRADE_USD = 1_000_000;
export const MIN_AI_WALLET_DEPOSIT_USD = 100;
export const MAX_TRADES_PER_WEEK = 2;

export type AiTradeRow = {
  id: string;
  user_id: string;
  asset: string;
  asset_class: string;
  amount: string;
  result_type: string | null;
  profit_loss_amount: string;
  status: string;
  start_time: Date;
  end_time: Date | null;
  user_email?: string;
};

async function debitCashBoxUsd(client: import("pg").PoolClient, userId: string, amountUsd: number, refId: string): Promise<void> {
  let remaining = amountUsd;
  const wallets = await client.query<{ currency: string; balance: string }>(
    `SELECT currency, balance::text FROM wallets WHERE user_id = $1::uuid FOR UPDATE`,
    [userId],
  );
  const order = CASHBOX_SPENDABLE_CURRENCIES as readonly string[];
  for (const cur of order) {
    if (remaining <= 0) break;
    const row = wallets.rows.find((w) => w.currency === cur);
    if (!row) continue;
    const px = cashBoxUsdPrice(cur);
    if (px <= 0) continue;
    const bal = Number.parseFloat(row.balance);
    if (!Number.isFinite(bal) || bal <= 0) continue;
    const usdAvail = bal * px;
    const takeUsd = Math.min(remaining, usdAvail);
    const takeAsset = takeUsd / px;
    await client.query(
      `UPDATE wallets SET balance = balance - $3::numeric
       WHERE user_id = $1::uuid AND currency = $2`,
      [userId, cur, takeAsset],
    );
    await client.query(
      `INSERT INTO ledger_entries (user_id, currency, direction, amount, reason, ref_type, ref_id)
       VALUES ($1::uuid, $2, 'debit', $3::numeric, 'ai_trading_deposit', 'ai_trading', $4::uuid)`,
      [userId, cur, takeAsset, refId],
    );
    remaining = Math.round((remaining - takeUsd) * 100) / 100;
  }
  if (remaining > 0.01) {
    throw new Error("Insufficient CashBox balance");
  }
}

export async function getAiWalletBalance(userId: string): Promise<number> {
  const { rows } = await pool.query<{ balance: string }>(
    `SELECT balance::text FROM ai_trading_wallets WHERE user_id = $1::uuid`,
    [userId],
  );
  if (!rows[0]) return 0;
  return Number.parseFloat(rows[0].balance) || 0;
}

export async function ensureAiWallet(userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO ai_trading_wallets (user_id, balance) VALUES ($1::uuid, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

export async function countTradesThisWeek(userId: string): Promise<number> {
  const { weekStart, weekEnd } = currentUtcWeekBounds();
  const { rows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM ai_trades
     WHERE user_id = $1::uuid AND start_time >= $2 AND start_time < $3`,
    [userId, weekStart, weekEnd],
  );
  return Number.parseInt(rows[0]?.c ?? "0", 10) || 0;
}

export async function getRunningTradeForAsset(userId: string, asset: string): Promise<AiTradeRow | null> {
  const { rows } = await pool.query<AiTradeRow>(
    `SELECT id::text, user_id::text, asset, asset_class, amount::text, result_type, profit_loss_amount::text,
            status, start_time, end_time
     FROM ai_trades
     WHERE user_id = $1::uuid AND LOWER(asset) = LOWER($2) AND status = 'running'
     LIMIT 1`,
    [userId, asset],
  );
  return rows[0] ?? null;
}

export async function listUserTrades(userId: string, limit = 50): Promise<AiTradeRow[]> {
  const { rows } = await pool.query<AiTradeRow>(
    `SELECT id::text, user_id::text, asset, asset_class, amount::text, result_type, profit_loss_amount::text,
            status, start_time, end_time
     FROM ai_trades
     WHERE user_id = $1::uuid
     ORDER BY start_time DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

export async function listAdminTrades(opts: { status?: string }): Promise<AiTradeRow[]> {
  const status = opts.status ?? "running";
  const { rows } = await pool.query<AiTradeRow>(
    `SELECT t.id::text, t.user_id::text, t.asset, t.asset_class, t.amount::text, t.result_type,
            t.profit_loss_amount::text, t.status, t.start_time, t.end_time, u.email AS user_email
     FROM ai_trades t
     JOIN users u ON u.id = t.user_id
     WHERE ($1::text = 'all' OR t.status = $1)
     ORDER BY t.start_time DESC
     LIMIT 200`,
    [status],
  );
  return rows;
}

export async function depositToAiWallet(userId: string, amountUsd: number): Promise<number> {
  if (!Number.isFinite(amountUsd) || amountUsd < MIN_AI_WALLET_DEPOSIT_USD) {
    throw new Error(`Minimum deposit is $${MIN_AI_WALLET_DEPOSIT_USD}`);
  }
  const cashBox = await getCashBoxBalanceUsd(userId);
  if (cashBox < amountUsd) throw new Error("Insufficient CashBox balance");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO ai_trading_wallets (user_id, balance) VALUES ($1::uuid, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    const walletId = crypto.randomUUID();
    await debitCashBoxUsd(client, userId, amountUsd, walletId);
    const { rows } = await client.query<{ balance: string }>(
      `UPDATE ai_trading_wallets
       SET balance = balance + $2::numeric
       WHERE user_id = $1::uuid
       RETURNING balance::text`,
      [userId, amountUsd],
    );
    await client.query("COMMIT");
    return Number.parseFloat(rows[0]?.balance ?? "0") || 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function startAiTrade(input: {
  userId: string;
  asset: string;
  assetClass: string;
  amountUsd: number;
}): Promise<AiTradeRow> {
  const { weekStart, weekEnd } = currentUtcWeekBounds();
  const count = await countTradesThisWeek(input.userId);
  if (count >= MAX_TRADES_PER_WEEK) {
    throw new Error("Weekly trade limit reached (2 trades per week)");
  }

  const existing = await getRunningTradeForAsset(input.userId, input.asset);
  if (existing) throw new Error(`You already have a running trade for ${input.asset}`);

  if (!Number.isFinite(input.amountUsd) || input.amountUsd < MIN_TRADE_USD) {
    throw new Error(`Minimum trade amount is $${MIN_TRADE_USD.toLocaleString()}`);
  }
  if (input.amountUsd > MAX_TRADE_USD) {
    throw new Error(`Maximum trade amount is $${MAX_TRADE_USD.toLocaleString()}`);
  }

  const balance = await getAiWalletBalance(input.userId);
  if (balance < input.amountUsd) throw new Error("Insufficient AI trading balance");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: balRows } = await client.query<{ balance: string }>(
      `UPDATE ai_trading_wallets
       SET balance = balance - $2::numeric
       WHERE user_id = $1::uuid AND balance >= $2::numeric
       RETURNING balance::text`,
      [input.userId, input.amountUsd],
    );
    if (!balRows[0]) throw new Error("Insufficient AI trading balance");

    const { rows } = await client.query<AiTradeRow>(
      `INSERT INTO ai_trades (user_id, asset, asset_class, amount, status)
       VALUES ($1::uuid, $2, $3, $4::numeric, 'running')
       RETURNING id::text, user_id::text, asset, asset_class, amount::text, result_type, profit_loss_amount::text,
                 status, start_time, end_time`,
      [input.userId, input.asset, input.assetClass, input.amountUsd],
    );
    await client.query("COMMIT");
    return rows[0]!;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function setAiTradeResult(input: {
  tradeId: string;
  resultType: "profit" | "loss";
  profitLossAmount: number;
}): Promise<AiTradeRow | null> {
  if (!Number.isFinite(input.profitLossAmount) || input.profitLossAmount < 0) {
    throw new Error("Profit/loss amount must be zero or positive");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: tradeRows } = await client.query<AiTradeRow>(
      `SELECT id::text, user_id::text, asset, asset_class, amount::text, result_type, profit_loss_amount::text,
              status, start_time, end_time
       FROM ai_trades WHERE id = $1::uuid AND status = 'running' FOR UPDATE`,
      [input.tradeId],
    );
    const trade = tradeRows[0];
    if (!trade) {
      await client.query("ROLLBACK");
      return null;
    }

    const principal = Number.parseFloat(trade.amount);
    if (input.resultType === "profit") {
      const credit = principal + input.profitLossAmount;
      await client.query(
        `UPDATE ai_trading_wallets
         SET balance = balance + $2::numeric
         WHERE user_id = $1::uuid`,
        [trade.user_id, credit],
      );
    }

    const { rows } = await client.query<AiTradeRow>(
      `UPDATE ai_trades
       SET status = 'completed',
           result_type = $2,
           profit_loss_amount = $3::numeric,
           end_time = NOW()
       WHERE id = $1::uuid
       RETURNING id::text, user_id::text, asset, asset_class, amount::text, result_type, profit_loss_amount::text,
                 status, start_time, end_time`,
      [input.tradeId, input.resultType, input.profitLossAmount],
    );
    await client.query("COMMIT");
    return rows[0] ?? null;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export function serializeTrade(row: AiTradeRow) {
  return {
    id: row.id,
    asset: row.asset,
    asset_class: row.asset_class,
    amount: Number.parseFloat(row.amount),
    result_type: row.result_type,
    profit_loss_amount: Number.parseFloat(row.profit_loss_amount ?? "0"),
    status: row.status,
    start_time: row.start_time instanceof Date ? row.start_time.toISOString() : String(row.start_time),
    end_time: row.end_time
      ? row.end_time instanceof Date
        ? row.end_time.toISOString()
        : String(row.end_time)
      : null,
    user_email: row.user_email,
  };
}
