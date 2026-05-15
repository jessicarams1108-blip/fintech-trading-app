export type AssetSymbol = "BTC" | "ETH" | "USDT";

export type DepositStatus =
  | "awaiting_payment"
  | "pending_review"
  | "confirmed"
  | "rejected";

export type TxActivityStatus = "Pending" | "Confirmed" | "Failed";

export type HoldingRow = {
  asset: AssetSymbol | string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  dayChangePct: number;
};

export type ActivityRow = {
  id: string;
  label: string;
  amount: string;
  status: TxActivityStatus;
  at: string;
};

export type WatchRow = {
  symbol: string;
  price: number;
  changePct: number;
};

export type PendingDepositDto = {
  id: string;
  userEmail: string;
  asset: AssetSymbol;
  amount: string | null;
  declaredAmountUsd: string | null;
  txHash: string;
  proofImageUrl: string | null;
  createdAt: string;
  status: DepositStatus;
};

export type DepositActivityDto = {
  id: string;
  asset: AssetSymbol;
  txHash: string;
  status: "pending_review" | "confirmed" | "rejected";
  declaredAmountUsd: string | null;
  creditedAmount: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
