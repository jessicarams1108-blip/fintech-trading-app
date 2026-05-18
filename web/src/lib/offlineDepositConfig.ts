import type { AssetSymbol } from "@/types";
import {
  DEPOSIT_NETWORK_LABEL,
  DEPOSIT_WALLET_NOTE,
  depositWalletAddress,
  MAX_DEPOSIT_USD,
  MIN_DEPOSIT_USD,
} from "@/lib/depositConstants";

/** Shown when the API is offline so the deposit UI still works for layout / QR preview. */
export function offlineDepositConfig(asset: AssetSymbol): {
  address: string;
  network: string;
  note: string;
  minDeclaredUsd: number;
  maxDeclaredUsd: number;
} {
  return {
    address: depositWalletAddress(asset),
    network: DEPOSIT_NETWORK_LABEL[asset] ?? asset,
    note: DEPOSIT_WALLET_NOTE[asset],
    minDeclaredUsd: MIN_DEPOSIT_USD,
    maxDeclaredUsd: MAX_DEPOSIT_USD,
  };
}
