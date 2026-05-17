import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { intervalToDuration } from "date-fns";
import { useAuth } from "@/state/AuthContext";
import {
  depositToAiWallet,
  fetchAiBalance,
  fetchAiHistory,
  formatTradeResult,
  startAiTrade,
} from "@/lib/aiTradingApi";
import { AiTradingDisclaimer } from "@/components/ai-trading/AiTradingDisclaimer";
import { FakeLiveChart } from "@/components/ai-trading/FakeLiveChart";
import { StartTradeModal } from "@/components/ai-trading/StartTradeModal";

const TABS = ["Return", "Income", "Account value", "Allocation"] as const;

function weekCountdown(ms: number): string {
  if (ms <= 0) return "Resets soon";
  const d = intervalToDuration({ start: 0, end: ms });
  const parts: string[] = [];
  if (d.days) parts.push(`${d.days}d`);
  if (d.hours) parts.push(`${d.hours}h`);
  if (!d.days && d.minutes) parts.push(`${d.minutes}m`);
  return parts.join(" ") || "<1m";
}

export function AiTradingPortfolioPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Return");
  const [tradeOpen, setTradeOpen] = useState(false);
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

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" className="rounded-xl bg-[#1A1A1A] px-3 py-1.5 text-xs font-semibold text-white">
          Brokerage
        </button>
        <button type="button" className="rounded-xl p-2 text-[#9CA3AF] hover:bg-[#1A1A1A]" aria-label="Calendar">
          <Calendar className="h-5 w-5" />
        </button>
      </div>

      <AiTradingDisclaimer />

      <p className="mt-6 text-center text-4xl font-semibold tracking-tight">
        ${(bal?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="mt-1 text-center text-sm text-[#9CA3AF]">AI trading balance</p>

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

      <div className="relative mt-4 rounded-xl bg-[#1A1A1A] p-3">
        <FakeLiveChart height={180} baseValue={Math.max(100, bal?.balance ?? 1000)} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {running ? (
            <Link
              to={`/ai-trading/trade/${running.id}`}
              className="pointer-events-auto rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              View active trade
            </Link>
          ) : (
            <button
              type="button"
              disabled={!bal?.canTrade || (bal?.balance ?? 0) < (bal?.minTradeUsd ?? 100)}
              onClick={() => setTradeOpen(true)}
              className="pointer-events-auto rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              Start investing
            </button>
          )}
        </div>
      </div>

      {!bal?.canTrade ? (
        <p className="mt-3 text-center text-xs text-amber-400">
          Weekly limit reached (2 trades). Resets in {weekCountdown(bal?.msUntilWeekReset ?? 0)}.
        </p>
      ) : (
        <p className="mt-3 text-center text-xs text-[#9CA3AF]">
          {bal?.tradesThisWeek ?? 0}/{bal?.maxTradesPerWeek ?? 2} trades used this week
        </p>
      )}

      <div className="mt-4 rounded-xl bg-[#1A1A1A] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#9CA3AF]">Buying power</p>
            <p className="mt-1 text-xl font-semibold">
              ${(bal?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeposit((s) => !s)}
            className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black"
          >
            Fund wallet
          </button>
        </div>
        {showDeposit ? (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              min={bal?.minTradeUsd ?? 100}
              value={depositAmt}
              onChange={(e) => setDepositAmt(e.target.value)}
              placeholder={`Min $${bal?.minTradeUsd ?? 100}`}
              className="flex-1 rounded-xl border border-white/10 bg-[#0D0D0D] px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              disabled={depositMut.isPending}
              onClick={() => {
                const n = Number.parseFloat(depositAmt);
                if (Number.isFinite(n)) depositMut.mutate(n);
              }}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {depositMut.isPending ? "…" : "Deposit"}
            </button>
          </div>
        ) : null}
        {depositMut.isError ? (
          <p className="mt-2 text-xs text-red-400">{(depositMut.error as Error).message}</p>
        ) : null}
        <p className="mt-2 text-[10px] text-[#9CA3AF]">Transfers from your CashBox balance</p>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">History</h2>
          <Link to="/history" className="flex items-center text-xs text-[#9CA3AF] hover:text-white">
            Full history <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="space-y-2">
          {(historyQ.data ?? []).length === 0 ? (
            <p className="rounded-xl bg-[#1A1A1A] px-4 py-6 text-center text-xs text-[#9CA3AF]">No trades yet</p>
          ) : (
            (historyQ.data ?? []).map((t) => (
              <Link
                key={t.id}
                to={t.status === "running" ? `/ai-trading/trade/${t.id}` : "#"}
                className="flex items-center justify-between rounded-xl bg-[#1A1A1A] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{t.asset}</p>
                  <p className="text-xs text-[#9CA3AF]">
                    {new Date(t.start_time).toLocaleDateString()} · ${t.amount.toLocaleString()}
                  </p>
                </div>
                <span
                  className={clsx(
                    "text-xs font-semibold",
                    t.status === "running"
                      ? "text-amber-400"
                      : t.result_type === "profit"
                        ? "text-emerald-400"
                        : t.result_type === "loss"
                          ? "text-red-400"
                          : "text-[#9CA3AF]",
                  )}
                >
                  {formatTradeResult(t)}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      <StartTradeModal
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        balance={bal?.balance ?? 0}
        minAmount={bal?.minTradeUsd ?? 100}
        canTrade={!!bal?.canTrade}
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
