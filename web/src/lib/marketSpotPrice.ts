import { apiFetch } from "@/lib/apiBase";

/** Live USD spot for one asset — matches home market overview pricing on the server. */
export async function fetchMarketSpotUsd(symbol: string): Promise<number> {
  const res = await apiFetch(`/api/market/price?symbol=${encodeURIComponent(symbol)}`);
  const body = (await res.json().catch(() => ({}))) as { data?: { priceUsd?: number }; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Price unavailable");
  const px = body.data?.priceUsd;
  if (typeof px !== "number" || !Number.isFinite(px) || px <= 0) throw new Error("Price unavailable");
  return px;
}

export const marketSpotPriceQueryKey = (symbol: string) => ["market", "price", symbol] as const;

export const marketSpotPriceQueryOptions = (symbol: string) => ({
  queryKey: marketSpotPriceQueryKey(symbol),
  queryFn: () => fetchMarketSpotUsd(symbol),
  staleTime: 20_000,
  refetchInterval: 25_000,
  refetchIntervalInBackground: true,
});
