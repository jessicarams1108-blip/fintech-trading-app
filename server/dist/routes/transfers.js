import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import { WALLET_ADDRESSES } from "../config.js";
import { createWithdrawalRequest, listWithdrawals } from "../db/queries/transfers.js";
import { insertTransferRequest, listTransferRequestsForUser } from "../db/queries/adminQueues.js";
import { listUnifiedHistory } from "../db/queries/history.js";
import { findVerifiedUserByEmail } from "../db/queries/users.js";
import { isPgUndefinedTable } from "../lib/pgErrors.js";
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false });
export const transfersRouter = Router();
transfersRouter.use(authenticateRequired);
transfersRouter.get("/deposit/address", limiter, (req, res) => {
    const raw = String(req.query.asset ?? "BTC").toUpperCase();
    if (!["BTC", "ETH", "USDT", "USDC", "DAI"].includes(raw)) {
        res.status(400).json({ error: "Unsupported asset" });
        return;
    }
    const address = raw === "BTC" ? WALLET_ADDRESSES.BTC : raw === "ETH" ? WALLET_ADDRESSES.ETH : WALLET_ADDRESSES.USDT;
    res.json({
        data: {
            asset: raw,
            address,
            note: "Treasury routing preview. ERC-20 stables share the dev contract address in this build.",
        },
    });
});
const withdrawSchema = z.object({
    asset: z.string().min(2).max(12),
    amount: z.coerce.number().positive(),
    destination: z.string().min(8).max(200),
});
transfersRouter.post("/withdraw", limiter, async (req, res, next) => {
    const parsed = withdrawSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: parsed.error.flatten() });
        return;
    }
    try {
        const id = await createWithdrawalRequest({
            userId: req.user.id,
            asset: parsed.data.asset.toUpperCase(),
            amount: String(parsed.data.amount),
            destination: parsed.data.destination,
            feeUsd: 0,
        });
        res.status(201).json({ data: { id, status: "pending_admin" } });
    }
    catch (e) {
        next(e);
    }
});
const sendSchema = z.object({
    toEmail: z.string().email(),
    asset: z.string().min(2).max(12),
    amount: z.coerce.number().positive(),
});
transfersRouter.get("/my-transfer-requests", limiter, async (req, res, next) => {
    try {
        const rows = await listTransferRequestsForUser(req.user.id, 40);
        res.json({ data: rows });
    }
    catch (e) {
        next(e);
    }
});
transfersRouter.post("/send", limiter, async (req, res, next) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: parsed.error.flatten() });
        return;
    }
    try {
        const to = await findVerifiedUserByEmail(parsed.data.toEmail);
        if (!to || to.id === req.user.id) {
            res.status(400).json({ error: "Recipient not found" });
            return;
        }
        const amountStr = String(parsed.data.amount);
        const { id } = await insertTransferRequest({
            fromUserId: req.user.id,
            toUserId: to.id,
            asset: parsed.data.asset.toUpperCase(),
            amount: amountStr,
        });
        res.status(201).json({ data: { id, status: "pending_admin" } });
    }
    catch (e) {
        if (isPgUndefinedTable(e)) {
            res.status(503).json({
                error: "Transfer requests table missing. Apply migration db/migrations/006_admin_queues.sql and restart the API.",
            });
            return;
        }
        next(e);
    }
});
transfersRouter.get("/history", limiter, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [w, h] = await Promise.all([listWithdrawals(userId, 40), listUnifiedHistory(userId, { limit: 40, offset: 0 })]);
        res.json({ data: { withdrawals: w, combined: h } });
    }
    catch (e) {
        next(e);
    }
});
