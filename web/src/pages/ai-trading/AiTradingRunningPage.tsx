import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/state/AuthContext";
import { fetchAiHistory, formatTradeResult, type AiTrade } from "@/lib/aiTradingApi";
import { FakeLiveChart } from "@/components/ai-trading/FakeLiveChart";
import { AiTradingPageLayout } from "@/components/ai-trading/AiTradingPageLayout";
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
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!trade) {
    return (
      <section className="px-4 py-16 text-center">
        <p className="text-slate-500">Trade not found</p>
        <Link to="/ai-trading" className="mt-4 inline-block text-sm font-semibold text-oove-blue">
          Back to portfolio
        </Link>
      </section>
    );
  }

  const completed = trade.status === "completed";
  const chartColor =
    completed && trade.result_type === "loss" ? ai.red : trade.result_type === "profit" ? ai.green : ai.blue;

  return (
    <AiTradingPageLayout title={trade.asset} description={`$${trade.amount.toLocaleString()} · ${trade.asset_class}`}>
      <section className="max-w-3xl space-y-4">
        <header className="flex items-start justify-between gap-3">
          <p className="text-xs text-slate-500">
            Started {new Date(trade.start_time).toLocaleString()}
            {trade.end_time ? ` · Ended ${new Date(trade.end_time).toLocaleString()}` : null}
          </p>
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
        </header>

        <figure className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <FakeLiveChart height={240} baseValue={trade.amount} accent={chartColor} />
        </figure>

        {!completed ? (
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-2xl font-semibold text-slate-900">Trading</p>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-oove-blue" aria-hidden />
              Your agent is working. Results appear when the trade completes.
            </p>
          </article>
        ) : (
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-xl font-semibold text-slate-900">{formatTradeResult(trade)}</p>
            <p className="mt-1 text-xs text-slate-500">AI wallet updated</p>
          </article>
        )}

        <button
          type="button"
          onClick={() => void qc.invalidateQueries({ queryKey: ["ai-history"] })}
          className="w-full rounded-xl border border-slate-200 py-3 text-sm text-slate-600"
        >
          Refresh status
        </button>

        <Link to="/ai-trading" className="block text-center text-sm font-semibold text-oove-blue">
          Back to portfolio
        </Link>
      </section>
    </AiTradingPageLayout>
  );
}
