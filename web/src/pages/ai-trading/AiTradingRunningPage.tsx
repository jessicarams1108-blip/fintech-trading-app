import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/state/AuthContext";
import { fetchAiHistory, formatTradeResult, type AiTrade } from "@/lib/aiTradingApi";
import { FakeLiveChart } from "@/components/ai-trading/FakeLiveChart";
import { AiTradingTopBar } from "@/components/ai-trading/AiTradingTopBar";
import { ai } from "@/lib/aiTradingTheme";

export function AiTradingRunningPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const qc = useQueryClient();

  const historyQ = useQuery({
    queryKey: ["ai-history", token],
    enabled: !!token,
    queryFn: () => fetchAiHistory(token!),
    refetchInterval: 10_000,
  });

  const trade: AiTrade | undefined = historyQ.data?.find((t) => t.id === id);

  if (historyQ.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#8E8E93]" />
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-[#8E8E93]">Trade not found</p>
        <Link to="/ai-trading" className="mt-4 inline-block text-sm font-semibold text-oove-blue">
          Back to portfolio
        </Link>
      </div>
    );
  }

  const completed = trade.status === "completed";
  const chartColor = completed && trade.result_type === "loss" ? ai.red : trade.result_type === "profit" ? ai.green : ai.blue;

  return (
    <div className="pb-8">
      <AiTradingTopBar />
      <div className="px-4 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{trade.asset}</h1>
            <p className="mt-1 text-[#8E8E93]">
              ${trade.amount.toLocaleString()} · {trade.asset_class}
            </p>
          </div>
          <span
            className={clsx(
              "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
              completed
                ? trade.result_type === "profit"
                  ? "bg-oove-green/20 text-oove-green"
                  : "bg-red-500/20 text-[#FF453A]"
                : "bg-amber-500/20 text-amber-400",
            )}
          >
            {completed ? formatTradeResult(trade) : "Trading"}
          </span>
        </div>

        <p className="mt-3 text-xs text-[#8E8E93]">
          Started {new Date(trade.start_time).toLocaleString()}
          {trade.end_time ? ` · Ended ${new Date(trade.end_time).toLocaleString()}` : null}
        </p>

        <div className="mt-4 rounded-2xl bg-[#1C1C1E] p-2">
          <FakeLiveChart height={240} baseValue={trade.amount} accent={chartColor} />
        </div>

        {!completed ? (
          <div className="mt-6 rounded-2xl bg-[#1C1C1E] p-6 text-center">
            <p className="text-2xl font-semibold text-white">Trading</p>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[#8E8E93]">
              <Loader2 className="h-4 w-4 animate-spin text-oove-blue" />
              Your agent is working — results appear when the trade completes.
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-[#1C1C1E] p-5 text-center">
            <p className="text-xl font-semibold">{formatTradeResult(trade)}</p>
            <p className="mt-1 text-xs text-[#8E8E93]">AI wallet updated</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void qc.invalidateQueries({ queryKey: ["ai-history"] })}
          className="mt-4 w-full rounded-xl border border-white/10 py-3 text-sm text-[#8E8E93]"
        >
          Refresh status
        </button>

        <Link to="/ai-trading" className="mt-4 block text-center text-sm font-semibold text-oove-blue">
          Back to portfolio
        </Link>
      </div>
    </div>
  );
}
