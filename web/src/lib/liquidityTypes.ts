export type LiquiditySummary = {
  suppliedUsd: number;
  outstandingBorrowUsd: number;
  grossMaxBorrowUsd?: number;
  kycStatus: string;
  kycTier: number;
  tierCapUsd: number;
  minSuppliedUsdToBorrow: number;
  maxBorrowUsd: number;
  canBorrow: boolean;
  borrowBlockedReasons: string[];
  netSupplyApyPct?: number;
  wallets: { currency: string; balance: string }[];
  oTokensNote: string;
};
