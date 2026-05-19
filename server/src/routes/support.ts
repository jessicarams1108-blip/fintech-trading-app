import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateRequired } from "../middleware/auth.js";
import {
  addUserSupportMessage,
  getOrCreateUserSupportConversation,
} from "../db/queries/support.js";
import {
  createSupportAttachmentPresignedPut,
  isSupportUploadConfigured,
} from "../lib/supportAttachmentStorage.js";
import { isPgUndefinedTable } from "../lib/pgErrors.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

export const supportRouter = Router();
supportRouter.use(authenticateRequired);

supportRouter.get("/capabilities", limiter, (_req, res) => {
  res.json({ data: { attachments: isSupportUploadConfigured() } });
});

supportRouter.get("/conversation", limiter, async (req, res, next) => {
  try {
    const data = await getOrCreateUserSupportConversation(req.user!.id);
    res.json({ data });
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      res.status(503).json({
        error: "Support is not available yet. Apply migration db/migrations/017_support_tickets.sql and restart the API.",
      });
      return;
    }
    next(e);
  }
});

const messageSchema = z.object({
  body: z.string().max(8000).optional().default(""),
  attachmentKey: z.string().max(500).optional(),
  attachmentName: z.string().max(200).optional(),
});

supportRouter.post("/messages", limiter, async (req, res, next) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const message = await addUserSupportMessage({
      userId: req.user!.id,
      body: parsed.data.body,
      attachmentKey: parsed.data.attachmentKey,
      attachmentName: parsed.data.attachmentName,
    });
    res.status(201).json({ data: message });
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      res.status(503).json({ error: "Support tables missing. Contact the site administrator." });
      return;
    }
    const msg = e instanceof Error ? e.message : "Could not send message";
    res.status(400).json({ error: msg });
  }
});

const presignSchema = z.object({
  ticketId: z.string().uuid(),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
});

supportRouter.post("/presign", limiter, async (req, res, next) => {
  const parsed = presignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    if (!isSupportUploadConfigured()) {
      res.status(503).json({ error: "File uploads are not enabled on this server" });
      return;
    }
    const conv = await getOrCreateUserSupportConversation(req.user!.id);
    if (conv.ticket.id !== parsed.data.ticketId) {
      res.status(403).json({ error: "Invalid ticket" });
      return;
    }
    const data = await createSupportAttachmentPresignedPut({
      userId: req.user!.id,
      ticketId: parsed.data.ticketId,
      fileName: parsed.data.fileName,
      contentType: parsed.data.contentType,
    });
    res.json({ data });
  } catch (e) {
    next(e);
  }
});
