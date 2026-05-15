import type { AssetSymbol } from "@/types";

const BTC_HASH = /^[a-fA-F0-9]{64}$/;
const ETH_TX = /^0x[a-fA-F0-9]{64}$/;
const TRON_USDT = /^[a-fA-F0-9]{64}$/;

/** Basic format checks — always re-verify amount/confirmations on-chain in admin tooling. */
export function validateTxHash(asset: AssetSymbol, hash: string): { ok: true } | { ok: false; error: string } {
  const trimmed = hash.trim();
  if (!trimmed) return { ok: false, error: "Transaction hash is required." };
  if (asset === "BTC" && BTC_HASH.test(trimmed)) return { ok: true };
  if (asset === "ETH" && ETH_TX.test(trimmed)) return { ok: true };
  if (asset === "USDT" && (ETH_TX.test(trimmed) || TRON_USDT.test(trimmed)))
    return { ok: true };
  return { ok: false, error: "Hash format does not match the selected asset network." };
}
