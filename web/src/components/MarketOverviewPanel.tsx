import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AreaSeries, ColorType, createChart, type Time } from "lightweight-charts";
import { apiFetch } from "@/lib/apiBase";

export type AssetOverviewRange = "1d" | "7d" | "30d" | "90d" | "365d" | "max";

export type AssetOverviewDto = {
  symbol: string;
  name: string;
  priceUsd: number;
  percentChange24h: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  circulatingSupply: number | null;
  lastUpdated: string;
  statsSource: "coinmarketcap" | "coingecko";
  chartSource: "coingecko";
  history: { time: number; price: number }[];
};

export const MARKET_TAB_SYMBOLS = ["BTC", "ETH", "SOL", "USDT", "BNB", "XRP"] as const;

const RANGE_LABELS: { key: AssetOverviewRange; label: string }[] = [
  { key: "1d", label: "1D" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "1M" },
  { key: "90d", label: "3M" },
  { key: "365d", label: "1Y" },
  { key: "max", label: "ALL" },
];

async function fetchOverview(symbol: string, range: AssetOverviewRange): Promise<AssetOverviewDto> {
  const res = await apiFetch(
    `/api/market/asset-overview?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
  );
  const body = (await res.json().catch(() => ({}))) as { data?: AssetOverviewDto; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not load market data");
  if (!body.data) throw new Error("Invalid market response");
  return body.data;
}

function fmtUsdCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 8 })}`;
}

function fmtSupply(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

type Props = {
  /** Chart height in px */
  chartHeight?: number;
  /** Initial asset tab */
  initialSymbol?: (typeof MARKET_TAB_SYMBOLS)[number];
};

export function MarketOverviewPanel({ chartHeight = 280, initialSymbol = "BTC" }: Props) {
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [range, setRange] = useState<AssetOverviewRange>("30d");
  const chartRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["market", "asset-overview", symbol, range],
    queryFn: () => fetchOverview(symbol, range),
    staleTime: 35_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: true,
  });

  const chartData = useMemo(() => {
    const pts = q.data?.history ?? [];
    const sorted = [...pts].sort((a, b) => a.time - b.time);
    const out: { time: Time; value: number }[] = [];
    for (const p of sorted) {
      if (!(p.price > 0)) continue;
      const t = p.time as Time;
      const prev = out[out.length - 1];
      if (prev && prev.time === t) out[out.length - 1] = { time: t, value: p.price };
      else out.push({ time: t, value: p.price });
    }
    return out;
  }, [q.data?.history]);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    el.replaceChildren();

    if (chartData.length === 0) return;

    const w = Math.max(el.clientWidth, 280);
    const h = chartHeight;
    const chart = createChart(el, {
      width: w,
      height: h,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#475569",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.2)" },
        horzLines: { color: "rgba(148, 163, 184, 0.2)" },
      },
      localization: {
        priceFormatter: (price: number) => fmtPrice(price),
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#2A5BDB",
      topColor: "rgba(42, 91, 219, 0.28)",
      bottomColor: "rgba(42, 91, 219, 0.02)",
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });
    if (chartData.length > 1) {
      series.setData(chartData);
      chart.timeScale().fitContent();
    } else if (chartData.length === 1) {
      series.setData([chartData[0]!, { ...chartData[0]!, value: chartData[0]!.value * 1.00005 }]);
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
  }, [chartData, chartHeight]);

  const d = q.data;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Markets</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
            <strong className="font-semibold text-slate-700">Price, market cap, volume &amp; 24h change</strong> use{" "}
            <strong className="font-semibold text-slate-700">CoinMarketCap</strong> when your API has{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">COINMARKETCAP_API_KEY</code>
            ; otherwise CoinGecko. The <strong className="font-semibold text-slate-700">chart</strong> uses CoinGecko
            historical prices (updated automatically).
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {MARKET_TAB_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSymbol(s)}
              className={
                symbol === s
                  ? "rounded-full bg-oove-blue px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading market data…</p>
      ) : q.isError ? (
        <p className="mt-4 text-sm text-red-600">{(q.error as Error).message}</p>
      ) : d ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{d.name}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{fmtPrice(d.priceUsd)}</p>
              <p className={`mt-1 text-sm font-semibold tabular-nums ${(d.percentChange24h ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {d.percentChange24h == null
                  ? "24h —"
                  : `${(d.percentChange24h ?? 0) >= 0 ? "+" : ""}${d.percentChange24h?.toFixed(2)}%`}
                <span className="ml-2 font-normal text-slate-400">24h</span>
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs font-medium text-slate-500">Market cap</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{fmtUsdCompact(d.marketCapUsd)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs font-medium text-slate-500">Volume (24h)</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{fmtUsdCompact(d.volume24hUsd)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs font-medium text-slate-500">Circulating supply</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{fmtSupply(d.circulatingSupply)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-xs font-medium text-slate-500">Stats source</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {d.statsSource === "coinmarketcap" ? "CoinMarketCap" : "CoinGecko"}
              </dd>
            </div>
          </dl>

          <p className="mt-2 text-[11px] text-slate-400">
            Last updated: {new Date(d.lastUpdated).toLocaleString()} · Chart: {d.chartSource}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price history</span>
            <div className="flex flex-wrap gap-1">
              {RANGE_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  className={
                    range === key
                      ? "rounded-full bg-oove-blue px-2.5 py-1 text-[11px] font-semibold text-white"
                      : "rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div
            ref={chartRef}
            className="mt-3 w-full overflow-hidden rounded-xl border border-slate-100 bg-white"
            style={{ height: chartHeight }}
          />
          <p className="mt-2 text-[10px] text-slate-400">
            Charts use{" "}
            <a href="https://www.tradingview.com/lightweight-charts/" className="underline hover:text-slate-600">
              Lightweight Charts
            </a>{" "}
            © TradingView — attribution logo hidden per library options; numeric data from CoinGecko/CMC via Oove API.
          </p>
        </>
      ) : null}
    </div>
  );
}
