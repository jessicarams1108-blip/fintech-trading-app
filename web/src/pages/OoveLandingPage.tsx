import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Reference-inspired palette: soft lavender surfaces + Oove blue CTAs */
const LAVENDER = "#f4f4fb";
const LAVENDER_DEEP = "#e8ebfa";

const faqs = [
  {
    q: "What is Oove?",
    a: "Oove is an investment and treasury platform for deposits, withdrawals, and portfolio tracking, with room to grow into trading and partner integrations.",
  },
  {
    q: "Where are deposited funds held?",
    a: "Funds are held with regulated custodial and banking partners where applicable, with segregation and reconciliation processes designed for operational safety. Replace with your legal wording before launch.",
  },
  {
    q: "Does investing have risks?",
    a: "Yes. Markets move, and any yield or return can change or be lost. Oove shows estimates and disclosures before you confirm actions—read them carefully.",
  },
  {
    q: "How do I withdraw?",
    a: "Open the app → Transfers → Withdraw, choose a destination, confirm, and wait for processing windows shown in the UI.",
  },
];

function LaunchBtn({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 ${className}`}
    >
      {children}
    </Link>
  );
}

function PurpleBtn({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center rounded-full bg-oove-blue px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 ${className}`}
    >
      {children}
    </Link>
  );
}

