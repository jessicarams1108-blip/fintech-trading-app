import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import type { AssetSymbol } from "@/types";
import { uploadDepositProofIfConfigured } from "@/lib/depositProofUpload";
import { formatAssetQuantity, formatBtcEquivalent, formatPortfolioTotalUsd } from "@/lib/portfolioFormat";
import { MaskedValue } from "@/state/BalanceVisibilityContext";
import { BalanceVisibilityEyeToggle } from "@/components/BalanceVisibilityEyeToggle";
import { MarketOverviewPanel } from "@/components/MarketOverviewPanel";
import { DepositUsdAmountPicker } from "@/components/DepositUsdAmountPicker";
import { apiFetch } from "@/lib/apiBase";

const MIN_DEPOSIT_USD = 100;
const DASHBOARD_ASSETS: AssetSymbol[] = ["BTC", "ETH", "USDT"];

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

async function authFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers as object) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

async function fetchTopPrices(): Promise<TopRow[]> {
  const res = await apiFetch("/api/market/top-prices");
  const body = (await res.json().catch(() => ({}))) as { data?: TopRow[] };
  if (!res.ok) throw new Error("Could not load market prices");
  return body.data ?? [];
}

function fmtUsdSpot(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: n > 0 && n < 1 ? 6 : 2,
  });
}

type HomeQuickDepositProps = {
  token: string | null;
  onSubmitted: () => void;
};

export function HomeQuickDeposit({ token, onSubmitted }: HomeQuickDepositProps) {
  const { showToast } = useToast();
  const [asset, setAsset] = useState<AssetSymbol>("BTC");
  const [declaredUsd, setDeclaredUsd] = useState("100");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [awaitingId, setAwaitingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const priceQ = useQuery({
    queryKey: ["market", "price", asset],
    queryFn: async () => {
      const res = await apiFetch(`/api/market/price?symbol=${encodeURIComponent(asset)}`);
      const body = (await res.json().catch(() => ({}))) as { data?: { priceUsd?: number }; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Price unavailable");
      const px = body.data?.priceUsd;
      if (typeof px !== "number" || !Number.isFinite(px) || px <= 0) throw new Error("Price unavailable");
      return px;
    },
    staleTime: 20_000,
    refetchInterval: 35_000,
  });

  useEffect(() => {
    if (!awaitingId) {
      setProgress(0);
      return;
    }
    const started = Date.now();
    const capMs = 10 * 60_000;
    const t = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const p = Math.min(92, (elapsed / capMs) * 92 + Math.sin(elapsed / 4000) * 3);
      setProgress(p);
    }, 400);
    return () => window.clearInterval(t);
  }, [awaitingId]);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Sign in required");
      const declared = Number.parseFloat(declaredUsd);
      if (!Number.isFinite(declared) || declared < MIN_DEPOSIT_USD) {
        throw new Error(`Declare at least $${MIN_DEPOSIT_USD} USD equivalent.`);
      }
      let depositProofKey: string | undefined;
      let screenshotFileName: string | undefined;
      if (proofFile) {
        const uploadedKey = await uploadDepositProofIfConfigured(token, proofFile);
        if (uploadedKey) depositProofKey = uploadedKey;
        else screenshotFileName = proofFile.name;
      }

      const res = await apiFetch("/api/deposit/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset,
          declaredAmountUsd: declared,
          ...(depositProofKey ? { depositProofKey } : screenshotFileName ? { screenshotFileName } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Submit failed");
      return body.data?.id ?? "";
    },
    onSuccess: (id) => {
      showToast("Proof submitted — waiting for operator confirmation.");
      setAwaitingId(id || "pending");
      setProofFile(null);
      onSubmitted();
    },
    onError: (e: Error) => {
      setError(e.message);
      showToast(e.message);
    },
  });

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    submitMut.mutate();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Deposit</h3>
      <p className="mt-1 text-sm text-slate-600">
        Choose asset and declared USD, attach a proof file if you have one, then submit after you have sent funds.
        Confirmation usually arrives within a few minutes.
      </p>

      {awaitingId ? (
        <div className="mt-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50/90 p-4">
          <p className="text-sm font-semibold text-amber-950">Waiting for confirmation</p>
          <p className="text-sm text-amber-900">
            Typical review time: <strong>2–10 minutes</strong>. You can leave this page — progress also appears in{" "}
            <strong>Recent deposit activity</strong> below.
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-amber-200/80">
            <div
              className="h-full rounded-full bg-oove-blue transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-oove-blue hover:underline"
            onClick={() => setAwaitingId(null)}
          >
            Dismiss banner (deposit still in queue)
          </button>
        </div>
      ) : null}

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <div>
          <label className="text-xs font-medium uppercase text-slate-500">Asset</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={asset}
            onChange={(e) => setAsset(e.target.value as AssetSymbol)}
          >
            {DASHBOARD_ASSETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <DepositUsdAmountPicker
          minUsd={MIN_DEPOSIT_USD}
          value={declaredUsd}
          onChange={setDeclaredUsd}
          assetSymbol={asset}
          spotUsdPerUnit={priceQ.data ?? null}
          spotError={priceQ.isError}
        />
        <div>
          <label className="text-xs font-medium uppercase text-slate-500">Proof file</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
          />
          {proofFile ? <p className="mt-1 text-xs text-slate-500">Selected: {proofFile.name}</p> : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={!token || submitMut.isPending}
          className="w-full rounded-xl bg-oove-blue py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
        >
          {submitMut.isPending ? "Submitting…" : "I have sent the money — submit proof"}
        </button>
        <p className="text-xs text-slate-500">
          Full step-by-step flow:{" "}
          <Link to="/deposit" className="font-semibold text-oove-blue underline">
            Supply
          </Link>{" "}
          page.
        </p>
      </form>
    </div>
  );
}

