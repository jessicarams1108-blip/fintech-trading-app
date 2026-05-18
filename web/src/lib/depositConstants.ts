import type { AssetSymbol } from "@/types";

/** Per-asset deposit treasury wallets (must match server/src/config.ts). */
export const DEPOSIT_WALLET_ADDRESSES: Record<AssetSymbol, string> = {
  BTC: "bc1q7q9a3wq5u0ar6lmh2ejjpdq69qyl6zhsnd5vkn",
  ETH: "0x28ef19b22c74de8557a20184cadb0ced916529fd",
  USDT: "0x28ef19b22c74de8557a20184cadb0ced916529fd",
  SOL: "8MjSm42WSq8rbXAPGUoNgUcKUhVK8UGF41hL4FtHCnAN",
};

export function depositWalletAddress(asset: AssetSymbol): string {
  return DEPOSIT_WALLET_ADDRESSES[asset];
}

/** QR payload using standard URI schemes so mobile wallets scan correctly. */
export function depositQrPayload(asset: AssetSymbol, address: string): string {
  const trimmed = address.trim();
  switch (asset) {
    case "BTC":
      return trimmed.startsWith("bitcoin:") ? trimmed : `bitcoin:${trimmed}`;
    case "ETH":
      return trimmed.startsWith("ethereum:") ? trimmed : `ethereum:${trimmed}`;
    case "USDT":
      return trimmed.startsWith("ethereum:") ? trimmed : `ethereum:${trimmed}`;
    case "SOL":
      return trimmed.startsWith("solana:") ? trimmed : `solana:${trimmed}`;
    default:
      return trimmed;
  }
}

export const DEPOSIT_ASSETS: AssetSymbol[] = ["BTC", "USDT", "ETH", "SOL"];

export const MIN_DEPOSIT_USD = 100;
export const MAX_DEPOSIT_USD = 1_000_000;

export const BUY_CRYPTO_PLATFORMS = [
  { name: "MoonPay", url: "https://www.moonpay.com/" },
  { name: "Coinbase", url: "https://www.coinbase.com/" },
  { name: "Crypto.com", url: "https://crypto.com/" },
] as const;

export const DEPOSIT_NETWORK_LABEL: Record<AssetSymbol, string> = {
  BTC: "Bitcoin",
  USDT: "Ethereum (ERC-20)",
  ETH: "Ethereum",
  SOL: "Solana",
};

export const DEPOSIT_WALLET_NOTE: Record<AssetSymbol, string> = {
  BTC: "Only send BTC to this Bitcoin address. Other assets sent here may be lost.",
  ETH: "Only send ETH to this Ethereum address.",
  USDT: "Only send USDT on Ethereum (ERC-20) to this address. Do not send other tokens.",
  SOL: "Only send SOL to this Solana address.",
};

export function depositStepsForAsset(asset: AssetSymbol): string[] {
  return [
    "Copy the wallet address above.",
    `Go to moonpay.com and choose ${asset} as the asset you want to buy.`,
    "Click Buy and enter your amount.",
    "Click Continue.",
    "Paste the wallet address you copied and confirm.",
    "Add your payment method.",
    "Complete the purchase on MoonPay.",
    "Return here, click “I've made the payment”, upload your screenshot, and submit for review.",
  ];
}
