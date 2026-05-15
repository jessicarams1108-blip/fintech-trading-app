import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import { authenticateRequired, requireAdmin } from "../middleware/auth.js";
import {
  adminAdjustWalletBalance,
  approveBorrowRequestAdmin,
  approveTransferRequestAdmin,
  listPendingBorrowRequestsAdmin,
  listPendingTransferRequestsAdmin,
  rejectBorrowRequestAdmin,
  rejectTransferRequestAdmin,
} from "../db/queries/adminQueues.js";
import {
  approveWithdrawalAdmin,
  listPendingWithdrawalsAdmin,
  rejectWithdrawalAdmin,
} from "../db/queries/transfers.js";
import { findUserByEmail, findUserById, listLoginEligibleUsersForAdmin } from "../db/queries/users.js";
import { getUsdPrices } from "../lib/market.js";
import { SUPPORTED_WALLET_CURRENCIES } from "../lib/walletAssets.js";

function trimToUndef(v: unknown): unknown {
  if (v === "" || v === undefined || v === null) return undefined;
  return v;
}

/** Convert signed USD notional into signed asset units using live/static USD prices. */
async function amountUsdToAssetDelta(
  amountUsdRaw: string,
  assetRaw: string,
): Promise<{ ok: true; delta: string; spotUsd: number } | { ok: false; error: string }> {
  const sym = assetRaw.trim().toUpperCase();
  const s = amountUsdRaw.trim().replace(/^\+/, "");
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(s)) {
    return { ok: false, error: "Amount (USD) must be a number like 100 or -50" };
  }
  const usd = Number.parseFloat(s);
  if (!Number.isFinite(usd) || usd === 0) {
    return { ok: false, error: "Amount (USD) must be non-zero" };
  }
  const prices = await getUsdPrices();
  const spot = prices[sym];
  if (spot === undefined || !Number.isFinite(spot) || spot <= 0) {
    return {
      ok: false,
      error: `No USD price available for ${sym}. Use a supported symbol or extend the market feed.`,
    };
  }
  const units = usd / spot;
  const delta = formatSignedAssetDecimal(units);
  return { ok: true, delta, spotUsd: spot };
}

function formatSignedAssetDecimal(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  const t = n.toFixed(18).replace(/\.?0+$/, "");
  if (t === "-0") return "0";
  return t;
}

