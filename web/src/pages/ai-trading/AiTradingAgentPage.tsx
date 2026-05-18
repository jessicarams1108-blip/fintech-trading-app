import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useAuth } from "@/state/AuthContext";
import { fetchAiBalance, fetchAiHistory, startAiTrade } from "@/lib/aiTradingApi";
import { AiTradingPageLayout } from "@/components/ai-trading/AiTradingPageLayout";
import { AiTradingDisclaimer } from "@/components/ai-trading/AiTradingDisclaimer";

const ASSET_CLASSES = [
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "stocks", label: "Stocks" },
] as const;

const QUICK_PICKS = ["BTC", "ETH", "SOL", "AAPL", "TSLA", "EUR/USD"];

export function AiTradingAgentPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [assetClass, setAssetClass] = useState<string>("crypto");
  const [asset, setAsset] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balanceQ = useQuery({
    queryKey: ["ai-balance", token],
    enabled: !!token,
    queryFn: () => fetchAiBalance(token!),
  });

  const historyQ = useQuery({
    queryKey: ["ai-history", token],
    enabled: !!token,
    queryFn: () => fetchAiHistory(token!),
  });

  const running = (historyQ.data ?? []).find((t) => t.status === "running");
  const bal = balanceQ.data;
  const balance = bal?.balance ?? 0;
  const minAmount = bal?.minTradeUsd ?? 1000;
  const maxAmount = bal?.maxTradeUsd ?? 1_000_000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (running) {
      navigate(`/ai-trading/trade/${running.id}`);
      return;
    }
    const num = Number.parseFloat(amount);
    if (!Number.isFinite(num) || num < minAmount) {
      setError(`Minimum trade is $${minAmount.toLocaleString()}`);
      return;
    }
    if (num > maxAmount) {
      setError(`Maximum trade is $${maxAmount.toLocaleString()}`);
      return;
    }
    if (num > balance) {
      setError("Amount exceeds AI trading balance");
      return;
    }
    if (!bal?.canTrade) {
      setError("Weekly trade limit reached");
      return;
    }
    setLoading(true);
    try {
      const trade = await startAiTrade(token!, {
        asset: asset.trim().toUpperCase(),
        amount: num,
        asset_class: assetClass,
      });
      void qc.invalidateQueries({ queryKey: ["ai-balance"] });
      void qc.invalidateQueries({ queryKey: ["ai-history"] });
      navigate(`/ai-trading/trade/${trade.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start trade");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AiTradingPageLayout title="Agents" description="Pick a market and amount. Your agent trades while you wait for the result.">
      <div className="max-w-xl space-y-4">
        <p className="text-sm text-slate-600">
          Buying power: ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </p>

        {running ? (
          <button
            type="button"
            onClick={() => navigate(`/ai-trading/trade/${running.id}`)}
            className="mt-4 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 text-sm font-semibold text-amber-400"
          >
            View active trade ({running.asset})
          </button>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500">Market type</label>
            <div className="flex gap-2">
              {ASSET_CLASSES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAssetClass(c.id)}
                  className={clsx(
                    "flex-1 rounded-xl py-2.5 text-sm font-semibold",
                    assetClass === c.id ? "bg-oove-blue text-white" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500">Symbol</label>
            <input
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-oove-blue"
              placeholder="e.g. BTC, AAPL"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_PICKS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setAsset(sym)}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-900"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-500">
              Amount (${minAmount.toLocaleString()} – ${maxAmount.toLocaleString()} USD)
            </label>
            <input
              type="number"
              min={minAmount}
              max={Math.min(balance, maxAmount)}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-oove-blue"
              placeholder={`$${minAmount.toLocaleString()} – $${maxAmount.toLocaleString()}`}
            />
          </div>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-oove-blue py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {loading ? "Starting…" : running ? "View trading" : "Start trading with Agent"}
          </button>
        </form>

        <Link
          to="/ai-trading/markets"
          className="mt-4 block text-center text-sm font-medium text-oove-blue"
        >
          Browse all markets
        </Link>

        <div className="mt-8">
          <AiTradingDisclaimer />
        </div>
      </div>
    </AiTradingPageLayout>
  );
}

