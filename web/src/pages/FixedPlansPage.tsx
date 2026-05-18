import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import {
  fetchFixedPlans,
  fetchMyFixedPlans,
  withdrawFixedPlan,
  type FixedPlan,
  type FixedSubscription,
} from "@/lib/fixedSavingsApi";
import {
  computeReturn,
  computeTotalPayout,
  formatMaturityDate,
  formatPlanLabel,
  formatRate,
} from "@/lib/fixedSavingsUtils";
import { usePreferences } from "@/state/PreferencesContext";

function PlanRow({ plan }: { plan: FixedPlan }) {
  const { formatMoney, t } = usePreferences();
  const rate = Number.parseFloat(plan.rate);
  const minDeposit = Number.parseFloat(plan.min_amount);
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-oove-blue/10 text-oove-blue" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v3H9V7a3 3 0 013-3z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{formatRate(rate, t("common.return"))}</p>
        <p className="text-sm text-slate-500">
          {formatPlanLabel(plan.name, plan.min_days, plan.max_days, t("common.day"), t("common.days"))} · {t("fixed.min")}{" "}
          {formatMoney(minDeposit)}
        </p>
      </div>
      <Link
        to={`/fixed-plans/create/${plan.id}`}
        state={{ rate: plan.rate, minDays: plan.min_days, maxDays: plan.max_days }}
        className="shrink-0 rounded-full bg-oove-blue px-5 py-2 text-sm font-semibold text-white hover:brightness-105"
      >
        {t("common.save")}
      </Link>
    </li>
  );
}