export function createAdminOpsRoutes(_io: SocketIOServer) {
  void _io;
  const router = Router();
  router.use(authenticateRequired, requireAdmin);

  router.get("/users", async (req, res, next) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const limitRaw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : NaN;
      const limit = Number.isFinite(limitRaw) ? limitRaw : 200;
      const rows = await listLoginEligibleUsersForAdmin({ q, limit });
      res.json({
        data: rows.map((r) => ({
          id: r.id,
          email: r.email,
          username: r.username,
          firstName: r.first_name,
          lastName: r.last_name,
          accountStatus: r.account_status,
          createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/queues/summary", async (_req, res, next) => {
    try {
      const [withdrawals, borrows, transfers] = await Promise.all([
        listPendingWithdrawalsAdmin(),
        listPendingBorrowRequestsAdmin(),
        listPendingTransferRequestsAdmin(),
      ]);
      res.json({ data: { withdrawals, borrows, transfers } });
    } catch (e) {
      next(e);
    }
  });

  router.get("/withdrawals/pending", async (_req, res, next) => {
    try {
      const rows = await listPendingWithdrawalsAdmin();
      res.json({ data: rows });
    } catch (e) {
      next(e);
    }
  });

  const idParam = z.string().uuid();

  router.post("/withdrawal/:id/approve", async (req, res, next) => {
    const idParsed = idParam.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: "Invalid id" });
    const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
    try {
      const out = await approveWithdrawalAdmin({
        withdrawalId: idParsed.data,
        adminUserId: req.user!.id,
        notes,
      });
      if (!out.ok) return res.status(400).json({ error: out.error });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  });

  router.post("/withdrawal/:id/reject", async (req, res, next) => {
    const idParsed = idParam.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: "Invalid id" });
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) return res.status(400).json({ error: "reason required" });
    try {
      const ok = await rejectWithdrawalAdmin({ withdrawalId: idParsed.data, reason });
      if (!ok) return res.status(400).json({ error: "Withdrawal not pending" });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  });

  router.get("/borrow-requests/pending", async (_req, res, next) => {
    try {
      const rows = await listPendingBorrowRequestsAdmin();
      res.json({ data: rows });
    } catch (e) {
      next(e);
    }
  });

  router.post("/borrow-request/:id/approve", async (req, res, next) => {
    const idParsed = idParam.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: "Invalid id" });
    try {
      const out = await approveBorrowRequestAdmin({ requestId: idParsed.data, adminUserId: req.user!.id });
      if (!out.ok) return res.status(400).json({ error: out.error });
      res.json({ data: { positionId: out.positionId } });
    } catch (e) {
      next(e);
    }
  });

  router.post("/borrow-request/:id/reject", async (req, res, next) => {
    const idParsed = idParam.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: "Invalid id" });
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) return res.status(400).json({ error: "reason required" });
    try {
      const ok = await rejectBorrowRequestAdmin({
        requestId: idParsed.data,
        adminUserId: req.user!.id,
        reason,
      });
      if (!ok) return res.status(400).json({ error: "Request not pending" });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  });

  router.get("/transfer-requests/pending", async (_req, res, next) => {
    try {
      const rows = await listPendingTransferRequestsAdmin();
      res.json({ data: rows });
    } catch (e) {
      next(e);
    }
  });

  router.post("/transfer-request/:id/approve", async (req, res, next) => {
    const idParsed = idParam.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: "Invalid id" });
    try {
      const out = await approveTransferRequestAdmin({ requestId: idParsed.data, adminUserId: req.user!.id });
      if (!out.ok) return res.status(400).json({ error: out.error });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  });

  router.post("/transfer-request/:id/reject", async (req, res, next) => {
    const idParsed = idParam.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: "Invalid id" });
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) return res.status(400).json({ error: "reason required" });
    try {
      const ok = await rejectTransferRequestAdmin({
        requestId: idParsed.data,
        adminUserId: req.user!.id,
        reason,
      });
      if (!ok) return res.status(400).json({ error: "Request not pending" });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  });

  const balanceSchema = z
    .object({
      userId: z.preprocess(trimToUndef, z.string().uuid().optional()),
      email: z.preprocess(trimToUndef, z.string().email().optional()),
      asset: z
        .string()
        .min(1)
        .max(12)
        .transform((s) => s.trim().toUpperCase())
        .pipe(z.enum(SUPPORTED_WALLET_CURRENCIES)),
      /** Raw wallet units (advanced). Omit when using amountUsd. */
      delta: z.preprocess(trimToUndef, z.string().max(50).optional()),
      /** Signed US dollar notional (e.g. 100 or -50); converted to asset units via live USD price. */
      amountUsd: z.preprocess(trimToUndef, z.string().max(40).optional()),
    })
    .superRefine((data, ctx) => {
      if (!data.userId && !data.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide userId or email",
          path: ["userId"],
        });
      }
      const hasUsd = Boolean(data.amountUsd?.trim());
      const hasDelta = Boolean(data.delta?.trim());
      if (!hasUsd && !hasDelta) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide amountUsd (dollar value) or delta (raw asset units)",
          path: ["amountUsd"],
        });
      }
      if (hasUsd && hasDelta) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Send only one of amountUsd or delta, not both",
          path: ["amountUsd"],
        });
      }
    });

  router.post("/user/balance-adjust", async (req, res, next) => {
    const parsed = balanceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
    try {
      let userId: string;
      if (parsed.data.userId) {
        const u = await findUserById(parsed.data.userId);
        if (!u) return res.status(404).json({ error: "User not found" });
        if (u.account_status === "pending_verification") {
          return res.status(400).json({ error: "User has not finished email verification yet" });
        }
        userId = u.id;
      } else {
        const email = parsed.data.email!.trim().toLowerCase();
        const u = await findUserByEmail(email);
        if (!u) return res.status(404).json({ error: "User not found" });
        if (u.account_status === "pending_verification") {
          return res.status(400).json({ error: "User has not finished email verification yet" });
        }
        userId = u.id;
      }
      let resolvedDelta: string;
      let meta: { spotUsd: number; usedAmountUsd: string } | undefined;
      if (parsed.data.amountUsd?.trim()) {
        const conv = await amountUsdToAssetDelta(parsed.data.amountUsd.trim(), parsed.data.asset);
        if (!conv.ok) return res.status(400).json({ error: conv.error });
        resolvedDelta = conv.delta;
        meta = { spotUsd: conv.spotUsd, usedAmountUsd: parsed.data.amountUsd.trim() };
      } else {
        resolvedDelta = parsed.data.delta!.trim();
      }
      const out = await adminAdjustWalletBalance({
        userId,
        asset: parsed.data.asset,
        delta: resolvedDelta,
        adminUserId: req.user!.id,
      });
      if (!out.ok) return res.status(400).json({ error: out.error });
      res.json({
        data: {
          newBalance: out.newBalance,
          appliedDelta: out.appliedDelta,
          ...(out.debitClamped ? { requestedDelta: resolvedDelta } : {}),
          ...(meta ? { spotUsd: meta.spotUsd, usedAmountUsd: meta.usedAmountUsd } : {}),
        },
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
