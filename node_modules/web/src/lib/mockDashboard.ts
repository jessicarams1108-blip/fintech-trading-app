import type { ActivityRow, HoldingRow, WatchRow } from "@/types";

export const MOCK_HOLDINGS: HoldingRow[] = [
  {
    asset: "AAPL",
    shares: 12,
    avgCost: 178.2,
    currentPrice: 191.45,
    dayChangePct: 0.42,
  },
  {
    asset: "BTC",
    shares: 0.42,
    avgCost: 61200,
    currentPrice: 68420,
    dayChangePct: -1.12,
  },
  {
    asset: "ETH",
    shares: 4.8,
    avgCost: 3150,
    currentPrice: 3420,
    dayChangePct: 0.88,
  },
];

export const MOCK_ACTIVITIES: ActivityRow[] = [
  {
    id: "1",
    label: "Deposit BTC",
    amount: "+0.05 BTC",
    status: "Pending",
    at: "2m ago",
  },
  {
    id: "2",
    label: "Buy ETH",
    amount: "+1 ETH",
    status: "Confirmed",
    at: "1h ago",
  },
  {
    id: "3",
    label: "Send USDT",
    amount: "-200 USDT",
    status: "Failed",
    at: "Yesterday",
  },
];

export const MOCK_WATCHLIST: WatchRow[] = [
  { symbol: "NVDA", price: 942.15, changePct: 1.24 },
  { symbol: "MSFT", price: 412.05, changePct: -0.35 },
  { symbol: "SOL", price: 168.4, changePct: 2.91 },
];

export function portfolioTotals(holdings: HoldingRow[]) {
  let value = 0;
  let cost = 0;
  for (const h of holdings) {
    value += h.shares * h.currentPrice;
    cost += h.shares * h.avgCost;
  }
  const pnl = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
  return { value, cost, pnl, pnlPct };
}
