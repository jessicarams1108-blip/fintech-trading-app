import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateRequired } from "../middleware/auth.js";
import { env } from "../env.js";
import { getUserKyc, setKycVerifiedDemo } from "../db/queries/liquidity.js";
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
});
export const kycRouter = Router();
kycRouter.post("/submit", limiter, authenticateRequired, async (req, res) => {
    const kyc = await getUserKyc(req.user.id);
    if (kyc.kyc_status === "verified") {
        res.status(400).json({ error: "Identity is already verified." });
        return;
    }
    if (kyc.kyc_status === "pending") {
        res.status(409).json({ error: "A verification request is already pending review." });
        return;
    }
    res.status(400).json({
        error: "Use the identity verification form at /verify-identity to submit your documents and details.",
    });
});
const demoSchema = z.object({
    tier: z.coerce.number().int().min(1).max(3).default(2),
});
kycRouter.post("/demo-verify", limiter, authenticateRequired, async (req, res) => {
    if (!env.OOVE_DEMO_KYC) {
        res.status(403).json({ error: "Test verification is disabled on this server." });
        return;
    }
    const parsed = demoSchema.safeParse(req.body ?? {});
    const tier = parsed.success ? parsed.data.tier : 2;
    await setKycVerifiedDemo(req.user.id, tier);
    res.json({ message: "Identity verified.", kycStatus: "verified", kycTier: tier });
});
kycRouter.get("/status", limiter, authenticateRequired, async (req, res) => {
    const kyc = await getUserKyc(req.user.id);
    res.json({ kycStatus: kyc.kyc_status, kycTier: kyc.kyc_tier, demoKycEnabled: env.OOVE_DEMO_KYC });
});
