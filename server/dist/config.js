/** Server-side treasury addresses served to deposit UI. */
export const WALLET_ADDRESSES = {
    BTC: "bc1q7q9a3wq5u0ar6lmh2ejjpdq69qyl6zhsnd5vkn",
    ETH: "0x28ef19b22c74de8557a20184cadb0ced916529fd",
    USDT: "0x28ef19b22c74de8557a20184cadb0ced916529fd",
    SOL: "8MjSm42WSq8rbXAPGUoNgUcKUhVK8UGF41hL4FtHCnAN",
};
export const DEPOSIT_ASSET_KEYS = ["BTC", "USDT", "ETH", "SOL"];
export function isDepositAssetKey(raw) {
    return DEPOSIT_ASSET_KEYS.includes(raw);
}
