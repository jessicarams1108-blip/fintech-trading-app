import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import { WALLET_ADDRESSES } from "../config.js";
import { getUsdPrices } from "../lib/market.js";
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
const trimmedString = (min, max) => z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(min).max(max));
const withdrawSchema = z
    .object({
    method: z.enum(["crypto", "wire"]).default("crypto"),
    asset: z.string().min(2).max(12).optional(),
    amountUsd: z.coerce.number().positive().optional(),
    amount: z.coerce.number().positive().optional(),
    destination: z.string().min(1).max(200).optional(),
    bankName: trimmedString(2, 120).optional(),
    bankAccountNumber: trimmedString(4, 40).optional(),
    bankRoutingNumber: trimmedString(4, 40).optional(),
})
    .superRefine((d, ctx) => {
    if (d.amountUsd == null && d.amount == null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["amountUsd"],
            message: "Enter the amount to withdraw",
        });
    }
    if (d.method === "wire") {
        if (!d.bankName)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankName"], message: "Bank name is required" });
        if (!d.bankAccountNumber)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankAccountNumber"], message: "Account number is required" });
        if (!d.bankRoutingNumber)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankRoutingNumber"], message: "Routing number is required" });
        if (d.amountUsd == null)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountUsd"], message: "Amount (USD) is required" });
    }
    else {
        if (!d.asset)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["asset"], message: "Choose an asset" });
        if (!d.destination || d.destination.trim().length < 8)
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["destination"],
                message: "Enter a destination address (8+ characters)",
            });
    }
});
async function usdToAssetAmount(assetRaw, amountUsd) {
    const sym = assetRaw.trim().toUpperCase();
    const prices = await getUsdPrices();
    const spot = prices[sym];
    if (spot === undefined || !Number.isFinite(spot) || spot <= 0) {
        return { ok: false, error: `No USD price available for ${sym}` };
    }
    const units = amountUsd / spot;
    const amount = units.toFixed(18).replace(/\.?0+$/, "");
    return { ok: true, amount: amount === "" || amount === "-0" ? "0" : amount };
}
transfersRouter.post("/withdraw", limiter, async (req, res, next) => {
    const parsed = withdrawSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: parsed.error.flatten() });
        return;
    }
    try {
        if (parsed.data.method === "wire") {
            const amountUsd = parsed.data.amountUsd;
            const destination = parsed.data.destination?.trim() ||
                `Wire to ${parsed.data.bankName} • A/C ****${parsed.data.bankAccountNumber.slice(-4)} • ABA ${parsed.data.bankRoutingNumber}`;
            const id = await createWithdrawalRequest({
                userId: req.user.id,
                asset: "USDT",
                amount: String(amountUsd),
                destination,
                feeUsd: 0,
                amountUsd: String(amountUsd),
                method: "wire",
                bankName: parsed.data.bankName,
                bankAccountNumber: parsed.data.bankAccountNumber,
                bankRoutingNumber: parsed.data.bankRoutingNumber,
            });
            res.status(201).json({ data: { id, status: "pending_admin", method: "wire", amountUsd } });
            return;
        }
        const asset = parsed.data.asset.toUpperCase();
        let amountStr;
        let amountUsd;
        if (parsed.data.amountUsd != null) {
            amountUsd = parsed.data.amountUsd;
            const conv = await usdToAssetAmount(asset, amountUsd);
            if (!conv.ok) {
                res.status(400).json({ error: conv.error });
                return;
            }
            amountStr = conv.amount;
        }
        else {
            amountStr = String(parsed.data.amount);
        }
        const id = await createWithdrawalRequest({
            userId: req.user.id,
            asset,
            amount: amountStr,
            destination: parsed.data.destination,
            feeUsd: 0,
            amountUsd: amountUsd != null ? String(amountUsd) : null,
            method: "crypto",
        });
        res.status(201).json({ data: { id, status: "pending_admin", method: "crypto", amountUsd } });
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
        const prices = await getUsdPrices();
        const withdrawals = w.map((row) => {
            const r = row;
            const amountUsd = r.amount_usd != null && r.amount_usd !== ""
                ? r.amount_usd
                : (() => {
                    const spot = prices[r.asset];
                    const units = Number.parseFloat(r.amount);
                    if (!Number.isFinite(spot) || spot <= 0 || !Number.isFinite(units))
                        return null;
                    return (units * spot).toFixed(2);
                })();
            return { ...row, amount_usd: amountUsd };
        });
        res.json({ data: { withdrawals, combined: h } });
    }
    catch (e) {
        next(e);
    }
});
