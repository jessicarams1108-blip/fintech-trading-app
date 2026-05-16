import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { authenticateRequired } from "../middleware/auth.js";
import {
  findUserById,
  formatUserFullName,
  isUsernameAvailableForUser,
  parseFullName,
  updateUserNames,
  updateUsername,
} from "../db/queries/users.js";
import { listSessions, revokeSession } from "../db/queries/sessions.js";
import { pool } from "../db/index.js";
import { sendAccountChangeEmail } from "../lib/mail.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false });

export const settingsRouter = Router();
settingsRouter.use(authenticateRequired);

const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/, "Username may contain letters, numbers, and underscores only");

const profileSchema = z.object({
  fullName: z.string().max(160).optional(),
  firstName: z
    .union([z.string().max(80), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  lastName: z
    .union([z.string().max(80), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  username: usernameSchema.optional(),
});

settingsRouter.get("/profile", limiter, async (req, res, next) => {
  try {
    const u = await findUserById(req.user!.id);
    if (!u) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      data: {
        email: u.email,
        username: u.username,
        firstName: u.first_name,
        lastName: u.last_name,
        fullName: formatUserFullName(u.first_name, u.last_name),
      },
    });
  } catch (e) {
    next(e);
  }
});

settingsRouter.patch("/profile", limiter, async (req, res, next) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid profile data", details: parsed.error.flatten() });
    return;
  }
  try {
    const u = await findUserById(req.user!.id);
    if (!u) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    let nameChanged = false;
    let usernameChanged = false;

    if (parsed.data.fullName !== undefined) {
      const { firstName, lastName } = parseFullName(parsed.data.fullName);
      const prevFull = formatUserFullName(u.first_name, u.last_name);
      const nextFull = formatUserFullName(firstName, lastName);
      if (prevFull !== nextFull) {
        await updateUserNames(req.user!.id, firstName, lastName);
        nameChanged = true;
      }
    } else if (parsed.data.firstName !== undefined || parsed.data.lastName !== undefined) {
      const nextFirst = parsed.data.firstName ?? u.first_name;
      const nextLast = parsed.data.lastName ?? u.last_name;
      if (nextFirst !== u.first_name || nextLast !== u.last_name) {
        await updateUserNames(req.user!.id, nextFirst, nextLast);
        nameChanged = true;
      }
    }

    if (parsed.data.username !== undefined) {
      const norm = parsed.data.username.toLowerCase();
      const current = (u.username ?? "").toLowerCase();
      if (norm !== current) {
        const available = await isUsernameAvailableForUser(norm, req.user!.id);
        if (!available) {
          res.status(409).json({ error: "Username is taken or not allowed" });
          return;
        }
        await updateUsername(req.user!.id, norm);
        usernameChanged = true;
      }
    }

    const updated = await findUserById(req.user!.id);

    if (nameChanged) void sendAccountChangeEmail(u.email, "profile");
    if (usernameChanged) void sendAccountChangeEmail(u.email, "username");

    res.json({
      data: {
        ok: true,
        email: updated?.email ?? u.email,
        username: updated?.username ?? null,
        firstName: updated?.first_name ?? null,
        lastName: updated?.last_name ?? null,
        fullName: formatUserFullName(updated?.first_name ?? null, updated?.last_name ?? null),
      },
    });
  } catch (e) {
    next(e);
  }
});

settingsRouter.get("/sessions", limiter, async (req, res, next) => {
  try {
    const rows = await listSessions(req.user!.id);
    res.json({ data: rows });
  } catch (e) {
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
    const ok = await revokeSession(parsed.data.sessionId, req.user!.id);
    res.json({ data: { revoked: ok } });
  } catch (e) {
    next(e);
  }
});

const pwSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

settingsRouter.post("/change-password", limiter, async (req, res, next) => {
  const parsed = pwSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid password data";
    res.status(422).json({ error: msg, details: parsed.error.flatten() });
    return;
  }
  try {
    const u = await findUserById(req.user!.id);
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
    await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1::uuid`, [req.user!.id, hash]);
    void sendAccountChangeEmail(u.email, "password");
    res.json({ data: { ok: true } });
  } catch (e) {
    next(e);
  }
});

settingsRouter.post("/enable-2fa", limiter, (_req, res) => {
  res.status(404).json({ error: "Not available" });
});

settingsRouter.post("/api-keys", limiter, (_req, res) => {
  res.status(404).json({ error: "Not available" });
});
