import clsx from "clsx";
import type { MarketRow } from "@/lib/aiMarketsData";
import { ai } from "@/lib/aiTradingTheme";

function fmtPrice(n: number) {
  if (n < 1) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  if (n < 1000) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function MarketTableHeader({
  cols,
}: {
  cols: [string, string, string];
}) {
  return (
    <div className="flex px-4 py-2 text-xs font-medium text-slate-500">
      <span className="flex-[1.4]">{cols[0]}</span>
      <span className="flex-1 text-right">{cols[1]}</span>
      <span className="w-20 text-right">{cols[2]}</span>
    </div>
  );
}

export function MarketTableRows({
  rows,
  onPick,
  thirdCol = "change",
}: {
  rows: MarketRow[];
  onPick: (r: MarketRow) => void;
  thirdCol?: "change" | "yield";
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
            {r.logo ? (
              <img src={r.logo} alt="" className="h-9 w-9 shrink-0 rounded-full" />
            ) : (
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: ai.blue }}
              >
                {r.symbol.slice(0, 2)}
              </span>
            )}
            <span className="min-w-0 flex-[1.4]">
              <span className="block truncate text-[15px] font-medium text-slate-900">{r.name}</span>
              <span className="text-sm text-slate-500">{r.symbol}</span>
            </span>
            <span className="flex-1 text-right text-[15px] text-slate-900">
              {thirdCol === "yield" && r.yieldPct != null
                ? `${r.yieldPct.toFixed(2)}%`
                : fmtPrice(r.price)}
            </span>
            <span className="w-20 text-right text-sm font-medium">
              {thirdCol === "yield" ? (
                <span style={{ color: ai.blue }}>{r.maturity ?? "—"}</span>
              ) : (
                <span className={clsx(r.change24h >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {r.change24h >= 0 ? "+" : ""}
                  {r.change24h.toFixed(2)}%
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MarketStockCards({
  rows,
  onPick,
}: {
  rows: MarketRow[];
  onPick: (r: MarketRow) => void;
}) {
  return (
    <ul className="mx-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200" style={{ backgroundColor: ai.card }}>
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${ai.blue}, #6366f1)` }}
            >
              {r.symbol.slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-slate-900">{r.name}</span>
              <span className="text-sm text-slate-500">{r.symbol}</span>
            </span>
            <span className="text-right">
              <span className="block text-[15px] text-slate-900">{fmtPrice(r.price)}</span>
              <span className={clsx("text-sm font-medium", r.change24h >= 0 ? "text-emerald-600" : "text-red-600")}>
                {r.change24h >= 0 ? "+" : ""}
                {r.change24h.toFixed(2)}%
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function FilterPills({
  pills,
  active,
  onChange,
}: {
  pills: readonly string[];
  active: string;
  onChange: (p: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
      {pills.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={clsx(
            "shrink-0 rounded-lg px-3 py-2 text-xs font-medium",
            active === p ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

