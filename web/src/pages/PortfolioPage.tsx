import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { formatAssetQuantity, formatUsdtEquivalent } from "@/lib/portfolioFormat";
import { MaskedValue } from "@/state/BalanceVisibilityContext";
import { BalanceVisibilityEyeToggle } from "@/components/BalanceVisibilityEyeToggle";
import { MarketOverviewPanel } from "@/components/MarketOverviewPanel";
import { apiFetch } from "@/lib/apiBase";
import { fetchFixedSavingsSummary } from "@/lib/fixedSavingsApi";
import { usePreferences } from "@/state/PreferencesContext";

type Summary = { totalValueUsd: number; change24hPct: number; allocation: { symbol: string; valueUsd: number }[] };
type Holding = {
  symbol: string;
  quantity: string;
  avgCostUsd: string;
  currentPriceUsd: number;
  valueUsd: number;
  pnlPct: number;
};

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const res = await apiFetch(path, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

export function PortfolioPage() {
  const { token } = useAuth();
  const { formatMoney, formatPortfolioTotal, formatPrice } = usePreferences();

  const summaryQ = useQuery({
    queryKey: ["portfolio", "summary", token],
    enabled: !!token,
    queryFn: () => fetchJson<{ data: Summary }>("/api/portfolio/summary", token!).then((r) => r.data),
  });

  const fixedQ = useQuery({
    queryKey: ["fixed-savings-summary", token],
    enabled: !!token,
    queryFn: () => fetchFixedSavingsSummary(token!),
  });

  const holdingsQ = useQuery({
    queryKey: ["portfolio", "holdings", token],
    enabled: !!token,
    queryFn: () => fetchJson<{ data: Holding[] }>("/api/portfolio/holdings", token!).then((r) => r.data),
  });

  const total = summaryQ.data?.totalValueUsd ?? 0;
  const fixedTotal = fixedQ.data?.activeTotalUsd ?? 0;
  const chg = summaryQ.data?.change24hPct ?? 0;
  const alloc = summaryQ.data?.allocation ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Portfolio</p>
          <h1 className="text-3xl font-semibold text-slate-900">Holdings & performance</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Your balance and allocation use live prices. Below, explore public market data (price, market cap, volume,
            history) with the same sources as major portfolio apps — CoinMarketCap for live stats when configured, CoinGecko
            for historical series.
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-2">
            <BalanceVisibilityEyeToggle className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total value</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
                <MaskedValue>{formatPortfolioTotal(total)}</MaskedValue>
              </p>
              <p className="mt-1 text-lg font-medium tabular-nums text-slate-700">
                <MaskedValue>{formatUsdtEquivalent(total)}</MaskedValue>
                <span className="ml-1 text-xs font-normal font-sans text-slate-500">(USDT equivalent)</span>
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
        <Link
          to="/fixed-plans"
          className="rounded-2xl border border-violet-200 bg-violet-50/40 p-6 shadow-sm transition hover:border-violet-300"
        >
          <div className="flex items-start gap-2">
            <BalanceVisibilityEyeToggle className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Fixed savings</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
                <MaskedValue>{formatMoney(fixedTotal)}</MaskedValue>
              </p>
              <p className="mt-2 text-sm font-medium text-violet-600">View plans →</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MarketOverviewPanel chartHeight={300} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Allocation</p>
          <ul className="mt-3 space-y-2 text-sm">
            {alloc.length === 0 ? <li className="text-slate-500">No balances yet.</li> : null}
            {alloc.map((a) => (
              <li key={a.symbol} className="flex justify-between gap-2">
                <span className="font-medium text-slate-800">{a.symbol}</span>
                <span className="tabular-nums text-slate-600">
                  <MaskedValue>{formatPortfolioTotal(a.valueUsd)}</MaskedValue>
                </span>
              </li>
            ))}
          </ul>
        </div>
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
                    <MaskedValue>{formatPrice(Number.parseFloat(h.avgCostUsd))}</MaskedValue>
                  </td>
                  <td className="px-6 py-3 tabular-nums">
                    <MaskedValue>{formatPrice(h.currentPriceUsd)}</MaskedValue>
                  </td>
                  <td className="px-6 py-3 tabular-nums">
                    <MaskedValue>{formatPortfolioTotal(h.valueUsd)}</MaskedValue>
                  </td>
                  <td className={`px-6 py-3 font-medium ${h.pnlPct >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    <MaskedValue>{h.pnlPct.toFixed(2)}%</MaskedValue>
                  </td>
                  <td className="px-6 py-3">
                    <Link to="/transfers" className="text-oove-blue hover:underline">
                      Manage
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
