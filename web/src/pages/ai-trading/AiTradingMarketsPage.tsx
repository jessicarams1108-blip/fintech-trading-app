import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Info } from "lucide-react";
import { useAuth } from "@/state/AuthContext";
import { AiTradingPageLayout } from "@/components/ai-trading/AiTradingPageLayout";
import { AiTradingUnderlineTabs } from "@/components/ai-trading/AiTradingUnderlineTabs";
import {
  FilterPills,
  MarketStockCards,
  MarketTableHeader,
  MarketTableRows,
} from "@/components/ai-trading/MarketListPublic";
import { StartTradeModal } from "@/components/ai-trading/StartTradeModal";
import {
  BOND_FILTER_PILLS,
  HARDCODED_BONDS,
  HARDCODED_OPTIONS,
  OPTIONS_FILTER_PILLS,
  STOCK_FILTER_PILLS,
  type MarketRow,
} from "@/lib/aiMarketsData";
import { fetchLiveCrypto, fetchLiveStocks } from "@/lib/aiMarketsLive";
import { fetchAiBalance, startAiTrade } from "@/lib/aiTradingApi";
import { ai } from "@/lib/aiTradingTheme";

const TABS = ["Stocks", "Crypto", "Options", "Bonds"] as const;

export function AiTradingMarketsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Stocks");
  const [stockPill, setStockPill] = useState<string>(STOCK_FILTER_PILLS[2]);
  const [bondPill, setBondPill] = useState<string>(BOND_FILTER_PILLS[0]);
  const [optPill, setOptPill] = useState<string>(OPTIONS_FILTER_PILLS[0]);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [pick, setPick] = useState<{ asset: string; assetClass: string } | null>(null);

  const balanceQ = useQuery({
    queryKey: ["ai-balance", token],
    enabled: !!token,
    queryFn: () => fetchAiBalance(token!),
  });

  const cryptoQ = useQuery({
    queryKey: ["ai-crypto-live"],
    queryFn: fetchLiveCrypto,
    staleTime: 60_000,
    enabled: tab === "Crypto",
  });

  const stocksQ = useQuery({
    queryKey: ["ai-stocks-live"],
    queryFn: fetchLiveStocks,
    staleTime: 120_000,
    enabled: tab === "Stocks",
  });

  const sortedStocks = useMemo(() => {
    const rows = stocksQ.data ?? [];
    const copy = [...rows];
    if (stockPill.includes("gainers")) copy.sort((a, b) => b.change24h - a.change24h);
    else if (stockPill.includes("losers")) copy.sort((a, b) => a.change24h - b.change24h);
    return copy;
  }, [stocksQ.data, stockPill]);

  const sortedBonds = useMemo(() => {
    const copy = [...HARDCODED_BONDS];
    if (bondPill.includes("yield")) copy.sort((a, b) => (b.yieldPct ?? 0) - (a.yieldPct ?? 0));
    return copy;
  }, [bondPill]);

  function openTrade(row: MarketRow, assetClass: string) {
    setPick({ asset: row.symbol, assetClass });
    setTradeOpen(true);
  }

  return (
    <AiTradingPageLayout title="Markets" description="Pick a market and start an AI trade.">
      <AiTradingUnderlineTabs tabs={TABS} active={tab} onChange={setTab} showFilter />

      {tab === "Stocks" && (
        <>
          <SectionHead title="Explore stocks & ETFs" link="View all" />
          <FilterPills pills={STOCK_FILTER_PILLS} active={stockPill} onChange={setStockPill} />
          {stocksQ.isLoading ? (
            <Loading />
          ) : (
            <MarketStockCards rows={sortedStocks} onPick={(r) => openTrade(r, "stocks")} />
          )}
        </>
      )}

      {tab === "Crypto" && (
        <>
          <SectionHead title="Explore crypto" extra="Market cap" />
          {cryptoQ.isLoading ? (
            <Loading />
          ) : cryptoQ.isError ? (
            <ErrorMsg msg="Could not load crypto markets" />
          ) : (
            <>
              <MarketTableHeader cols={["Name", "Price", "1D change"]} />
              <MarketTableRows rows={cryptoQ.data ?? []} onPick={(r) => openTrade(r, "crypto")} />
            </>
          )}
        </>
      )}

      {tab === "Options" && (
        <>
          <SectionHead title="Options trading volume" link="View all" />
          <FilterPills pills={OPTIONS_FILTER_PILLS} active={optPill} onChange={setOptPill} />
          <MarketTableHeader cols={["Name", "Price", "1D change"]} />
          <MarketTableRows rows={HARDCODED_OPTIONS} onPick={(r) => openTrade(r, "stocks")} />
          <HubCard
            title="Options hub"
            body="Research, build, and execute options strategies with the AI agent."
            accent={ai.blue}
          />
        </>
      )}

      {tab === "Bonds" && (
        <>
          <SectionHead title="Explore bonds" />
          <FilterPills pills={BOND_FILTER_PILLS} active={bondPill} onChange={setBondPill} />
          <MarketTableHeader cols={["Name", "Maturity", "Yield"]} />
          <BondRows rows={sortedBonds} onPick={(r) => openTrade(r, "stocks")} />
          <HubCard
            title="Bonds Hub"
            body="Explore and invest in bonds via AI agent. Simulated educational trading."
            accent={ai.blue}
          />
        </>
      )}

      <StartTradeModal
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        balance={balanceQ.data?.balance ?? 0}
        minAmount={balanceQ.data?.minTradeUsd ?? 1000}
        maxAmount={balanceQ.data?.maxTradeUsd ?? 1_000_000}
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
    </AiTradingPageLayout>
  );
}

function SectionHead({ title, link, extra }: { title: string; link?: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
        {title}
        <Info className="h-3.5 w-3.5 text-slate-500" />
      </span>
      {link ? (
        <button type="button" className="text-sm font-medium text-oove-blue">
          {link}
        </button>
      ) : extra ? (
        <span className="text-xs text-slate-500">{extra} ↓</span>
      ) : null}
    </div>
  );
}

function HubCard({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 p-4 shadow-sm" style={{ backgroundColor: `${accent}12` }}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold" style={{ color: accent }}>
          {title}
        </p>
        <p className="mt-1 text-xs text-slate-500">{body}</p>
      </div>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: accent }}
      >
        <ChevronRight className="h-5 w-5" />
      </span>
    </div>
  );
}

function BondRows({ rows, onPick }: { rows: MarketRow[]; onPick: (r: MarketRow) => void }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: ai.cardElevated }}
            >
              {r.symbol.slice(0, 2)}
            </span>
            <span className="min-w-0 flex-[1.4]">
              <span className="block truncate text-[15px] font-medium text-slate-900">{r.name}</span>
              <span className="text-sm text-slate-500">{r.symbol}</span>
            </span>
            <span className="flex-1 text-right text-sm text-slate-500">{r.maturity ?? "—"}</span>
            <span className="w-16 text-right text-sm font-medium text-oove-blue">
              {r.yieldPct != null ? `${r.yieldPct.toFixed(2)}%` : "—"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Loading() {
  return <p className="py-12 text-center text-sm text-slate-500">Loading live markets…</p>;
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="py-12 text-center text-sm text-[#FF453A]">{msg}</p>;
}

