import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createChart, LineSeries, ColorType, type Time } from "lightweight-charts";
import { useAuth } from "@/state/AuthContext";
import { formatAssetQuantity, formatBtcEquivalent, formatPortfolioTotalUsd } from "@/lib/portfolioFormat";
import { MaskedValue, useBalanceVisibility } from "@/state/BalanceVisibilityContext";
import { BalanceVisibilityEyeToggle } from "@/components/BalanceVisibilityEyeToggle";

type Summary = { totalValueUsd: number; change24hPct: number; allocation: { symbol: string; valueUsd: number }[] };
type Holding = {
  symbol: string;
  quantity: string;
  avgCostUsd: string;
  currentPriceUsd: number;
  valueUsd: number;
  pnlPct: number;
};

type TopRow = { symbol: string; priceUsd: number };

async function fetchTopPrices(): Promise<TopRow[]> {
  const res = await fetch("/api/market/top-prices");
  const body = (await res.json().catch(() => ({}))) as { data?: TopRow[] };
  if (!res.ok) throw new Error("Could not load market prices");
  return body.data ?? [];
}

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

export function PortfolioPage() {
  const { token } = useAuth();
  const { showBalances } = useBalanceVisibility();
  const [range, setRange] = useState<"1d" | "1w" | "1m" | "1y" | "all">("1m");
  const chartRef = useRef<HTMLDivElement>(null);

  const topQ = useQuery({
    queryKey: ["market", "top-prices"],
    queryFn: fetchTopPrices,
    staleTime: 20_000,
    refetchInterval: 25_000,
  });

  const btcUsdSpot = useMemo(() => {
    const row = (topQ.data ?? []).find((t) => t.symbol === "BTC");
    const px = row?.priceUsd;
    return typeof px === "number" && Number.isFinite(px) && px > 0 ? px : 0;
  }, [topQ.data]);

  const summaryQ = useQuery({
    queryKey: ["portfolio", "summary", token],
    enabled: !!token,
    queryFn: () => fetchJson<{ data: Summary }>("/api/portfolio/summary", token!).then((r) => r.data),
  });

  const holdingsQ = useQuery({
    queryKey: ["portfolio", "holdings", token],
    enabled: !!token,
    queryFn: () => fetchJson<{ data: Holding[] }>("/api/portfolio/holdings", token!).then((r) => r.data),
  });

  const historyQ = useQuery({
    queryKey: ["portfolio", "history", token, range],
    enabled: !!token,
    queryFn: () =>
      fetchJson<{ data: { points: { time: string; value: number }[] } }>(
        `/api/portfolio/history?range=${encodeURIComponent(range)}`,
        token!,
      ).then((r) => r.data.points),
  });

  const chartData = useMemo(() => {
    const pts = historyQ.data ?? [];
    return pts.map((p) => ({
      time: p.time as Time,
      value: p.value,
    }));
  }, [historyQ.data]);

  useEffect(() => {
    if (!showBalances || !chartRef.current) return;
    const el = chartRef.current;
    const w = Math.max(el.clientWidth, 280);
    const h = 300;
    const chart = createChart(el, {
      width: w,
      height: h,
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#334155" },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.25)" },
        horzLines: { color: "rgba(148, 163, 184, 0.25)" },
      },
      localization: {
        priceFormatter: (price: number) => formatPortfolioTotalUsd(price),
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    const series = chart.addSeries(LineSeries, { color: "#1d4ed8", lineWidth: 2 });
    if (chartData.length > 1) {
      series.setData(chartData);
      chart.timeScale().fitContent();
    } else if (chartData.length === 1) {
      series.setData([chartData[0]!, { ...chartData[0]!, value: chartData[0]!.value * 1.0001 }]);
      chart.timeScale().fitContent();
    }

    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth;
      if (nw > 0) chart.resize(nw, h);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [chartData, showBalances]);

  const total = summaryQ.data?.totalValueUsd ?? 0;
  const chg = summaryQ.data?.change24hPct ?? 0;
  const alloc = summaryQ.data?.allocation ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Portfolio</p>
          <h1 className="text-3xl font-semibold text-slate-900">Holdings & performance</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Values use live CoinGecko prices when available, with static fallbacks. Daily snapshots power the chart after
            you load this page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/deposit"
            className="rounded-full bg-oove-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
          >
            Deposit
          </Link>
          <Link
            to="/transfers"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Transfers
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-start gap-2">
            <BalanceVisibilityEyeToggle className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total value</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
                <MaskedValue>{formatPortfolioTotalUsd(total)}</MaskedValue>
              </p>
              <p className="mt-1 text-lg font-medium tabular-nums text-slate-700">
                <MaskedValue>{formatBtcEquivalent(total, btcUsdSpot)}</MaskedValue>
                <span className="ml-1 text-xs font-normal font-sans text-slate-500">(BTC at live spot)</span>
              </p>
              <p className={`mt-2 text-sm font-medium ${chg >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(2)}% vs prior snapshot
              </p>
              {summaryQ.isError ? (
                <p className="mt-4 text-sm text-red-600">{(summaryQ.error as Error).message}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Allocation</p>
          <ul className="mt-3 space-y-2 text-sm">
            {alloc.length === 0 ? <li className="text-slate-500">No balances yet.</li> : null}
            {alloc.map((a) => (
              <li key={a.symbol} className="flex justify-between gap-2">
                <span className="font-medium text-slate-800">{a.symbol}</span>
                <span className="tabular-nums text-slate-600">
                  <MaskedValue>{formatPortfolioTotalUsd(a.valueUsd)}</MaskedValue>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Portfolio value</h2>
          <div className="flex flex-wrap gap-1">
            {(["1d", "1w", "1m", "1y", "all"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={
                  range === r
                    ? "rounded-full bg-oove-blue px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                }
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {showBalances ? (
          <div ref={chartRef} className="mt-4 h-[300px] w-full" />
        ) : (
          <div className="mt-4 flex h-[300px] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-600">
            Chart hidden while balances are concealed.
          </div>
        )}
        {historyQ.isError ? <p className="mt-2 text-sm text-red-600">{(historyQ.error as Error).message}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Holdings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Asset</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Avg cost</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Value</th>
                <th className="px-6 py-3">P&amp;L %</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdingsQ.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {(holdingsQ.data ?? []).map((h) => (
                <tr key={h.symbol} className="border-t border-slate-100">
                  <td className="px-6 py-3 font-semibold text-slate-900">{h.symbol}</td>
                  <td className="px-6 py-3 font-mono tabular-nums text-slate-800">
                    <MaskedValue>{formatAssetQuantity(h.symbol, h.quantity)}</MaskedValue>
                  </td>
                  <td className="px-6 py-3 tabular-nums">
                    <MaskedValue>{formatPortfolioTotalUsd(Number.parseFloat(h.avgCostUsd))}</MaskedValue>
                  </td>
                  <td className="px-6 py-3 tabular-nums">
                    <MaskedValue>{formatPortfolioTotalUsd(h.currentPriceUsd)}</MaskedValue>
                  </td>
                  <td className="px-6 py-3 tabular-nums">
                    <MaskedValue>{formatPortfolioTotalUsd(h.valueUsd)}</MaskedValue>
                  </td>
                  <td className={`px-6 py-3 font-medium ${h.pnlPct >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    <MaskedValue>{h.pnlPct.toFixed(2)}%</MaskedValue>
                  </td>
                  <td className="px-6 py-3">
                    <Link to="/transfers" className="text-oove-blue hover:underline">
                      Trade
                    </Link>
                  </td>
                </tr>
              ))}
              {!holdingsQ.isLoading && (holdingsQ.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-6 text-slate-500">
                    No holdings synced yet — fund your account via Supply.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