export function DashboardPortfolioBlock({ onDepositFlowChanged }: { onDepositFlowChanged?: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();

  const summaryQ = useQuery({
    queryKey: ["portfolio", "summary", token],
    enabled: !!token,
    queryFn: () => authFetch<{ data: Summary }>("/api/portfolio/summary", token!).then((r) => r.data),
    refetchInterval: 25_000,
    refetchIntervalInBackground: true,
  });

  const holdingsQ = useQuery({
    queryKey: ["portfolio", "holdings", token],
    enabled: !!token,
    queryFn: () => authFetch<{ data: Holding[] }>("/api/portfolio/holdings", token!).then((r) => r.data),
    refetchInterval: 25_000,
    refetchIntervalInBackground: true,
  });

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

  const total = summaryQ.data?.totalValueUsd ?? 0;
  const chg = summaryQ.data?.change24hPct ?? 0;
  const alloc = summaryQ.data?.allocation ?? [];
  const holdingsSortedByValue = useMemo(() => {
    const rows = [...(holdingsQ.data ?? [])];
    rows.sort((a, b) => b.valueUsd - a.valueUsd);
    return rows;
  }, [holdingsQ.data]);

  const allocationDisplay = useMemo(() => {
    const holdings = [...(holdingsQ.data ?? [])].filter((h) => h.valueUsd > 0);
    const denom = total > 1e-9 ? total : holdings.reduce((s, h) => s + h.valueUsd, 0);
    if (holdings.length > 0) {
      holdings.sort((a, b) => b.valueUsd - a.valueUsd);
      return holdings.map((h) => ({
        symbol: h.symbol,
        quantity: h.quantity,
        spotUsd: h.currentPriceUsd,
        valueUsd: h.valueUsd,
        pct: denom > 0 ? (h.valueUsd / denom) * 100 : 0,
      }));
    }
    return alloc
      .filter((x) => x.valueUsd > 0)
      .map((x) => ({
        symbol: x.symbol,
        quantity: null as string | null,
        spotUsd: null as number | null,
        valueUsd: x.valueUsd,
        pct: denom > 0 ? (x.valueUsd / denom) * 100 : 0,
      }));
  }, [holdingsQ.data, alloc, total]);

  const handleDepositSubmitted = () => {
    void qc.invalidateQueries({ queryKey: ["portfolio"] });
    onDepositFlowChanged?.();
  };

  if (!token) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Sign in to see your portfolio, chart, and deposit form on the home page.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Portfolio</p>
          <h2 className="text-2xl font-semibold text-slate-900">Holdings & performance</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Your totals use live spot prices. Below, browse market-wide price, capitalization, volume, and history like
            CoinMarketCap — refreshed automatically.
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
            Receive
          </Link>
          <Link to="/portfolio" className="rounded-full px-4 py-2 text-sm font-semibold text-oove-blue hover:underline">
            Full portfolio
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Fiat total in USD, plus the same portfolio expressed in whole bitcoin using the current BTC/USD price
                  from the market feed.
                </p>
                <p className={`mt-2 text-sm font-medium ${chg >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {chg >= 0 ? "+" : ""}
                  {chg.toFixed(2)}% vs prior snapshot
                </p>
                {summaryQ.isError ? (
                  <p className="mt-2 text-sm text-red-600">{(summaryQ.error as Error).message}</p>
                ) : null}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Allocation (USD at live spot)</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Each asset: balance × real-time USD price = value in dollars, and % of your total portfolio.
                </p>
                <ul className="mt-3 max-h-52 divide-y divide-slate-100 overflow-y-auto text-sm">
                  {allocationDisplay.length === 0 ? <li className="py-3 text-slate-500">No balances yet.</li> : null}
                  {allocationDisplay.map((row) => (
                    <li key={row.symbol} className="py-2.5">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-slate-900">{row.symbol}</span>
                        <span className="tabular-nums font-medium text-slate-800">
                          <MaskedValue>{formatPortfolioTotalUsd(row.valueUsd)}</MaskedValue>
                        </span>
                      </div>
                      {row.quantity != null && row.spotUsd != null ? (
                        <p className="mt-1 text-xs text-slate-600">
                          <span className="font-mono tabular-nums">
                            <MaskedValue>{formatAssetQuantity(row.symbol, row.quantity)}</MaskedValue>
                          </span>{" "}
                          ×{" "}
                          <MaskedValue>{fmtUsdSpot(row.spotUsd)}</MaskedValue>
                          <span className="text-slate-400"> / unit (live)</span>
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-slate-500">
                        <MaskedValue>{row.pct.toFixed(1)}%</MaskedValue> of portfolio
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-inner">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Market assets (USD)</p>
              {topQ.isError ? (
                <p className="mt-2 text-sm text-red-600">{(topQ.error as Error).message}</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {(topQ.data ?? []).map((t) => (
                    <li
                      key={t.symbol}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm"
                    >
                      <span className="font-semibold">{t.symbol}</span>{" "}
                      <span className="tabular-nums text-slate-600">
                        {t.priceUsd < 1
                          ? `$${t.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
                          : `$${t.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <MarketOverviewPanel chartHeight={260} />

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-3">
              <h3 className="text-lg font-semibold text-slate-900">Holdings (value)</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2">Asset</th>
                    <th className="px-5 py-2">Amount</th>
                    <th className="px-5 py-2">Avg cost</th>
                    <th className="px-5 py-2">Price</th>
                    <th className="px-5 py-2">Value</th>
                    <th className="px-5 py-2">P&amp;L %</th>
                    <th className="px-5 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsQ.isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  ) : null}
                  {holdingsSortedByValue.map((h) => (
                    <tr key={h.symbol} className="border-t border-slate-100">
                      <td className="px-5 py-2 font-semibold text-slate-900">{h.symbol}</td>
                      <td className="px-5 py-2 font-mono tabular-nums text-slate-800">
                        <MaskedValue>{formatAssetQuantity(h.symbol, h.quantity)}</MaskedValue>
                      </td>
                      <td className="px-5 py-2 tabular-nums">
                        <MaskedValue>${Number.parseFloat(h.avgCostUsd).toFixed(4)}</MaskedValue>
                      </td>
                      <td className="px-5 py-2 tabular-nums">
                        <MaskedValue>${h.currentPriceUsd.toLocaleString()}</MaskedValue>
                      </td>
                      <td className="px-5 py-2 tabular-nums">
                        <MaskedValue>{formatPortfolioTotalUsd(h.valueUsd)}</MaskedValue>
                      </td>
                      <td className={`px-5 py-2 font-medium ${h.pnlPct >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        <MaskedValue>{h.pnlPct.toFixed(2)}%</MaskedValue>
                      </td>
                      <td className="px-5 py-2">
                        <Link to="/transfers" className="text-oove-blue hover:underline">
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!holdingsQ.isLoading && holdingsSortedByValue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-slate-500">
                        No holdings yet — submit a deposit below or use Supply.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <HomeQuickDeposit token={token} onSubmitted={handleDepositSubmitted} />
        </div>
      </div>
    </section>
  );
}
