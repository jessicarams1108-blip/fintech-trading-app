/** Server-side treasury addresses served to deposit UI. */
export const DEPOSIT_TREASURY_BTC_ADDRESS = "1AKtbnngZEL8UcvW81XQKPb6B9cWskP6ne";
/** Per-asset overrides; unset assets use the BTC placeholder until configured. */
export const WALLET_ADDRESSES = {
    BTC: DEPOSIT_TREASURY_BTC_ADDRESS,
    USDT: DEPOSIT_TREASURY_BTC_ADDRESS,
    ETH: DEPOSIT_TREASURY_BTC_ADDRESS,
    SOL: DEPOSIT_TREASURY_BTC_ADDRESS,
};
export const DEPOSIT_ASSET_KEYS = ["BTC", "USDT", "ETH", "SOL"];
export function isDepositAssetKey(raw) {
    return DEPOSIT_ASSET_KEYS.includes(raw);
}
