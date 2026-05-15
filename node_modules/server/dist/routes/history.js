import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import { listUnifiedHistory } from "../db/queries/history.js";
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
export const historyRouter = Router();
historyRouter.use(authenticateRequired);
historyRouter.get("/", limiter, async (req, res, next) => {
    try {
        const type = typeof req.query.type === "string" ? req.query.type : undefined;
        const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
        const pageSize = Math.min(100, Math.max(5, Number.parseInt(String(req.query.pageSize ?? "25"), 10) || 25));
        const offset = (page - 1) * pageSize;
        const rows = await listUnifiedHistory(req.user.id, { type, limit: pageSize, offset });
        res.json({ data: { page, pageSize, rows } });
    }
    catch (e) {
        next(e);
    }
});
