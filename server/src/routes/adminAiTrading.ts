import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateRequired, requireAdmin } from "../middleware/auth.js";
import { listAdminTrades, serializeTrade, setAiTradeResult } from "../db/queries/aiTrading.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

export function createAdminAiTradingRoutes(): Router {
  const router = Router();
  router.use(authenticateRequired, requireAdmin);

  router.get("/ai-trading/trades", limiter, async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : "running";
      const rows = await listAdminTrades({ status });
      res.json({ data: rows.map(serializeTrade) });
    } catch (e) {
      next(e);
    }
  });

  const resultSchema = z.object({
    trade_id: z.string().uuid(),
    result_type: z.enum(["profit", "loss"]),
    profit_loss_amount: z.number().nonnegative(),
  });

  router.post("/ai-trading/set-result", limiter, async (req, res, next) => {
    try {
      const body = resultSchema.parse(req.body);
      const trade = await setAiTradeResult({
        tradeId: body.trade_id,
        resultType: body.result_type,
        profitLossAmount: body.profit_loss_amount,
      });
      if (!trade) {
        res.status(404).json({ error: "Running trade not found" });
        return;
      }
      res.json({ data: serializeTrade(trade) });
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: e.errors[0]?.message ?? "Invalid request" });
        return;
      }
      const msg = e instanceof Error ? e.message : "Could not update trade";
      res.status(400).json({ error: msg });
    }
  });

  return router;
}
