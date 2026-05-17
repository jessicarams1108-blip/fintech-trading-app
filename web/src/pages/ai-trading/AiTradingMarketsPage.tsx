import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { AiTradingDisclaimer } from "@/components/ai-trading/AiTradingDisclaimer";
import { StartTradeModal } from "@/components/ai-trading/StartTradeModal";
import {
  COINGECKO_IDS,
  HARDCODED_BONDS,
  HARDCODED_OPTIONS,
  HARDCODED_STOCKS,
  type MarketRow,
} from "@/lib/aiMarketsData";
import { fetchAiBalance, startAiTrade } from "@/lib/aiTradingApi";
import { useQueryClient } from "@tanstack/react-query";

const TABS = ["Today", "Stocks", "Crypto", "Options", "Bonds"] as const;

type CoinGeckoRow = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
};

async function fetchCrypto(): Promise<MarketRow[]> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINGECKO_IDS}`,
  );
  if (!res.ok) throw new Error("Could not load crypto markets");
  const data = (await res.json()) as CoinGeckoRow[];
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol.toUpperCase(),
    price: c.current_price,
    change24h: c.price_change_percentage_24h ?? 0,
    logo: c.image,
  }));
}

function MarketList({ rows, onPick }: { rows: MarketRow[]; onPick: (r: MarketRow) => void }) {
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onPick(r)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-[#1A1A1A]"
          >
            {r.logo ? (
              <img src={r.logo} alt="" className="h-9 w-9 rounded-full bg-[#1A1A1A]" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A1A1A] text-xs font-bold text-[#9CA3AF]">
                {r.symbol.slice(0, 2)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.name}</span>
              <span className="text-xs text-[#9CA3AF]">{r.symbol}</span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-medium">
                ${r.price.toLocaleString(undefined, { maximumFractionDigits: r.price < 1 ? 4 : 2 })}
              </span>
              <span className={clsx("text-xs font-semibold", r.change24h >= 0 ? "text-emerald-400" : "text-red-400")}>
                {r.change24h >= 0 ? "+" : ""}
                {r.change24h.toFixed(2)}%
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AiTradingMarketsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Crypto");
  const [tradeOpen, setTradeOpen] = useState(false);
  const [pick, setPick] = useState<{ asset: string; assetClass: string } | null>(null);

  const balanceQ = useQuery({
    queryKey: ["ai-balance", token],
    enabled: !!token,
    queryFn: () => fetchAiBalance(token!),
  });

  const cryptoQ = useQuery({
    queryKey: ["ai-crypto-markets"],
    queryFn: fetchCrypto,
    staleTime: 60_000,
    enabled: tab === "Crypto" || tab === "Today",
  });

  const todayRows = cryptoQ.data?.slice(0, 5) ?? [];

  function openTrade(row: MarketRow, assetClass: string) {
    setPick({ asset: row.symbol, assetClass });
    setTradeOpen(true);
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="text-xl font-semibold">Markets</h1>
      <div className="mt-3">
        <AiTradingDisclaimer />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
              tab === t ? "bg-white text-black" : "bg-[#1A1A1A] text-[#9CA3AF]",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "Today" && (
          cryptoQ.isLoading ? (
            <p className="text-center text-sm text-[#9CA3AF]">Loading…</p>
          ) : (
            <MarketList rows={todayRows} onPick={(r) => openTrade(r, "crypto")} />
          )
        )}
        {tab === "Crypto" && (
          cryptoQ.isLoading ? (
            <p className="text-center text-sm text-[#9CA3AF]">Loading…</p>
          ) : cryptoQ.isError ? (
            <p className="text-center text-sm text-red-400">Failed to load crypto</p>
          ) : (
            <MarketList rows={cryptoQ.data ?? []} onPick={(r) => openTrade(r, "crypto")} />
          )
        )}
        {tab === "Stocks" && <MarketList rows={HARDCODED_STOCKS} onPick={(r) => openTrade(r, "stocks")} />}
        {tab === "Options" && <MarketList rows={HARDCODED_OPTIONS} onPick={(r) => openTrade(r, "stocks")} />}
        {tab === "Bonds" && <MarketList rows={HARDCODED_BONDS} onPick={(r) => openTrade(r, "stocks")} />}
      </div>

      <StartTradeModal
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        balance={balanceQ.data?.balance ?? 0}
        minAmount={balanceQ.data?.minTradeUsd ?? 100}
        canTrade={!!balanceQ.data?.canTrade}
        defaultAsset={pick?.asset}
        defaultClass={pick?.assetClass}
        onSubmit={async (p) => {
          const trade = await startAiTrade(token!, p);
          void qc.invalidateQueries({ queryKey: ["ai-balance"] });
          void qc.invalidateQueries({ queryKey: ["ai-history"] });
          navigate(`/ai-trading/trade/${trade.id}`);
        }}
      />
    </div>
  );
}
