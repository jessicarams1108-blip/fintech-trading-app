/** Must match `wallets_currency_check` in db/schema.sql and migration 005. */
export const SUPPORTED_WALLET_CURRENCIES = ["USD", "BTC", "ETH", "USDT", "USDC", "DAI"] as const;

export type SupportedWalletCurrency = (typeof SUPPORTED_WALLET_CURRENCIES)[number];

export const SUPPORTED_WALLET_CURRENCY_SET = new Set<string>(SUPPORTED_WALLET_CURRENCIES);