function PhoneMock({
  tilt,
  variant,
}: {
  tilt?: "left" | "right" | "none";
  variant: "overview" | "assets" | "performance";
}) {
  const rot = tilt === "left" ? "-rotate-[8deg]" : tilt === "right" ? "rotate-[8deg]" : "";

  return (
    <div className={`relative shrink-0 ${rot}`}>
      {/* Outer titanium-style frame (iPhone Pro family) */}
      <div
        className="relative overflow-hidden rounded-[2.85rem] p-[3px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
        style={{
          background: "linear-gradient(145deg, #d4d4d8 0%, #71717a 18%, #3f3f46 45%, #52525b 100%)",
        }}
      >
        <div className="rounded-[2.65rem] bg-black p-[5px]">
          {/* Screen inset */}
          <div
            className="relative flex aspect-[9/19.6] w-[min(11.5rem,30vw)] max-w-[220px] flex-col overflow-hidden rounded-[2.35rem] bg-[#f2f2f7] sm:w-[13rem] sm:max-w-none lg:w-[14.25rem]"
          >
            {/* Dynamic Island */}
            <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-[22px] w-[78px] -translate-x-1/2 rounded-full bg-black shadow-inner shadow-white/10" />

            {/* Status bar */}
            <div className="relative z-10 flex shrink-0 items-start justify-between px-4 pb-1 pt-3.5 text-[10px] font-semibold text-slate-900">
              <span>9:41</span>
              <div className="flex items-center gap-1 pr-0.5">
                <svg className="h-2.5 w-3 text-slate-900" viewBox="0 0 12 8" fill="currentColor" aria-hidden>
                  <path d="M1 6h2V2H1v4zm3 2h2V0H4v8zm3-3h2V3H7v5zm3-2h2V5h-2V3z" />
                </svg>
                <div className="h-2.5 w-6 rounded-sm border border-slate-400/80 bg-oove-green/90" />
              </div>
            </div>

            {/* Portfolio content */}
            <div className="relative z-10 flex flex-1 flex-col overflow-hidden px-3.5 pb-3 pt-1 min-h-0">
              {variant === "overview" && <PortfolioOverviewScreen />}
              {variant === "assets" && <PortfolioAssetsScreen />}
              {variant === "performance" && <PortfolioPerformanceScreen />}
            </div>

            {/* Home indicator */}
            <div className="flex shrink-0 justify-center pb-1.5 pt-0.5">
              <div className="h-1 w-24 rounded-full bg-black/15" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioOverviewScreen() {
  return (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Portfolio</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-[1.65rem]">
        $9,326.45
      </p>
      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <span className="text-emerald-600">▲</span> 2.41% today
      </div>
      <div className="mt-4 h-16 w-full overflow-hidden rounded-xl bg-white px-1.5 pt-2 shadow-sm ring-1 ring-slate-200/80">
        <svg viewBox="0 0 120 40" className="h-full w-full text-oove-blue" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 32 L15 28 L28 30 L42 18 L55 22 L70 10 L85 14 L100 6 L120 8 L120 40 L0 40 Z"
            fill="url(#g1)"
          />
          <path
            d="M0 32 L15 28 L28 30 L42 18 L55 22 L70 10 L85 14 L100 6 L120 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2775ca] text-[9px] font-bold text-white">
              U
            </span>
            <div>
              <p className="text-[11px] font-semibold text-slate-900">USDC</p>
              <p className="text-[9px] text-slate-500">4.12% APY</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-slate-900">$4,210</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#627eea] text-[9px] font-bold text-white">
              Ξ
            </span>
            <div>
              <p className="text-[11px] font-semibold text-slate-900">ETH</p>
              <p className="text-[9px] text-slate-500">+1.24% 24h</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-slate-900">$3,120</span>
        </div>
      </div>
    </>
  );
}

function PortfolioAssetsScreen() {
  return (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Holdings</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-[1.65rem]">$9,326.45</p>
      <p className="mt-1 text-[10px] text-slate-500">Across 4 assets</p>
      <div className="mt-3 space-y-1.5">
        {[
          { sym: "USDC", sub: "Cash · Yield", amt: "$4,210.00", col: "bg-[#2775ca]" },
          { sym: "ETH", sub: "0.84 ETH", amt: "$3,118.40", col: "bg-[#627eea]" },
          { sym: "BTC", sub: "0.021 BTC", amt: "$1,998.05", col: "bg-[#f7931a]" },
        ].map((row) => (
          <div
            key={row.sym}
            className="flex items-center justify-between rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-200/70"
          >
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ${row.col}`}>
                {row.sym.slice(0, 1)}
              </span>
              <div>
                <p className="text-[11px] font-semibold text-slate-900">{row.sym}</p>
                <p className="text-[9px] text-slate-500">{row.sub}</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-slate-900">{row.amt}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-slate-900 px-2.5 py-2">
        <p className="text-[9px] font-medium text-white/60">Earn</p>
        <p className="text-[11px] font-semibold text-white">Move idle cash to yield</p>
      </div>
    </>
  );
}

function PortfolioPerformanceScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Performance</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-[1.65rem]">$9,326.45</p>
      <div className="mt-3 flex gap-2">
        <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/80">
          1W
        </span>
        <span className="rounded-lg bg-slate-200/80 px-2 py-1 text-[9px] font-semibold text-slate-600">1M</span>
        <span className="rounded-lg bg-slate-200/80 px-2 py-1 text-[9px] font-semibold text-slate-600">1Y</span>
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200/80">
        <div className="flex min-h-[5.5rem] flex-1 items-end justify-between gap-0.5 px-0.5">
          {[42, 38, 55, 48, 62, 50, 70, 58, 75, 68, 82, 78].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-[2px] bg-gradient-to-t from-oove-blue/25 to-oove-blue" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-2 flex shrink-0 justify-between border-t border-slate-100 pt-2 text-[8px] text-slate-400">
          <span>M</span>
          <span>T</span>
          <span>W</span>
          <span>T</span>
          <span>F</span>
        </div>
      </div>
      <div className="mt-2 flex shrink-0 items-center justify-between rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-200/70">
        <span className="text-[10px] font-medium text-slate-600">All-time return</span>
        <span className="text-[11px] font-bold text-emerald-600">+18.4%</span>
      </div>
    </div>
  );
}

export function OoveLandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased [font-feature-settings:'ss01']">
      {/* Nav — Aave-style: mark + wordmark | centered links | pill CTA */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-6 lg:px-8">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 text-slate-900 no-underline"
            aria-label="Oove home"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#7c3aed] text-xs font-black tracking-tight text-white">
              OO
            </span>
            <span className="text-[1.35rem] font-bold lowercase tracking-tight">oove</span>
          </Link>

          <nav className="hidden justify-center lg:flex">
            <ul className="flex items-center gap-10 text-[0.9375rem] font-medium text-slate-500">
              <li>
                <a className="transition hover:text-slate-900" href="#savings">
                  Products
                </a>
              </li>
              <li>
                <a className="transition hover:text-slate-900" href="#build">
                  Resources
                </a>
              </li>
              <li>
                <a className="transition hover:text-slate-900" href="#best-build">
                  Developers
                </a>
              </li>
              <li>
                <a className="transition hover:text-slate-900" href="#trust">
                  About
                </a>
              </li>
            </ul>
          </nav>

          <div className="flex flex-1 justify-end lg:flex-none">
            <LaunchBtn to="/onboarding">Use Oove</LaunchBtn>
          </div>
        </div>
      </header>

      {/* Hero — centered headline (reference layout) + phones on lavender */}
      <section id="savings" className="border-b border-slate-200/80 bg-white px-5 pb-12 pt-14 lg:px-8 lg:pb-16 lg:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#7c3aed] text-[10px] font-black text-white">
              OO
            </span>
            <span className="text-sm font-medium text-slate-500">Oove App</span>
          </div>
          <h1 className="text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]">
            Savings for Everyone
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
            Earn up to{" "}
            <span className="font-semibold text-oove-blue underline decoration-oove-blue decoration-wavy decoration-2 underline-offset-[5px]">
              5.00%
            </span>{" "}
            on your savings with industry-leading interest rates and balance protection up to $1M.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <PurpleBtn to="/onboarding">Open web app</PurpleBtn>
            <Link
              to="/deposit"
              className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-oove-blue"
            >
              Learn more
            </Link>
          </div>
        </div>
      </section>
      <section className="border-b border-slate-200/80 px-5 pb-16 pt-4 lg:px-8 lg:pb-24" style={{ backgroundColor: LAVENDER }}>
        <div className="mx-auto mt-14 flex max-w-6xl items-end justify-center gap-0 overflow-x-auto px-1 pb-2 pt-2 sm:mt-16 sm:px-4">
          <div className="z-[1] origin-bottom translate-y-3 scale-[0.92] sm:translate-y-5 sm:scale-95">
            <PhoneMock tilt="left" variant="overview" />
          </div>
          <div className="z-[3] -mx-1 origin-bottom scale-100 sm:-mx-4 sm:scale-[1.06]">
            <PhoneMock tilt="none" variant="assets" />
          </div>
          <div className="z-[1] origin-bottom translate-y-3 scale-[0.92] sm:translate-y-5 sm:scale-95">
            <PhoneMock tilt="right" variant="performance" />
          </div>
        </div>
      </section>

      {/* Black — full power + dashboard */}
      <section className="bg-black px-5 py-20 text-white lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            The full power of modern investing
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Fast, flexible and secure. Built on Oove&apos;s core engine.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-6">
            <Link
              to="/onboarding"
              className="inline-flex rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-slate-200"
            >
              Get started
            </Link>
          </div>
        </div>

        {/* Large dashboard mock */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
              </div>
              <span className="ml-2 text-xs text-slate-500">app.oove.com</span>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3">
              {["Borrow", "Supply", "Portfolio"].map((tab, i) => (
                <span
                  key={tab}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${i === 0 ? "bg-white text-black" : "text-slate-400"}`}
                >
                  {tab}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto p-4 sm:p-6">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="pb-3 pr-4">Asset</th>
                    <th className="pb-3 pr-4">Wallet balance</th>
                    <th className="pb-3 pr-4">Supply APY</th>
                    <th className="pb-3">Borrow APY</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {[
                    ["USDC", "$12,400.00", "4.12%", "5.80%"],
                    ["USDT", "$8,210.50", "4.05%", "5.72%"],
                    ["DAI", "$3,000.00", "3.98%", "5.65%"],
                    ["ETH", "2.42 ETH", "—", "3.10%"],
                  ].map(([a, b, c, d]) => (
                    <tr key={a} className="border-b border-white/5">
                      <td className="py-3 pr-4 font-medium text-white">{a}</td>
                      <td className="py-3 pr-4">{b}</td>
                      <td className="py-3 pr-4 text-oove-green">{c}</td>
                      <td className="py-3">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-3xl text-center">
          <h3 className="text-2xl font-semibold sm:text-3xl">Markets for every strategy.</h3>
          <p className="mt-3 text-white/60">
            From core liquidity to isolated risk—pick the market that matches how you earn and borrow.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
          {[
            {
              title: "Main market",
              body: "Widely used assets with deep liquidity and standard parameters.",
            },
            {
              title: "Isolated markets",
              body: "Ring-fenced collateral so strategies stay separate and predictable.",
            },
            {
              title: "Efficiency mode",
              body: "Borrow against correlated assets with streamlined risk controls.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left transition hover:border-white/20"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-oove-green">Oove</p>
              <p className="mt-2 text-lg font-semibold">{c.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Build with Oove — white + abstract blocks */}
      <section id="build" className="border-b border-slate-200 px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Build with Oove</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-600">
              Grant hiring, treasury, and on-product experiences with Oove&apos;s integration stack and clear APIs.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <PurpleBtn to="/onboarding">Start building</PurpleBtn>
              <a
                href="mailto:sales@oove.com"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Talk to sales
              </a>
            </div>
          </div>
          <div className="relative flex h-72 items-center justify-center lg:h-96">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-slate-100 to-[#e8ebfa]" />
            <div className="relative flex items-end justify-center gap-3">
              <div className="h-28 w-24 translate-y-2 rotate-[-8deg] rounded-2xl bg-gradient-to-br from-oove-blue to-indigo-600 shadow-lg" />
              <div className="z-10 flex h-36 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-oove-blue text-2xl font-black text-white shadow-xl">
                O
              </div>
              <div className="h-28 w-24 translate-y-2 rotate-[8deg] rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* The best build — metric cards */}
      <section id="best-build" className="px-5 py-20 lg:px-8" style={{ backgroundColor: LAVENDER_DEEP }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">The best build with Oove.</h2>
          <p className="mt-4 text-lg text-slate-600">
            Reach more users and move more volume with a few integration steps—then iterate with real data.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { k: "2M+", d: "Users reached via partner surfaces." },
            { k: "100M+", d: "Addressable users in target segments." },
            { k: "$360M+", d: "Notional throughput on pilot programs." },
            { k: "$10B+", d: "Cumulative volume milestone." },
            { k: "-40%", d: "Operational cost vs. legacy stack." },
            { k: "SOC 2", d: "Security roadmap alignment." },
          ].map((m) => (
            <div
              key={m.k}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-9 w-9 rounded-lg bg-slate-100" />
              <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{m.k}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trusted by default */}
      <section id="trust" className="border-b border-slate-200 bg-white px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Trusted by default</h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Years of iteration on flows, disclosures, and safeguards—designed to be reviewed, audited, and improved
            continuously.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/onboarding"
              className="inline-flex rounded-full bg-black px-7 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Learn more
            </Link>
            <a
              href="#footer"
              className="inline-flex rounded-full border border-slate-300 px-7 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              View careers
            </a>
          </div>
        </div>
        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
          {[
            ["6+", "Years of product iteration"],
            ["$3.46T", "Notional throughput"],
            ["$1T+", "Borrow-side milestone"],
            ["$88B", "Monthly volume"],
            ["$1.9B", "Interest routed"],
            ["SOC 2", "Target attestation path"],
          ].map(([v, l]) => (
            <div key={v} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
              <p className="text-xl font-semibold text-slate-900">{v}</p>
              <p className="mt-1 text-xs leading-snug text-slate-600">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — title left, list right (wide screens) */}
      <section id="faq" className="border-b border-slate-200 px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">FAQs</h2>
            <p className="mt-4 text-slate-600">Straight answers. Swap for legal/compliance copy before launch.</p>
            <PurpleBtn to="/onboarding" className="mt-8">
              Learn more about Oove
            </PurpleBtn>
          </div>
          <div className="divide-y divide-slate-200 lg:col-span-8">
            {faqs.map((item, i) => (
              <div key={item.q} className="py-5">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-base font-semibold text-slate-900 lg:text-lg">{item.q}</span>
                  <span className="shrink-0 text-xl font-light text-oove-blue">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">{item.a}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="px-5 py-16 lg:px-8" style={{ backgroundColor: LAVENDER }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 border-b border-slate-200/80 pb-16 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Be the first to hear about Oove.</h2>
            <p className="mt-2 text-slate-600">Product updates, research, and launches. No spam.</p>
          </div>
          <div className="flex w-full max-w-md gap-2">
            <input
              type="email"
              placeholder="Email"
              className="flex-1 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm outline-none ring-oove-blue/30 focus:ring-2"
            />
            <button
              type="button"
              className="shrink-0 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Sign up →
            </button>
          </div>
        </div>

        {/* Footer columns */}
        <footer className="mx-auto max-w-6xl pt-16" id="footer">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <p className="text-xl font-semibold">Oove</p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
                Oove is a financial technology platform. Investing involves risk of loss. Past performance does not
                guarantee future results.
              </p>
              <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-oove-blue hover:underline">
                Sign in to your account →
              </Link>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Products</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>
                  <Link to="/onboarding" className="hover:text-oove-blue">
                    Oove App
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard" className="hover:text-oove-blue">
                    Oove Pro
                  </Link>
                </li>
                <li>
                  <Link to="/onboarding" className="hover:text-oove-blue">
                    Oove API
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Resources</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>
                  <a href="#" className="hover:text-oove-blue">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-oove-blue">
                    Brand assets
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-oove-blue">
                    Help center
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Developers</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>
                  <Link to="/onboarding" className="hover:text-oove-blue">
                    API docs
                  </Link>
                </li>
                <li>
                  <Link to="/onboarding" className="hover:text-oove-blue">
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-slate-200/80 pt-8 text-sm text-slate-500">
            <span>© {new Date().getFullYear()} Oove</span>
          </div>
        </footer>
      </section>
    </div>
  );
}
