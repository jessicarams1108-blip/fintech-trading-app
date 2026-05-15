import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import { getUserKyc, getUserWallets, suppliedUsdFromWallets } from "../db/queries/liquidity.js";
import {
  availableBorrowUsd,
  COLLATERAL_FACTOR,
  effectiveMaxBorrowUsd,
} from "../lib/borrowPolicy.js";
import { executeRepayUsd, getBorrowPositionForUser, listBorrowPositions, sumActiveBorrowUsd, touchBorrowAccrual } from "../db/queries/borrow.js";
import {
  insertBorrowRequest,
  listBorrowRequestsForUser,
  sumPendingBorrowUsdForUser,
} from "../db/queries/adminQueues.js";
import { borrowAprFor } from "../lib/market.js";
import { ensureStarterWalletsForUser } from "../db/queries/wallets.js";
import { isPgUndefinedTable } from "../lib/pgErrors.js";

const STABLE_BORROW = new Set(["USDC", "DAI", "USDT"]);

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

export const borrowRouter = Router();
borrowRouter.use(authenticateRequired);

borrowRouter.get("/power", limiter, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    await touchBorrowAccrual(userId);
    await ensureStarterWalletsForUser(userId);
    const wallets = await getUserWallets(userId);
    const suppliedUsd = suppliedUsdFromWallets(wallets);
    const kyc = await getUserKyc(userId);
    const outstanding = await sumActiveBorrowUsd(userId);
    const pendingBorrowUsd = await sumPendingBorrowUsdForUser(userId);
    const gross = effectiveMaxBorrowUsd({
      suppliedUsd,
      kycStatus: kyc.kyc_status,
      kycTier: kyc.kyc_tier,
    });
    const available = availableBorrowUsd({
      suppliedUsd,
      kycStatus: kyc.kyc_status,
      kycTier: kyc.kyc_tier,
      outstandingBorrowUsd: outstanding,
    });
    const maxLtvPct = Math.round(COLLATERAL_FACTOR * 1000) / 10;
    const healthFactor =
      outstanding > 0.01 ? Math.round(((suppliedUsd * COLLATERAL_FACTOR) / outstanding) * 100) / 100 : 99.99;
    const collateral = wallets
      .filter((w) => Number.parseFloat(w.balance) > 0)
      .map((w) => {
        const bal = Number.parseFloat(w.balance);
        return { asset: w.currency, balance: w.balance, balanceNum: bal };
      });
    const positions = await listBorrowPositions(userId, 30);
    res.json({
      data: {
        suppliedUsd,
        outstandingBorrowUsd: outstanding,
        pendingBorrowUsd,
        grossMaxBorrowUsd: gross,
        availableBorrowUsd: available,
        maxLtvPct,
        healthFactor,
        collateral,
        positions,
      },
    });
  } catch (e) {
    next(e);
  }
});

borrowRouter.get("/rates", limiter, (req, res) => {
  const asset = String(req.query.asset ?? "USDC").toUpperCase();
  const r = borrowAprFor(asset);
  res.json({ data: { asset, variableApr: r.variable, stableApr: r.stable } });
});

const requestSchema = z.object({
  asset: z.string().min(2).max(12),
  amount: z.coerce.number().positive(),
  rateMode: z.enum(["variable", "stable"]).optional(),
});

borrowRouter.get("/my-requests", limiter, async (req, res, next) => {
  try {
    const rows = await listBorrowRequestsForUser(req.user!.id, 50);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

borrowRouter.post("/request", limiter, async (req, res, next) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() });
    return;
  }
  const asset = parsed.data.asset.toUpperCase();
  if (!STABLE_BORROW.has(asset)) {
    res.status(400).json({ error: "Borrow is limited to USDC, USDT, or DAI in this MVP." });
    return;
  }
  const amount = Math.round(parsed.data.amount * 100) / 100;
  if (amount < 0.01 || amount > 50_000_000) {
    res.status(400).json({ error: "Amount must be between 0.01 and 50,000,000 USD equivalent." });
    return;
  }
  try {
    const userId = req.user!.id;
    await ensureStarterWalletsForUser(userId);
    await touchBorrowAccrual(userId);
    const apr = borrowAprFor(asset);
    const { id } = await insertBorrowRequest({
      userId,
      asset,
      amountUsd: amount,
      rateMode: parsed.data.rateMode ?? "variable",
      variableApr: apr.variable,
      stableApr: apr.stable,
    });
    res.status(201).json({ data: { requestId: id, asset, amount, status: "pending_admin" } });
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      res.status(503).json({
        error: "Borrow requests table missing. Apply migration db/migrations/006_admin_queues.sql and restart the API.",
      });
      return;
    }
    next(e);
  }
});

const repaySchema = z.object({
  positionId: z.string().uuid(),
  amount: z.coerce.number().positive(),
});

borrowRouter.post("/repay", limiter, async (req, res, next) => {
  const parsed = repaySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const userId = req.user!.id;
    await touchBorrowAccrual(userId);
    const pos = await getBorrowPositionForUser(parsed.data.positionId, userId);
    if (!pos || pos.status !== "active") {
      res.status(400).json({ error: "Invalid borrow position" });
      return;
    }
    const closed = await executeRepayUsd({
      userId,
      positionId: parsed.data.positionId,
      payUsd: parsed.data.amount,
      asset: pos.asset,
    });
    res.json({ data: { closed } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Repay failed";
    if (/Insufficient|not active/i.test(msg)) {
      res.status(400).json({ error: msg });
      return;
    }
    next(e);
  }
});