function MyPlanRow({
  sub,
  onWithdraw,
  withdrawing,
}: {
  sub: FixedSubscription;
  onWithdraw: (id: string) => void;
  withdrawing: boolean;
}) {
  const { formatMoney, t, language } = usePreferences();
  const amount = Number.parseFloat(sub.amount);
  const rate = Number.parseFloat(sub.rate);
  const accrued = Number.parseFloat(sub.accrued_interest ?? "0");
  const planMinDays = sub.plan_min_days ?? sub.days;
  const projected = computeTotalPayout(amount, rate, sub.days, planMinDays, sub.disable_interest);
  const projectedReturn = computeReturn(amount, rate, sub.days, planMinDays, sub.disable_interest);
  const canWithdraw = sub.status === "matured";
  const maturityLabel = formatMaturityDate(String(sub.end_date), language);
  const withdrawTooltip = canWithdraw
    ? "Withdraw principal and accrued interest to CashBox"
    : `Available on ${maturityLabel}`;

  return (
    <li className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{sub.plan_name}</p>
          <p className="text-sm text-slate-500">
            {formatRate(sub.rate, t("common.return"))} · {sub.days} {t("common.days")}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
            sub.status === "active"
              ? "bg-oove-blue/10 text-oove-blue"
              : sub.status === "matured"
                ? "bg-amber-100 text-amber-900"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {sub.status}
        </span>
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900">{formatMoney(amount)}</p>
      <p className="mt-1 text-xs text-slate-500">
        {sub.start_date} → {sub.end_date}
        {sub.goal_name ? ` · ${sub.goal_name}` : ""}
      </p>
      {sub.status === "active" && accrued > 0 ? (
        <p className="mt-1 text-xs text-emerald-700">
          {t("fixed.accruedInterest")}: {formatMoney(accrued)}
        </p>
      ) : null}
      {sub.status !== "withdrawn" ? (
        <p className="mt-1 text-xs text-slate-600">
          {sub.status === "matured" ? t("fixed.payout") : t("fixed.projectedPayout")}:{" "}
          {formatMoney(sub.status === "matured" ? amount + accrued : projected)} (
          {formatMoney(sub.status === "matured" ? accrued : projectedReturn)} {t("common.return").toLowerCase()})
        </p>
      ) : null}
      {sub.status !== "withdrawn" && sub.status !== "renewed" ? (
        <div className="mt-3">
          <button
            type="button"
            disabled={!canWithdraw || withdrawing}
            title={withdrawTooltip}
            onClick={() => onWithdraw(sub.id)}
            className="rounded-full bg-oove-blue px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {withdrawing ? t("fixed.withdrawing") : t("fixed.withdraw")}
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function FixedPlansPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { formatMoney, t } = usePreferences();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "my" ? "my" : "fixed";

  const plansQ = useQuery({
    queryKey: ["fixed-plans"],
    queryFn: () => fetchFixedPlans(token!),
    enabled: Boolean(token),
  });

  const myQ = useQuery({
    queryKey: ["fixed-plans-my"],
    queryFn: () => fetchMyFixedPlans(token!),
    enabled: Boolean(token) && tab === "my",
  });

  const withdrawM = useMutation({
    mutationFn: (id: string) => withdrawFixedPlan(token!, id),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["fixed-plans-my"] });
      void qc.invalidateQueries({ queryKey: ["fixed-savings-summary"] });
      void qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      showToast(`${t("fixed.withdraw")}: ${formatMoney(data.payout)}`, "success");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{t("fixed.title")}</h1>
        <p className="text-slate-600 dark:text-slate-400">{t("fixed.subtitle")}</p>
      </header>
      <nav className="flex gap-6 border-b border-slate-200 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={tab === "fixed" ? "border-b-2 border-oove-blue pb-2 text-oove-blue" : "pb-2 text-slate-400"}
          >
            {t("fixed.plansTab")}
          </button>
          <button
            type="button"
            onClick={() => setSearchParams({ tab: "my" })}
            className={tab === "my" ? "border-b-2 border-oove-blue pb-2 text-oove-blue" : "pb-2 text-slate-400"}
          >
            {t("fixed.myPlansTab")}
          </button>
      </nav>

      {tab === "fixed" ? (
        <>
          <div>
            <p className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
              <span aria-hidden>✓</span> {t("fixed.capitalProtected")}
            </p>
          </div>

          {plansQ.isError ? <p className="text-sm text-red-600">{(plansQ.error as Error).message}</p> : null}
          {plansQ.isLoading ? <p className="text-sm text-slate-500">{t("common.loading")}</p> : null}
          <ul className="space-y-3">
            {(plansQ.data ?? []).map((p) => (
              <PlanRow key={p.id} plan={p} />
            ))}
          </ul>

          <section className="rounded-2xl border border-oove-blue/20 bg-oove-blue/5 p-5">
            <h2 className="font-semibold text-slate-900">{t("fixed.whyUpdated")}</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
              <li>Clear fixed returns per duration</li>
              <li>Easier to understand and calculate</li>
              <li>Higher earning potential for long-term savings</li>
              <li>More flexible options from 1 week to 10 years</li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-3 text-center text-xs font-medium text-slate-700 shadow-sm">
                <p className="text-oove-blue">🛡</p>
                Capital Protected
              </div>
              <div className="rounded-xl bg-white p-3 text-center text-xs font-medium text-slate-700 shadow-sm">
                <p className="text-emerald-600">💰</p>
                High Returns
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          {myQ.isError ? <p className="text-sm text-red-600">{(myQ.error as Error).message}</p> : null}
          {myQ.isLoading ? <p className="text-sm text-slate-500">Loading your plans…</p> : null}
          {(myQ.data ?? []).length === 0 && !myQ.isLoading ? (
            <p className="text-sm text-slate-500">No fixed savings yet. Pick a plan from Fixed Plans.</p>
          ) : null}
          <ul className="space-y-3">
            {(myQ.data ?? []).map((s) => (
              <MyPlanRow
                key={s.id}
                sub={s}
                withdrawing={withdrawM.isPending && withdrawM.variables === s.id}
                onWithdraw={(id) => withdrawM.mutate(id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
