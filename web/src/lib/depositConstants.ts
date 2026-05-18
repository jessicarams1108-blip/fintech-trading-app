import type { AssetSymbol } from "@/types";

/** Placeholder treasury — same BTC address for all assets until per-asset wallets are configured. */
export const DEPOSIT_TREASURY_BTC_ADDRESS = "1AKtbnngZEL8UcvW81XQKPb6B9cWskP6ne";

export const DEPOSIT_ASSETS: AssetSymbol[] = ["BTC", "USDT", "ETH", "SOL"];

export const MIN_DEPOSIT_USD = 100;
export const MAX_DEPOSIT_USD = 1_000_000;

export const BUY_CRYPTO_PLATFORMS = [
  { name: "Changelly", url: "https://changelly.com/" },
  { name: "Coinbase", url: "https://www.coinbase.com/" },
  { name: "Crypto.com", url: "https://crypto.com/" },
] as const;

export const DEPOSIT_NETWORK_LABEL: Record<AssetSymbol, string> = {
  BTC: "Bitcoin",
  USDT: "Ethereum (ERC-20)",
  ETH: "Ethereum",
  SOL: "Solana",
};

export function depositStepsForAsset(asset: AssetSymbol): string[] {
  return [
    "Copy the wallet address above.",
    `Go to changelly.com and choose ${asset} as the asset you want to buy.`,
    "Click Buy and enter your amount.",
    "Click Next step.",
    "Paste the wallet address you copied and click Confirm.",
    "Add your payment method.",
    "Click Buy to complete the purchase.",
    "Return here, click “I've made the payment”, upload your screenshot, and submit for review.",
  ];
}
