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
    <div className="flex px-4 py-2 text-xs font-medium text-[#8E8E93]">
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
    <ul className="divide-y divide-white/[0.06]">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
            {r.logo ? (
              <img src={r.logo} alt="" className="h-9 w-9 shrink-0 rounded-full" />
            ) : (
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: ai.cardElevated }}
              >
                {r.symbol.slice(0, 2)}
              </span>
            )}
            <span className="min-w-0 flex-[1.4]">
              <span className="block truncate text-[15px] font-medium text-white">{r.name}</span>
              <span className="text-sm text-[#8E8E93]">{r.symbol}</span>
            </span>
            <span className="flex-1 text-right text-[15px] text-white">
              {thirdCol === "yield" && r.yieldPct != null
                ? `${r.yieldPct.toFixed(2)}%`
                : fmtPrice(r.price)}
            </span>
            <span className="w-20 text-right text-sm font-medium">
              {thirdCol === "yield" ? (
                <span style={{ color: ai.blue }}>{r.maturity ?? "—"}</span>
              ) : (
                <span className={clsx(r.change24h >= 0 ? "text-[#00D395]" : "text-[#FF453A]")}>
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
    <ul className="divide-y divide-white/[0.06] rounded-2xl mx-4 overflow-hidden" style={{ backgroundColor: ai.card }}>
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${ai.blue}, #6366f1)` }}
            >
              {r.symbol.slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-white">{r.name}</span>
              <span className="text-sm text-[#8E8E93]">{r.symbol}</span>
            </span>
            <span className="text-right">
              <span className="block text-[15px] text-white">{fmtPrice(r.price)}</span>
              <span className={clsx("text-sm font-medium", r.change24h >= 0 ? "text-[#00D395]" : "text-[#FF453A]")}>
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
            active === p ? "bg-[#2C2C2E] text-white" : "bg-[#1C1C1E] text-[#8E8E93]",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
