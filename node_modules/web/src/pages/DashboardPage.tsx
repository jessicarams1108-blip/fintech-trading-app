import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import type { LiquiditySummary } from "@/lib/liquidityTypes";
import type { DepositActivityDto } from "@/types";
import { useToast } from "@/state/ToastContext";
import { DepositActivityPanel } from "@/components/DepositActivity";
import { DashboardPortfolioBlock } from "@/components/DashboardPortfolioBlock";

const MARKETS = [
  { asset: "USDC", supplyApy: "4.12%", borrowApr: "5.8%", desc: "Stablecoin liquidity" },
  { asset: "USDT", supplyApy: "4.05%", borrowApr: "5.7%", desc: "Stablecoin liquidity" },
  { asset: "ETH", supplyApy: "2.31%", borrowApr: "3.1%", desc: "Blue-chip collateral" },
  { asset: "BTC", supplyApy: "1.85%", borrowApr: "2.9%", desc: "Blue-chip collateral" },
];

export function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { token } = useAuth();
  const [summary, setSummary] = useState<LiquiditySummary | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [depositRows, setDepositRows] = useState<DepositActivityDto[]>([]);
  const [depositActivityReload, setDepositActivityReload] = useState(0);
  const onDepositRows = useCallback((rows: DepositActivityDto[]) => {
    setDepositRows(rows);
  }, []);

  useEffect(() => {
    const bump = () => setDepositActivityReload((n) => n + 1);
    window.addEventListener("oove:deposits-activity-refresh", bump);
    return () => window.removeEventListener("oove:deposits-activity-refresh", bump);
  }, []);

  useEffect(() => {
    const st = location.state as { welcomeSignup?: boolean } | null;
    if (st?.welcomeSignup) {
      showToast("Your account is ready! 🎉");
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate, showToast]);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    setLoadErr(null);
    try {
      const res = await fetch("/api/liquidity/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || !data || typeof data.suppliedUsd !== "number") {
        setLoadErr((typeof data?.error === "string" && data.error) || "Could not load liquidity data");
        setSummary(null);
        return;
      }
      setSummary(data as unknown as LiquiditySummary);
    } catch {
      setLoadErr("Network error — is the API running?");
      setSummary(null);
    }
  }, [token]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const supplied = summary?.suppliedUsd ?? 0;
  const maxBorrow = summary?.maxBorrowUsd ?? 0;
  const kycLabel = summary?.kycStatus ?? "—";
  const hasPendingDeposit = depositRows.some((r) => r.status === "pending_review");

  const nextSteps = useMemo(() => {
    if (!summary) return [];
    type Step = { done: boolean; title: string; detail?: string; to?: string; cta?: string };
    const out: Step[] = [];
    if (hasPendingDeposit) {
      out.push({
        done: false,
        title: "Deposit in review",
        detail:
          "Operations is verifying your latest proof. Activity will show Confirmed when your wallet is credited.",
      });
    }
    if (summary.kycStatus !== "verified" || summary.kycTier < 1) {
      out.push({
        done: false,
        title: "Verify your identity",
        detail: "Borrowing requires a verified profile and at least Tier 1.",
        to: "/verify-identity",
        cta: "Identity",
      });
    } else {
      out.push({
        done: true,
        title: "Identity verification",
        detail: `Status: ${summary.kycStatus}, Tier ${summary.kycTier}.`,
      });
    }
    if (summary.suppliedUsd < summary.minSuppliedUsdToBorrow) {
      const left = Math.max(0, summary.minSuppliedUsdToBorrow - summary.suppliedUsd);
      out.push({
        done: false,
        title: "Reach cumulative supply to borrow",
        detail: `You are at ${summary.suppliedUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })} supplied (USD equivalent). About ${left.toLocaleString("en-US", { style: "currency", currency: "USD" })} more unlocks borrowing. Each deposit declaration is at least $100 — the $10,000 rule is cumulative supplied, not per transfer.`,
        to: "/deposit",
        cta: "Supply",
      });
    } else {
      out.push({
        done: true,
        title: "Cumulative supply for borrowing",
        detail: "You have met the protocol threshold (USD equivalent) before borrow.",
      });
    }
    if (summary.canBorrow) {
      out.push({
        done: true,
        title: "Borrowing available",
        detail: `Within about ${summary.maxBorrowUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })} capacity (tier + collateral).`,
        to: "/borrow",
        cta: "Borrow",
      });
    }
    return out;
  }, [summary, hasPendingDeposit]);

  const liquidityHero = (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/80 to-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-oove-blue">Oove liquidity</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Supply, earn, and borrow</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
        Oove is inspired by leading non-custodial liquidity markets like{" "}
        <span className="font-medium text-slate-800">Aave</span>: deposit supported assets to earn yield, receive
        receipt-style balance growth (oTokens on the roadmap), and borrow against collateral with transparent rates and
        risk controls. To <span className="font-medium text-slate-800">borrow</span>, you need a cumulative{" "}
        <span className="font-medium text-slate-800">
          {summary?.minSuppliedUsdToBorrow.toLocaleString("en-US", { style: "currency", currency: "USD" }) ?? "$10,000"}
        </span>{" "}
        supplied (USD equivalent) and successful{" "}
        <Link className="font-semibold text-oove-blue underline" to="/verify-identity">
          identity verification
        </Link>
        . Each <span className="font-medium text-slate-800">single deposit</span> you declare must be at least{" "}
        <span className="font-medium text-slate-800">$100</span> USD equivalent — that minimum is separate from the
        $10,000 cumulative “integrity” bar to unlock borrowing.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/deposit"
          className="inline-flex rounded-full bg-oove-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105"
        >
          Supply
        </Link>
        <Link
          to="/borrow"
          className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Borrow
        </Link>
        <Link to="/verify-identity" className="inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-oove-blue hover:underline">
          Verify identity
        </Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {token ? <DashboardPortfolioBlock onDepositFlowChanged={() => setDepositActivityReload((n) => n + 1)} /> : null}

      {liquidityHero}

      {token ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">What to do next</h2>
            {!summary && !loadErr ? (
              <p className="mt-4 text-sm text-slate-500">Loading your checklist…</p>
            ) : !summary ? (
              <p className="mt-4 text-sm text-slate-500">Sign in and load liquidity data to see personalized steps.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {nextSteps.map((step, idx) => (
                  <li key={`${step.title}-${idx}`} className="flex gap-3">
                    <span
                      className={
                        step.done
                          ? "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800"
                          : "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-bold text-slate-500"
                      }
                      aria-hidden
                    >
                      {step.done ? "✓" : idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{step.title}</p>
                      {step.detail ? <p className="mt-1 text-sm text-slate-600">{step.detail}</p> : null}
                      {step.to && step.cta ? (
                        <Link
                          to={step.to}
                          className="mt-2 inline-flex rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          {step.cta}
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <DepositActivityPanel
            token={token}
            limit={25}
            maxDisplay={6}
            title="Recent deposit activity"
            showViewAll
            reloadToken={depositActivityReload}
            onRowsChange={onDepositRows}
          />
        </section>
      ) : null}

      {loadErr ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadErr}</div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total supplied (USD eq.)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {supplied.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
          <p className="mt-1 text-xs text-slate-500">Across wallets</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Outstanding borrow</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {(summary?.outstandingBorrowUsd ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
          <p className="mt-1 text-xs text-slate-500">USD equivalent</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Borrow capacity</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {maxBorrow.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
          <p className="mt-1 text-xs text-slate-500">Tier + collateral</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Net supply APY (est.)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {(summary?.netSupplyApyPct ?? 0).toFixed(2)}%
          </p>
          <p className="mt-1 text-xs text-slate-500">Demo blend of base yield + utilization</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Borrow rules (Oove)</h2>
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-600">
            <li>
              <strong>$100 minimum</strong> per deposit declaration (USD equivalent) when you submit a supply proof.
            </li>
            <li>
              <strong>$10,000 cumulative</strong> supplied (USD equivalent) before any borrow is allowed — this shows
              integrity and collateral depth, separate from the per-deposit minimum.
            </li>
            <li>
              Maximum borrow depends on <strong>KYC tier</strong> (Tier 1: $30k · Tier 2: $65k · Tier 3: $100k+
              ceiling) and a collateral factor on what you have supplied.
            </li>
            <li>Variable rates will track pool utilization; stable-rate switching is planned.</li>
            <li>Advanced features (flash loans, credit delegation, collateral swap) come in later releases.</li>
          </ul>
          {summary && !summary.canBorrow ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Borrowing locked</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {summary.borrowBlockedReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Identity</h2>
          <p className="mt-2 text-sm text-slate-600">
            Status: <span className="font-semibold capitalize text-slate-900">{kycLabel}</span>
            {summary != null ? (
              <>
                {" "}
                · Tier <span className="font-semibold">{summary.kycTier}</span>
              </>
            ) : null}
          </p>
          <Link
            to="/verify-identity"
            className="mt-5 inline-flex w-full justify-center rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Manage verification
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Markets (preview)</h2>
          <p className="mt-1 text-sm text-slate-500">{summary?.oTokensNote}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 sm:px-6">Asset</th>
                <th className="px-4 py-3 sm:px-6">Total supplied (you)</th>
                <th className="px-4 py-3 sm:px-6">Supply APY</th>
                <th className="px-4 py-3 sm:px-6">Borrow APR</th>
                <th className="px-4 py-3 sm:px-6" />
              </tr>
            </thead>
            <tbody>
              {MARKETS.map((m) => {
                const w = summary?.wallets.find((x) => x.currency === m.asset);
                const bal = w ? Number.parseFloat(w.balance) : 0;
                const display = Number.isFinite(bal) ? bal.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0";
                return (
                  <tr key={m.asset} className="border-t border-slate-100">
                    <td className="px-4 py-3 sm:px-6">
                      <p className="font-semibold text-slate-900">{m.asset}</p>
                      <p className="text-xs text-slate-500">{m.desc}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 sm:px-6">{display}</td>
                    <td className="px-4 py-3 font-medium text-emerald-700 sm:px-6">{m.supplyApy}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 sm:px-6">{m.borrowApr}</td>
                    <td className="px-4 py-3 sm:px-6">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to="/deposit"
                          className="rounded-full bg-oove-blue px-3 py-1 text-xs font-semibold text-white hover:brightness-105"
                        >
                          Supply
                        </Link>
                        <Link
                          to="/borrow"
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Borrow
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Why this mirrors Aave’s story</p>
        <p className="mt-2">
          Aave grew by pairing simple supply/borrow UX with rigorous risk and security work. Oove applies the same
          product discipline for a custodial-aware trading and treasury experience: clear caps, identity-gated credit,
          and room to grow into multi-chain and institutional-style controls.
        </p>
      </section>
    </div>
  );
}
