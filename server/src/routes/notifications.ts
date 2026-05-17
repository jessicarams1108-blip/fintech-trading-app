import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import { listUnifiedHistory } from "../db/queries/history.js";
import { mapHistoryToNotifications } from "../lib/notificationMessages.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

export const notificationsRouter = Router();
notificationsRouter.use(authenticateRequired);

notificationsRouter.get("/", limiter, async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(5, Number.parseInt(String(req.query.limit ?? "30"), 10) || 30));
    const rows = await listUnifiedHistory(req.user!.id, { limit: 120, offset: 0 });
    const items = mapHistoryToNotifications(rows, limit);
    const pendingCount = items.filter((i) => i.isPending).length;
    res.json({ data: { items, pendingCount } });
  } catch (e) {
    next(e);
  }
});
