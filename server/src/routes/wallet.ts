import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import { getCashBoxBalanceUsd } from "../db/queries/fixedSavings.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

export const walletRouter = Router();
walletRouter.use(authenticateRequired);

walletRouter.get("/balance", limiter, async (req, res, next) => {
  try {
    const cashBoxUsd = await getCashBoxBalanceUsd(req.user!.id);
    res.json({
      data: {
        cashBoxUsd: Math.round(cashBoxUsd * 100) / 100,
        currency: "USD",
      },
    });
  } catch (e) {
    next(e);
  }
});
