import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateRequired } from "../middleware/auth.js";
import { getUserKyc, getUserWallets, suppliedUsdFromWallets } from "../db/queries/liquidity.js";
import { sumActiveBorrowUsd } from "../db/queries/borrow.js";
import {
  canBorrowNow,
  effectiveMaxBorrowUsd,
  availableBorrowUsd,
  MIN_SUPPLIED_USD_TO_BORROW,
  tierBorrowCap,
} from "../lib/borrowPolicy.js";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

export const liquidityRouter = Router();

liquidityRouter.get("/summary", limiter, authenticateRequired, async (req, res) => {
  try {
    const userId = req.user!.id;
    const wallets = await getUserWallets(userId);
    const suppliedUsd = suppliedUsdFromWallets(wallets);
    const kyc = await getUserKyc(userId);
    const outstandingBorrowUsd = await sumActiveBorrowUsd(userId);
    const grossMaxBorrowUsd =
      Math.round(
        effectiveMaxBorrowUsd({
          suppliedUsd,
          kycStatus: kyc.kyc_status,
          kycTier: kyc.kyc_tier,
        }) * 100,
      ) / 100;
    const maxBorrowUsd =
      Math.round(
        availableBorrowUsd({
          suppliedUsd,
          kycStatus: kyc.kyc_status,
          kycTier: kyc.kyc_tier,
          outstandingBorrowUsd,
        }) * 100,
      ) / 100;
    const { ok, reasons } = canBorrowNow({
      suppliedUsd,
      kycStatus: kyc.kyc_status,
      kycTier: kyc.kyc_tier,
      outstandingBorrowUsd,
    });
    const canBorrow = ok && maxBorrowUsd > 0;
    const netSupplyApyPct =
      suppliedUsd > 0 ? Math.round((3.2 + Math.min(1.5, outstandingBorrowUsd / Math.max(suppliedUsd, 1)) * 0.8) * 10) / 10 : 0;

    res.json({
      suppliedUsd,
      outstandingBorrowUsd,
      grossMaxBorrowUsd,
      kycStatus: kyc.kyc_status,
      kycTier: kyc.kyc_tier,
      tierCapUsd: tierBorrowCap(kyc.kyc_tier),
      minSuppliedUsdToBorrow: MIN_SUPPLIED_USD_TO_BORROW,
      maxBorrowUsd,
      canBorrow,
      borrowBlockedReasons: canBorrow ? [] : reasons,
      netSupplyApyPct,
      wallets: wallets.map((w) => ({
        currency: w.currency,
        balance: w.balance,
      })),
      oTokensNote:
        "Inspired by Aave: supplied assets earn yield; Oove-oToken-style receipt tokens are on the roadmap.",
    });
  } catch (e) {
    console.error("[liquidity/summary]", e);
    res.status(500).json({ error: "Unable to load liquidity summary" });
  }
});
