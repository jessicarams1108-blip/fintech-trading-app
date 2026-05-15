/** Must match `wallets_currency_check` in db/schema.sql and migration 005. */
export const SUPPORTED_WALLET_CURRENCIES = ["USD", "BTC", "ETH", "USDT", "USDC", "DAI"];
export const SUPPORTED_WALLET_CURRENCY_SET = new Set(SUPPORTED_WALLET_CURRENCIES);
