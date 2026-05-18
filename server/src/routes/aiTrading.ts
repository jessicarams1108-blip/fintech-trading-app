import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateRequired } from "../middleware/auth.js";
import {
  countTradesThisWeek,
  depositToAiWallet,
  ensureAiWallet,
  getAiWalletBalance,
  listUserTrades,
  MAX_TRADES_PER_WEEK,
  MAX_TRADE_USD,
  MIN_AI_WALLET_DEPOSIT_USD,
  MIN_TRADE_USD,
  serializeTrade,
  startAiTrade,
} from "../db/queries/aiTrading.js";
import { msUntilWeekReset } from "../lib/aiTradingWeek.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false });

export const aiTradingRouter = Router();
aiTradingRouter.use(authenticateRequired);

aiTradingRouter.get("/balance", limiter, async (req, res, next) => {
  try {
    await ensureAiWallet(req.user!.id);
    const balance = await getAiWalletBalance(req.user!.id);
    const tradesThisWeek = await countTradesThisWeek(req.user!.id);
    const canTrade = tradesThisWeek < MAX_TRADES_PER_WEEK;
    res.json({
      data: {
        balance,
        tradesThisWeek,
        maxTradesPerWeek: MAX_TRADES_PER_WEEK,
        canTrade,
        minTradeUsd: MIN_TRADE_USD,
        maxTradeUsd: MAX_TRADE_USD,
        minWalletDepositUsd: MIN_AI_WALLET_DEPOSIT_USD,
        msUntilWeekReset: msUntilWeekReset(),
      },
    });
  } catch (e) {
    next(e);
  }
});

aiTradingRouter.get("/history", limiter, async (req, res, next) => {
  try {
    const rows = await listUserTrades(req.user!.id);
    res.json({ data: rows.map(serializeTrade) });
  } catch (e) {
    next(e);
  }
});

const startSchema = z.object({
  asset: z.string().trim().min(1).max(50),
  asset_class: z.enum(["crypto", "forex", "stocks"]).optional().default("crypto"),
  amount: z.number().positive(),
});

aiTradingRouter.post("/start-trade", limiter, async (req, res, next) => {
  try {
    const body = startSchema.parse(req.body);
    if (body.amount < MIN_TRADE_USD) {
      res.status(400).json({ error: `Minimum trade amount is $${MIN_TRADE_USD.toLocaleString()}` });
      return;
    }
    if (body.amount > MAX_TRADE_USD) {
      res.status(400).json({ error: `Maximum trade amount is $${MAX_TRADE_USD.toLocaleString()}` });
      return;
    }
    const trade = await startAiTrade({
      userId: req.user!.id,
      asset: body.asset,
      assetClass: body.asset_class,
      amountUsd: body.amount,
    });
    res.status(201).json({ data: serializeTrade(trade) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: e.errors[0]?.message ?? "Invalid request" });
      return;
    }
    const msg = e instanceof Error ? e.message : "Could not start trade";
    res.status(400).json({ error: msg });
  }
});

const depositSchema = z.object({
  amount: z.number().positive(),
});

aiTradingRouter.post("/deposit", limiter, async (req, res, next) => {
  try {
    const body = depositSchema.parse(req.body);
    const balance = await depositToAiWallet(req.user!.id, body.amount);
    res.json({ data: { balance } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ error: e.errors[0]?.message ?? "Invalid request" });
      return;
    }
    const msg = e instanceof Error ? e.message : "Deposit failed";
    res.status(400).json({ error: msg });
  }
});
