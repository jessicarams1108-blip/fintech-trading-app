import type { AssetSymbol } from "@/types";

/** Shown when the API is offline so the deposit UI still works for layout / QR preview. */
export function offlineDepositConfig(asset: AssetSymbol): {
  address: string;
  network: string;
  note: string;
} {
  const common =
    "Offline preview — start the backend (npm run dev:server) to load live config from the server.";
  switch (asset) {
    case "BTC":
      return {
        address: "1AKtbnngZEL8UcvW81XQKPb6B9cWskP6ne",
        network: "Bitcoin",
        note: "Only send BTC to this address. Do not send other assets. " + common,
      };
    case "ETH":
      return {
        address: "0x000000000000000000000000000000000000dEaD",
        network: "Ethereum (demo)",
        note: "Demo address for layout only. " + common,
      };
    case "USDT":
      return {
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        network: "Ethereum (ERC-20 demo)",
        note: "Demo address for layout only. " + common,
      };
  }
}
