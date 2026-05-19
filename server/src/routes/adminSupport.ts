import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateRequired, requireAdmin } from "../middleware/auth.js";
import {
  addAdminSupportMessage,
  getSupportTicketForAdmin,
  listSupportTicketsForAdmin,
  updateSupportTicketStatus,
  type SupportTicketStatus,
} from "../db/queries/support.js";
import { isPgUndefinedTable } from "../lib/pgErrors.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

export function createAdminSupportRoutes(): Router {
  const router = Router();
  router.use(authenticateRequired, requireAdmin);

  router.get("/support/tickets", limiter, async (req, res, next) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : "open";
      const rows = await listSupportTicketsForAdmin(status);
      res.json({
        data: rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          userEmail: r.user_email,
          userName: r.user_name,
          status: r.status,
          updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
          lastMessagePreview: r.last_message_preview,
        })),
      });
    } catch (e) {
      if (isPgUndefinedTable(e)) {
        res.json({ data: [] });
        return;
      }
      next(e);
    }
  });

  router.get("/support/tickets/:id", limiter, async (req, res, next) => {
    try {
      const ticketId = String(req.params.id);
      const data = await getSupportTicketForAdmin(ticketId);
      if (!data) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }
      res.json({ data });
    } catch (e) {
      if (isPgUndefinedTable(e)) {
        res.status(503).json({ error: "Support tables missing" });
        return;
      }
      next(e);
    }
  });

  const replySchema = z.object({
    body: z.string().min(1).max(8000),
  });

  router.post("/support/tickets/:id/messages", limiter, async (req, res, next) => {
    const ticketId = String(req.params.id);
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const message = await addAdminSupportMessage({
        ticketId,
        adminUserId: req.user!.id,
        body: parsed.data.body,
      });
      res.status(201).json({ data: message });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send reply";
      res.status(400).json({ error: msg });
    }
  });

  const statusSchema = z.object({
    status: z.enum(["open", "in_progress", "resolved", "closed"]),
  });

  router.patch("/support/tickets/:id/status", limiter, async (req, res, next) => {
    const ticketId = String(req.params.id);
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const ok = await updateSupportTicketStatus(ticketId, parsed.data.status as SupportTicketStatus);
      if (!ok) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }
      res.json({ data: { ok: true, status: parsed.data.status } });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
