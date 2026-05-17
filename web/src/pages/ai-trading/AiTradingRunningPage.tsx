import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/state/AuthContext";
import { fetchAiHistory, formatTradeResult, type AiTrade } from "@/lib/aiTradingApi";
import { FakeLiveChart } from "@/components/ai-trading/FakeLiveChart";
import { AiTradingDisclaimer } from "@/components/ai-trading/AiTradingDisclaimer";

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
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#9CA3AF]" />
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[#9CA3AF]">Trade not found</p>
        <Link to="/ai-trading" className="mt-4 inline-block text-sm font-semibold text-white underline">
          Back to portfolio
        </Link>
      </div>
    );
  }

  const completed = trade.status === "completed";

  return (
    <div className="px-4 pt-4">
      <AiTradingDisclaimer compact />

      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{trade.asset}</h1>
          <p className="text-sm text-[#9CA3AF]">${trade.amount.toLocaleString()} · {trade.asset_class}</p>
        </div>
        <span
          className={
            completed
              ? trade.result_type === "profit"
                ? "rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400"
                : "rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400"
              : "rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400"
          }
        >
          {completed ? formatTradeResult(trade) : "In Progress"}
        </span>
      </div>

      <p className="mt-2 text-xs text-[#9CA3AF]">
        Started {new Date(trade.start_time).toLocaleString()}
        {trade.end_time ? ` · Ended ${new Date(trade.end_time).toLocaleString()}` : null}
      </p>

      <div className="mt-4 rounded-xl bg-[#1A1A1A] p-3">
        <FakeLiveChart height={220} baseValue={trade.amount} accent={completed && trade.result_type === "loss" ? "#ef4444" : "#22c55e"} />
      </div>

      {!completed ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#9CA3AF]">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI is trading — results appear when operations completes your session
        </div>
      ) : (
        <div className="mt-6 rounded-xl bg-[#1A1A1A] p-4 text-center">
          <p className="text-lg font-semibold">{formatTradeResult(trade)}</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">Balance updated by admin settlement</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void qc.invalidateQueries({ queryKey: ["ai-history"] })}
        className="mt-4 w-full rounded-xl border border-white/10 py-2 text-xs text-[#9CA3AF]"
      >
        Refresh status
      </button>

      <Link to="/ai-trading" className="mt-4 block text-center text-sm font-semibold text-white underline">
        Back to portfolio
      </Link>
    </div>
  );
}
