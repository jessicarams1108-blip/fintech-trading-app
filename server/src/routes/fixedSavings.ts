import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import {
  getCashBoxBalanceUsd,
  getPlanById,
  listActivePlans,
  listUserSubscriptions,
  subscribeFixedSavings,
  sumActiveFixedSavingsUsd,
  withdrawFixedSavings,
} from "../db/queries/fixedSavings.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

export const fixedSavingsRouter = Router();
fixedSavingsRouter.use(authenticateRequired);

fixedSavingsRouter.get("/", limiter, async (_req, res, next) => {
  try {
    const plans = await listActivePlans();
    res.json({ data: plans });
  } catch (e) {
    next(e);
  }
});

fixedSavingsRouter.get("/summary", limiter, async (req, res, next) => {
  try {
    const total = await sumActiveFixedSavingsUsd(req.user!.id);
    res.json({ data: { activeTotalUsd: total } });
  } catch (e) {
    next(e);
  }
});

fixedSavingsRouter.get("/my-plans", limiter, async (req, res, next) => {
  try {
    const rows = await listUserSubscriptions(req.user!.id);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

fixedSavingsRouter.post("/withdraw", limiter, async (req, res, next) => {
  try {
    const subscriptionId =
      typeof req.body?.subscription_id === "string" ? req.body.subscription_id.trim() : "";
    if (!subscriptionId) {
      res.status(400).json({ error: "subscription_id is required" });
      return;
    }
    const result = await withdrawFixedSavings({
      userId: req.user!.id,
      subscriptionId,
    });
    res.json({ data: { payout: result.payout, subscription: result.subscription } });
  } catch (e) {
    next(e);
  }
});

fixedSavingsRouter.post("/subscribe", limiter, async (req, res, next) => {
  try {
    const body = req.body as {
      plan_id?: string;
      amount?: number;
      days?: number;
      goal_name?: string;
      auto_renewal?: boolean;
      disable_interest?: boolean;
    };
    const planId = body.plan_id?.trim();
    const amount = Number(body.amount);
    const days = Number(body.days);
    if (!planId || !Number.isFinite(amount) || !Number.isFinite(days)) {
      res.status(400).json({ error: "plan_id, amount, and days are required" });
      return;
    }
    const { subscription, totalPayout } = await subscribeFixedSavings({
      userId: req.user!.id,
      planId,
      amount,
      days,
      goalName: body.goal_name,
      autoRenewal: Boolean(body.auto_renewal),
      disableInterest: Boolean(body.disable_interest),
    });
    res.status(201).json({ data: { ...subscription, total_payout: totalPayout } });
  } catch (e) {
    next(e);
  }
});

fixedSavingsRouter.get("/:id", limiter, async (req, res, next) => {
  try {
    const planId = String(req.params.id);
    const plan = await getPlanById(planId);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.json({ data: plan });
  } catch (e) {
    next(e);
  }
});
