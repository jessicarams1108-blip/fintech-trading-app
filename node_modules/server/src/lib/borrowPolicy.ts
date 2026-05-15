/** Minimum supplied value (USD equivalent) before borrowing is allowed. */
export const MIN_SUPPLIED_USD_TO_BORROW = 10_000;

/** Max borrow cap by verified identity tier (USD principal ceiling). */
export const BORROW_CAP_BY_TIER: Record<number, number> = {
  0: 0,
  1: 30_000,
  2: 65_000,
  3: 100_000,
};

/** Conservative collateral factor on supplied value for max borrow (below LTV liquidation). */
export const COLLATERAL_FACTOR = 0.65;

export function tierBorrowCap(tier: number): number {
  const t = Math.min(3, Math.max(0, Math.floor(tier)));
  return BORROW_CAP_BY_TIER[t] ?? 0;
}

export function effectiveMaxBorrowUsd(params: {
  suppliedUsd: number;
  kycStatus: string;
  kycTier: number;
}): number {
  if (params.kycStatus !== "verified") return 0;
  const tier = Math.min(3, Math.max(0, Math.floor(params.kycTier)));
  if (tier < 1) return 0;
  if (params.suppliedUsd < MIN_SUPPLIED_USD_TO_BORROW) return 0;
  const cap = tierBorrowCap(tier);
  const collateralBased = params.suppliedUsd * COLLATERAL_FACTOR;
  return Math.min(cap, collateralBased);
}

/** Gross ceiling minus outstanding borrowed principal + accrued (USD book). */
export function availableBorrowUsd(params: {
  suppliedUsd: number;
  kycStatus: string;
  kycTier: number;
  outstandingBorrowUsd: number;
}): number {
  const gross = effectiveMaxBorrowUsd({
    suppliedUsd: params.suppliedUsd,
    kycStatus: params.kycStatus,
    kycTier: params.kycTier,
  });
  const left = gross - Math.max(0, params.outstandingBorrowUsd);
  return Math.round(Math.max(0, left) * 100) / 100;
}

export function canBorrowNow(params: {
  suppliedUsd: number;
  kycStatus: string;
  kycTier: number;
  outstandingBorrowUsd?: number;
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const outstanding = params.outstandingBorrowUsd ?? 0;
  if (params.kycStatus !== "verified") {
    reasons.push("Complete identity verification to unlock borrowing limits.");
  } else if (params.kycTier < 1) {
    reasons.push("Your verification tier must be at least Standard (Tier 1) to borrow.");
  }
  if (params.suppliedUsd < MIN_SUPPLIED_USD_TO_BORROW) {
    reasons.push(
      `Supply at least $${MIN_SUPPLIED_USD_TO_BORROW.toLocaleString("en-US")} US equivalent in supported assets before borrowing.`,
    );
  }
  const gross = effectiveMaxBorrowUsd({
    suppliedUsd: params.suppliedUsd,
    kycStatus: params.kycStatus,
    kycTier: params.kycTier,
  });
  const available = Math.max(0, gross - outstanding);
  if (available <= 0 && reasons.length === 0) {
    if (gross <= 0) {
      reasons.push("Borrow limit is zero until eligibility rules are met.");
    } else {
      reasons.push("You are at your current borrow ceiling. Repay debt to borrow more.");
    }
  }
  return { ok: reasons.length === 0 && available > 0, reasons };
}
