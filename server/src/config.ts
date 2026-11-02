/** Server-side treasury addresses served to deposit UI. */

export const WALLET_ADDRESSES = {
  BTC: "bc1qassfs34ahccxgdx5ch4cswt7jvt25a529sxk58",
  ETH: "0x395216b91CF96F1dFC5a6E0bdF28F54762D61891",
  USDT: "TDmFXkmWyYkbYxW8HzRKTZLb7rxtsr5U3s",
  SOL: "678v6aJqB1oo3bpdFdLFovKrDCQ2ejPKD9PFv1XtMRvd",
} as const;

export type WalletAssetKey = keyof typeof WALLET_ADDRESSES;

export const DEPOSIT_ASSET_KEYS = ["BTC", "USDT", "ETH", "SOL"] as const;

export type DepositAssetKey = (typeof DEPOSIT_ASSET_KEYS)[number];

export function isDepositAssetKey(raw: string): raw is DepositAssetKey {
  return (DEPOSIT_ASSET_KEYS as readonly string[]).includes(raw);
}
