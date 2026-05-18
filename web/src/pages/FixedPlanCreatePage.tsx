import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import {
  fetchCashBoxBalance,
  fetchFixedPlan,
  subscribeFixedPlan,
  type FixedPlan,
} from "@/lib/fixedSavingsApi";
import {
  computeReturn,
  computeTotalPayout,
  formatDateRange,
  formatPlanLabel,
  formatRate,
  isFixedTermPlan,
  planTermDays,
} from "@/lib/fixedSavingsUtils";
import { usePreferences } from "@/state/PreferencesContext";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-oove-blue" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}

export function FixedPlanCreatePage() {
  const { planId } = useParams<{ planId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const { formatMoney, t, language } = usePreferences();

  const navState = location.state as { rate?: string; minDays?: number; maxDays?: number } | null;

  const planQ = useQuery({
    queryKey: ["fixed-plan", planId],
    queryFn: () => fetchFixedPlan(token!, planId!),
    enabled: Boolean(token && planId),
  });

  const balanceQ = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => fetchCashBoxBalance(token!),
    enabled: Boolean(token),
  });

  const plan: FixedPlan | undefined = planQ.data;
  const minAmt = plan ? Number.parseFloat(plan.min_amount) : 2000;
  const maxAmt = plan ? Number.parseFloat(plan.max_amount) : 5_000_000;
  const minDays = plan?.min_days ?? navState?.minDays ?? 30;
  const maxDays = plan?.max_days ?? navState?.maxDays ?? 30;
  const rate = plan?.rate ?? navState?.rate ?? "30";
  const termDays = planTermDays(minDays, maxDays);
  const fixedTerm = isFixedTermPlan(minDays, maxDays);
  const planTitle = plan?.name ?? "Fixed plan";

  const [amountRaw, setAmountRaw] = useState("");
  const [goalName, setGoalName] = useState("");
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [disableInterest, setDisableInterest] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const amount = Number.parseFloat(amountRaw.replace(/,/g, ""));
  const cashBox = balanceQ.data?.cashBoxUsd ?? 0;

  const amountValid = Number.isFinite(amount) && amount >= minAmt && amount <= maxAmt && amount <= cashBox;
  const canNext = amountValid && termDays > 0;

  const dateRange = useMemo(() => formatDateRange(new Date(), termDays, language), [termDays, language]);

  const rateNum = Number.parseFloat(rate);
  const returnAmount = useMemo(
    () => (amountValid ? computeReturn(amount, rateNum, termDays, minDays, disableInterest) : 0),
    [amount, rateNum, termDays, minDays, disableInterest, amountValid],
  );
  const totalPayout = useMemo(
    () => (amountValid ? computeTotalPayout(amount, rateNum, termDays, minDays, disableInterest) : 0),
    [amount, rateNum, termDays, minDays, disableInterest, amountValid],
  );

  const subscribeM = useMutation({
    mutationFn: () =>
      subscribeFixedPlan(token!, {
        plan_id: planId!,
        amount,
        days: termDays,
        goal_name: goalName.trim() || undefined,
        auto_renewal: autoRenewal,
        disable_interest: disableInterest,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fixed-plans-my"] });
      void qc.invalidateQueries({ queryKey: ["fixed-savings-summary"] });
      void qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      showToast("Fixed savings plan created", "success");
      navigate("/fixed-plans?tab=my");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  function fillAll() {
    const cap = Math.min(cashBox, maxAmt);
    if (cap >= minAmt) setAmountRaw(cap.toFixed(2));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Link to="/fixed-plans" className="rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Back">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Create your plan</h1>
          {plan ? (
            <p className="text-sm text-oove-blue">
              {formatRate(rate, t("common.return"))} ·{" "}
              {formatPlanLabel(planTitle, minDays, maxDays, t("common.day"), t("common.days"))}
            </p>
          ) : null}
        </div>
      </div>

      {planQ.isError ? <p className="text-sm text-red-600">{(planQ.error as Error).message}</p> : null}

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Enter the amount you want to save?</label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
              placeholder={`${formatMoney(minAmt)} - ${formatMoney(maxAmt)}`}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={fillAll}
              className="shrink-0 text-sm font-semibold text-oove-blue"
            >
              All
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t("fixed.cashBoxBalance")}: {balanceQ.isLoading ? "…" : formatMoney(cashBox)}
          </p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{t("fixed.fixedReturn")}</span>
          <span className="font-semibold text-oove-blue">{formatRate(rate, t("common.return"))}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{t("fixed.totalPayout")}</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {amountValid ? formatMoney(totalPayout) : "—"}
          </span>
        </div>
        {amountValid && !disableInterest ? (
          <p className="text-xs text-slate-500">
            Return: {formatMoney(returnAmount)} on {formatMoney(amount)} principal
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-600">Disable return on savings</span>
          <Toggle checked={disableInterest} onChange={setDisableInterest} label="Disable return" />
        </div>
      </section>

      <section className="rounded-2xl border border-oove-blue/20 bg-oove-blue/5 p-4 shadow-sm space-y-2">
        <p className="text-sm font-medium text-slate-700">{t("fixed.savingsDuration")}</p>
        <p className="text-lg font-semibold text-slate-900">{planTitle}</p>
        <p className="text-sm text-slate-600">
          {fixedTerm
            ? `Fixed lock: ${termDays} ${termDays === 1 ? t("common.day") : t("common.days")} · ${formatRate(rate, t("common.return"))}`
            : `${minDays}–${maxDays} ${t("common.days")}`}
        </p>
        <p className="text-xs text-slate-500">{dateRange}</p>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700">What&apos;s it for?</label>
        <input
          type="text"
          value={goalName}
          onChange={(e) => setGoalName(e.target.value)}
          placeholder="Name your goal (optional)"
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
        <p className="text-sm font-medium text-slate-700">Would You Like to Enable Auto-Renewal?</p>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-sm">
          <span className="text-slate-700">Auto-Renewal</span>
          <Toggle checked={autoRenewal} onChange={setAutoRenewal} label="Auto-renewal" />
        </div>
      </section>

      <button
        type="button"
        disabled={!canNext || subscribeM.isPending}
        onClick={() => setConfirmOpen(true)}
        className="w-full rounded-full bg-oove-blue py-3.5 text-center text-sm font-semibold text-white hover:brightness-105 disabled:opacity-40"
      >
        Next
      </button>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Confirm your plan</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Amount: {formatMoney(amount)}</li>
              <li>Term: {planTitle} ({termDays} days)</li>
              <li>Period: {dateRange}</li>
              <li>{t("fixed.fixedReturn")}: {formatRate(rate, t("common.return"))}</li>
              <li>{t("fixed.totalPayout")}: {formatMoney(totalPayout)}</li>
              {goalName.trim() ? <li>Goal: {goalName.trim()}</li> : null}
              <li>Auto-renewal: {autoRenewal ? "On" : "Off"}</li>
              <li>Return payout: {disableInterest ? "Disabled" : "Enabled"}</li>
            </ul>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={subscribeM.isPending}
                className="flex-1 rounded-full bg-oove-blue py-2.5 text-sm font-semibold text-white"
                onClick={() => subscribeM.mutate()}
              >
                {subscribeM.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
