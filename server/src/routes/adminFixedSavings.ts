import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateRequired, requireAdmin } from "../middleware/auth.js";
import { closeSubscriptionAdmin, listAllSubscriptions } from "../db/queries/fixedSavings.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

export function createAdminFixedSavingsRoutes(): Router {
  const router = Router();
  router.use(authenticateRequired, requireAdmin);

  router.get("/fixed-savings", limiter, async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      const rows = await listAllSubscriptions({ status, userId, from, to });
      res.json({ data: rows });
    } catch (e) {
      next(e);
    }
  });

  router.post("/fixed-savings/:id/mature", limiter, async (req, res, next) => {
    try {
      const action = req.body?.action === "renew" ? "renew" : "payout";
      const result = await closeSubscriptionAdmin({
        subscriptionId: String(req.params.id),
        adminUserId: req.user!.id,
        action,
      });
      if (!result) {
        res.status(404).json({ error: "Active subscription not found" });
        return;
      }
      res.json({ data: result });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
