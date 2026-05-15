export type DepositStatus = "awaiting_payment" | "pending_review" | "confirmed" | "rejected";

export type DepositAsset = "BTC" | "ETH" | "USDT";

export type PendingDepositDto = {
  id: string;
  userEmail: string;
  asset: DepositAsset;
  amount: string | null;
  declaredAmountUsd: string | null;
  txHash: string;
  proofImageUrl: string | null;
  createdAt: string;
  status: DepositStatus;
};
