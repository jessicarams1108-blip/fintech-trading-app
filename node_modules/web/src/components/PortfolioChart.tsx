import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type UTCTimestamp,
} from "lightweight-charts";

type Candle = { time: UTCTimestamp; open: number; high: number; low: number; close: number };

function buildMockSeries(): Candle[] {
  let price = 100;
  const out: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 90; i >= 0; i--) {
    const time = (now - i * 86400) as UTCTimestamp;
    const drift = (Math.random() - 0.48) * 2;
    const open = price;
    price = Math.max(20, price + drift);
    const high = Math.max(open, price) + Math.random();
    const low = Math.min(open, price) - Math.random();
    const close = price;
    out.push({ time, open, high, low, close });
  }
  return out;
}

function buildFlatSeries(): Candle[] {
  const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
  return [{ time: now, open: 100, high: 100, low: 100, close: 100 }];
}

/** Large interactive candlestick chart with mocked OHLC — swap series data for API-fed bars. */
export function PortfolioChart({ empty = false }: { empty?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;
    const initialW = Math.max(el.clientWidth || el.getBoundingClientRect().width, 200);
    const initialH = Math.max(el.clientHeight || 320, 200);

    const chart = createChart(el, {
      width: initialW,
      height: initialH,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: empty ? "#64748b" : "#cbd5f5",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.2)" },
        horzLines: { color: "rgba(148, 163, 184, 0.2)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    series.setData(empty ? buildFlatSeries() : buildMockSeries());

    chart.timeScale().fitContent();

    const resize = () => {
      const node = ref.current;
      if (!node) return;
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w > 0 && h > 0) {
        chart.resize(w, h);
      }
    };
    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [empty]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-700">Portfolio chart</div>
        <div className="flex flex-wrap gap-1">
          {["1D", "1W", "1M", "1Y", "All"].map((tf) => (
            <button key={tf} type="button" className={clsButton(tf === "1M")}>
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={ref}
        className={
          empty
            ? "h-[320px] w-full rounded-2xl border border-slate-200 bg-slate-50"
            : "h-[320px] w-full rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900"
        }
      />
      <p className="text-xs text-slate-500">
        {empty
          ? "Performance will appear here after you have positions or cash earning yield."
          : "Candlesticks + volume/indi­cators plug in via additional series once market data arrives."}
      </p>
    </div>
  );
}

function clsButton(active: boolean) {
  return [
    "rounded-full px-3 py-1 text-xs font-semibold transition",
    active
      ? "bg-accent text-white shadow-sm"
      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
  ].join(" ");
}
