/** Server-side treasury addresses served to deposit UI. */

export const DEPOSIT_TREASURY_BTC_ADDRESS = "1AKtbnngZEL8UcvW81XQKPb6B9cWskP6ne";

/** Per-asset overrides; unset assets use the BTC placeholder until configured. */
export const WALLET_ADDRESSES = {
  BTC: DEPOSIT_TREASURY_BTC_ADDRESS,
  USDT: DEPOSIT_TREASURY_BTC_ADDRESS,
  ETH: DEPOSIT_TREASURY_BTC_ADDRESS,
  SOL: DEPOSIT_TREASURY_BTC_ADDRESS,
} as const;

export type WalletAssetKey = keyof typeof WALLET_ADDRESSES;

export const DEPOSIT_ASSET_KEYS = ["BTC", "USDT", "ETH", "SOL"] as const;

export type DepositAssetKey = (typeof DEPOSIT_ASSET_KEYS)[number];

export function isDepositAssetKey(raw: string): raw is DepositAssetKey {
  return (DEPOSIT_ASSET_KEYS as readonly string[]).includes(raw);
}
