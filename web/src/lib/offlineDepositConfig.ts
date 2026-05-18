import type { AssetSymbol } from "@/types";
import {
  DEPOSIT_NETWORK_LABEL,
  DEPOSIT_TREASURY_BTC_ADDRESS,
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
  const common =
    "Offline preview — start the backend (npm run dev:server) to load live config from the server.";
  return {
    address: DEPOSIT_TREASURY_BTC_ADDRESS,
    network: DEPOSIT_NETWORK_LABEL[asset] ?? asset,
    note: `Send only ${asset} to this address. Placeholder wallet in use for all assets until updated. ${common}`,
    minDeclaredUsd: MIN_DEPOSIT_USD,
    maxDeclaredUsd: MAX_DEPOSIT_USD,
  };
}
