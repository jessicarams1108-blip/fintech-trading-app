import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Settings2, Share2, Square } from "lucide-react";
import clsx from "clsx";
import { intervalToDuration } from "date-fns";
import { useAuth } from "@/state/AuthContext";
import {
  depositToAiWallet,
  fetchAiBalance,
  fetchAiHistory,
  formatTradeResult,
} from "@/lib/aiTradingApi";
import { AiTradingTopBar } from "@/components/ai-trading/AiTradingTopBar";
import { AiTradingUnderlineTabs } from "@/components/ai-trading/AiTradingUnderlineTabs";
import { FakeLiveChart } from "@/components/ai-trading/FakeLiveChart";
import { ai } from "@/lib/aiTradingTheme";

const PORTFOLIO_TABS = ["Return", "Income", "Account value", "Allocation"] as const;
const RANGES = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "All"] as const;

function weekCountdown(ms: number): string {
  if (ms <= 0) return "soon";
  const d = intervalToDuration({ start: 0, end: ms });
  const parts: string[] = [];
  if (d.days) parts.push(`${d.days}d`);
  if (d.hours) parts.push(`${d.hours}h`);
  if (!d.days && d.minutes) parts.push(`${d.minutes}m`);
  return parts.join(" ") || "<1m";
}

export function AiTradingPortfolioPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof PORTFOLIO_TABS)[number]>("Return");
  const [range, setRange] = useState<(typeof RANGES)[number]>("1M");
  const [depositAmt, setDepositAmt] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);

  const balanceQ = useQuery({
    queryKey: ["ai-balance", token],
    enabled: !!token,
    queryFn: () => fetchAiBalance(token!),
    refetchInterval: 15_000,
  });

  const historyQ = useQuery({
    queryKey: ["ai-history", token],
    enabled: !!token,
    queryFn: () => fetchAiHistory(token!),
    refetchInterval: 10_000,
  });

  const depositMut = useMutation({
    mutationFn: (amount: number) => depositToAiWallet(token!, amount),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ai-balance"] });
      void qc.invalidateQueries({ queryKey: ["portfolio"] });
      void qc.invalidateQueries({ queryKey: ["liquidity"] });
      setShowDeposit(false);
      setDepositAmt("");
    },
  });

  const running = useMemo(
    () => (historyQ.data ?? []).find((t) => t.status === "running"),
    [historyQ.data],
  );

  const bal = balanceQ.data;
  const balance = bal?.balance ?? 0;

  return (
    <div className="pb-6">
      <AiTradingTopBar />

      <p className="px-4 pt-2 text-[2.75rem] font-semibold leading-none tracking-tight">
        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>

      <AiTradingUnderlineTabs tabs={PORTFOLIO_TABS} active={tab} onChange={setTab} />

      <div className="relative mt-2 px-2">
        <FakeLiveChart height={220} baseValue={Math.max(100, balance)} accent={ai.blue} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {running ? (
            <Link
              to={`/ai-trading/trade/${running.id}`}
              className="pointer-events-auto rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md"
            >
              View active trade
            </Link>
          ) : (
            <Link
              to="/ai-trading/markets"
              className="pointer-events-auto rounded-full bg-white px-8 py-3 text-[15px] font-semibold text-black shadow-lg"
            >
              Start investing
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-4">
        <div className="flex gap-3 overflow-x-auto scrollbar-none">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={clsx(
                "shrink-0 text-xs font-medium",
                range === r ? "text-white" : "text-[#8E8E93]",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 gap-3 text-[#8E8E93]">
          <Settings2 className="h-4 w-4" />
          <Square className="h-4 w-4" />
          <Share2 className="h-4 w-4" />
        </div>
      </div>

      {!bal?.canTrade ? (
        <p className="mt-2 px-4 text-center text-xs text-amber-400">
          2 trades/week limit reached · resets in {weekCountdown(bal?.msUntilWeekReset ?? 0)}
        </p>
      ) : (
        <p className="mt-2 px-4 text-center text-xs text-[#8E8E93]">
          {bal?.tradesThisWeek ?? 0}/{bal?.maxTradesPerWeek ?? 2} AI trades this week
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowDeposit((s) => !s)}
        className="mx-4 mt-6 flex w-[calc(100%-2rem)] items-center justify-between border-b border-white/[0.06] py-4 text-left"
      >
        <span className="text-[17px] text-white">Buying power</span>
        <span className="flex items-center gap-1 text-[17px] text-white">
          ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          <ChevronRight className="h-5 w-5 text-[#8E8E93]" />
        </span>
      </button>

      {showDeposit ? (
        <div className="mx-4 mb-2 flex gap-2">
          <input
            type="number"
            min={bal?.minTradeUsd ?? 100}
            value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value)}
            placeholder={`Deposit min $${bal?.minTradeUsd ?? 100}`}
            className="flex-1 rounded-xl border border-white/10 bg-[#1C1C1E] px-3 py-2.5 text-sm text-white outline-none focus:border-oove-blue"
          />
          <button
            type="button"
            disabled={depositMut.isPending}
            onClick={() => {
              const n = Number.parseFloat(depositAmt);
              if (Number.isFinite(n)) depositMut.mutate(n);
            }}
            className="rounded-xl bg-oove-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {depositMut.isPending ? "…" : "Fund"}
          </button>
        </div>
      ) : null}
      {depositMut.isError ? (
        <p className="mx-4 mb-2 text-xs text-[#FF453A]">{(depositMut.error as Error).message}</p>
      ) : null}

      <div
        className="mx-4 mt-4 overflow-hidden rounded-2xl p-4"
        style={{ background: `linear-gradient(135deg, ${ai.blue}33 0%, #1C1C1E 60%)` }}
      >
        <p className="text-sm font-semibold text-white">AI Agent Trading</p>
        <p className="mt-1 text-xs leading-relaxed text-[#8E8E93]">
          Deposit, pick crypto, stocks, options, or bonds — the agent trades while you relax and make profit.
        </p>
        <Link to="/ai-trading/markets" className="mt-3 inline-flex items-center text-sm font-medium text-oove-blue">
          Browse markets <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mx-4 mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI trade history</h2>
        </div>
        <div className="space-y-0 divide-y divide-white/[0.06] rounded-2xl overflow-hidden" style={{ backgroundColor: ai.card }}>
          {(historyQ.data ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#8E8E93]">No trades yet — fund wallet and start investing</p>
          ) : (
            (historyQ.data ?? []).map((t) => (
              <Link
                key={t.id}
                to={t.status === "running" ? `/ai-trading/trade/${t.id}` : "#"}
                className="flex items-center justify-between px-4 py-3.5"
              >
                <div>
                  <p className="font-medium text-white">{t.asset}</p>
                  <p className="text-xs text-[#8E8E93]">
                    {new Date(t.start_time).toLocaleDateString()} · ${t.amount.toLocaleString()}
                  </p>
                </div>
                <span
                  className={clsx(
                    "text-sm font-semibold",
                    t.status === "running"
                      ? "text-amber-400"
                      : t.result_type === "profit"
                        ? "text-oove-green"
                        : t.result_type === "loss"
                          ? "text-[#FF453A]"
                          : "text-[#8E8E93]",
                  )}
                >
                  {formatTradeResult(t)}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
