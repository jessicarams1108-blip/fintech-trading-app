import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { authenticateRequired } from "../middleware/auth.js";
import { updateUserNames } from "../db/queries/users.js";
import { findUserById } from "../db/queries/users.js";
import { listSessions, revokeSession } from "../db/queries/sessions.js";
import { pool } from "../db/index.js";
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false });
export const settingsRouter = Router();
settingsRouter.use(authenticateRequired);
const profileSchema = z.object({
    firstName: z
        .union([z.string().max(80), z.literal("")])
        .optional()
        .transform((v) => (v === "" ? undefined : v)),
    lastName: z
        .union([z.string().max(80), z.literal("")])
        .optional()
        .transform((v) => (v === "" ? undefined : v)),
});
settingsRouter.patch("/profile", limiter, async (req, res, next) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: parsed.error.flatten() });
        return;
    }
    try {
        const u = await findUserById(req.user.id);
        if (!u) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        await updateUserNames(req.user.id, parsed.data.firstName ?? u.first_name, parsed.data.lastName ?? u.last_name);
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
settingsRouter.get("/sessions", limiter, async (req, res, next) => {
    try {
        const rows = await listSessions(req.user.id);
        res.json({ data: rows });
    }
    catch (e) {
        next(e);
    }
});
const revokeSchema = z.object({ sessionId: z.string().uuid() });
settingsRouter.post("/revoke-session", limiter, async (req, res, next) => {
    const parsed = revokeSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: parsed.error.flatten() });
        return;
    }
    try {
        const ok = await revokeSession(parsed.data.sessionId, req.user.id);
        res.json({ data: { revoked: ok } });
    }
    catch (e) {
        next(e);
    }
});
const pwSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
});
settingsRouter.post("/change-password", limiter, async (req, res, next) => {
    const parsed = pwSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: parsed.error.flatten() });
        return;
    }
    try {
        const u = await findUserById(req.user.id);
        if (!u) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const ok = await bcrypt.compare(parsed.data.currentPassword, u.password_hash);
        if (!ok) {
            res.status(401).json({ error: "Current password incorrect" });
            return;
        }
        const hash = await bcrypt.hash(parsed.data.newPassword, 10);
        await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1::uuid`, [req.user.id, hash]);
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
settingsRouter.post("/enable-2fa", limiter, (_req, res) => {
    res.status(404).json({ error: "Not available" });
});
settingsRouter.post("/api-keys", limiter, (_req, res) => {
    res.status(404).json({ error: "Not available" });
});
