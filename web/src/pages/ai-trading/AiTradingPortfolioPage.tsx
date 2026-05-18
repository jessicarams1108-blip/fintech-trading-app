import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import clsx from "clsx";
import { intervalToDuration } from "date-fns";
import { useAuth } from "@/state/AuthContext";
import { fetchAiBalance, fetchAiHistory, formatTradeResult } from "@/lib/aiTradingApi";
import { AiTradingPageLayout } from "@/components/ai-trading/AiTradingPageLayout";
import { AiTradingUnderlineTabs } from "@/components/ai-trading/AiTradingUnderlineTabs";
import { FakeLiveChart } from "@/components/ai-trading/FakeLiveChart";
import { FundAiWalletModal } from "@/components/ai-trading/FundAiWalletModal";
import { AiTradingDisclaimer } from "@/components/ai-trading/AiTradingDisclaimer";
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
  const [fundOpen, setFundOpen] = useState(false);

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

  const running = useMemo(
    () => (historyQ.data ?? []).find((t) => t.status === "running"),
    [historyQ.data],
  );

  const bal = balanceQ.data;
  const balance = bal?.balance ?? 0;

  return (
    <AiTradingPageLayout description="Simulated trading for education. Fund your AI wallet from CashBox, then trade with the agent.">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">AI wallet balance</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">
          ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>

        <AiTradingUnderlineTabs tabs={PORTFOLIO_TABS} active={tab} onChange={setTab} />

        <div className="relative mt-4">
          <FakeLiveChart height={220} baseValue={Math.max(100, balance)} accent={ai.blue} />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {running ? (
              <Link
                to={`/ai-trading/trade/${running.id}`}
                className="pointer-events-auto rounded-full bg-oove-blue px-6 py-2.5 text-sm font-semibold text-white shadow-md"
              >
                View active trade
              </Link>
            ) : (
              <Link
                to="/ai-trading/markets"
                className="pointer-events-auto rounded-full bg-oove-blue px-8 py-3 text-sm font-semibold text-white shadow-md"
              >
                Start trading with Agent
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={clsx(
                  "text-xs font-medium",
                  range === r ? "text-slate-900" : "text-slate-500",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {!bal?.canTrade ? (
            <p className="text-xs text-amber-600">
              2 trades/week limit reached · resets in {weekCountdown(bal?.msUntilWeekReset ?? 0)}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              {bal?.tradesThisWeek ?? 0}/{bal?.maxTradesPerWeek ?? 2} AI trades this week
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFundOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-oove-blue/40"
      >
        <span className="font-medium text-slate-900">Buying power</span>
        <span className="flex items-center gap-1 font-medium text-slate-900 tabular-nums">
          Fund · ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </span>
      </button>

      <FundAiWalletModal
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        minAmount={bal?.minWalletDepositUsd ?? 100}
        onFunded={() => {
          void qc.invalidateQueries({ queryKey: ["ai-balance"] });
          void qc.invalidateQueries({ queryKey: ["portfolio"] });
          void qc.invalidateQueries({ queryKey: ["liquidity"] });
        }}
      />

      <div
        className="rounded-2xl border border-slate-200 p-5 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${ai.blue}12 0%, #ffffff 70%)` }}
      >
        <p className="text-sm font-semibold text-slate-900">Get started</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Deposit, pick crypto, stocks, options, or bonds. The agent trades while you relax and make profit.
        </p>
        <Link to="/ai-trading/markets" className="mt-3 inline-flex items-center text-sm font-semibold text-oove-blue">
          Browse markets <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-5 py-4 text-lg font-semibold text-slate-900">AI trade history</h2>
        <div className="divide-y divide-slate-100">
          {(historyQ.data ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No trades yet. Fund your wallet and start trading with Agent.
            </p>
          ) : (
            (historyQ.data ?? []).map((t) => (
              <Link
                key={t.id}
                to={t.status === "running" ? `/ai-trading/trade/${t.id}` : "#"}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{t.asset}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(t.start_time).toLocaleDateString()} · ${t.amount.toLocaleString()}
                  </p>
                </div>
                <span
                  className={clsx(
                    "text-sm font-semibold",
                    t.status === "running"
                      ? "text-amber-600"
                      : t.result_type === "profit"
                        ? "text-oove-green"
                        : t.result_type === "loss"
                          ? "text-red-600"
                          : "text-slate-500",
                  )}
                >
                  {formatTradeResult(t)}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <AiTradingDisclaimer />
    </AiTradingPageLayout>
  );
}
