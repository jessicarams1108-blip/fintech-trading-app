import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  formatDateRange,
  formatRate,
  formatUsd,
  quickDayOptions,
} from "@/lib/fixedSavingsUtils";

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
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-violet-600" : "bg-slate-300"}`}
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
  const maxDays = plan?.max_days ?? navState?.maxDays ?? 59;
  const rate = plan?.rate ?? navState?.rate ?? "10";

  const quickDays = useMemo(() => quickDayOptions(minDays, maxDays), [minDays, maxDays]);

  const [amountRaw, setAmountRaw] = useState("");
  const [selectedDays, setSelectedDays] = useState<number | null>(null);

  useEffect(() => {
    if (selectedDays === null && quickDays.length > 0) {
      setSelectedDays(quickDays[0]!);
    }
  }, [quickDays, selectedDays]);
  const [customDays, setCustomDays] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [disableInterest, setDisableInterest] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const days = showMore
    ? Number.parseInt(customDays, 10)
    : (selectedDays ?? quickDays[0] ?? minDays);

  const amount = Number.parseFloat(amountRaw.replace(/,/g, ""));
  const cashBox = balanceQ.data?.cashBoxUsd ?? 0;

  const amountValid = Number.isFinite(amount) && amount >= minAmt && amount <= maxAmt && amount <= cashBox;
  const daysValid = Number.isInteger(days) && days >= minDays && days <= maxDays;
  const canNext = amountValid && daysValid;

  const dateRange = useMemo(() => formatDateRange(new Date(), daysValid ? days : minDays), [days, daysValid, minDays]);

  const subscribeM = useMutation({
    mutationFn: () =>
      subscribeFixedPlan(token!, {
        plan_id: planId!,
        amount,
        days,
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
    <div className="mx-auto max-w-lg space-y-5 pb-28">
      <div className="flex items-center gap-3">
        <Link to="/fixed-plans" className="rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Back">
          ←
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Create Your Plan</h1>
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
              placeholder={`${formatUsd(minAmt)} - ${formatUsd(maxAmt)}`}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={fillAll}
              className="shrink-0 text-sm font-semibold text-violet-600"
            >
              All
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            CashBox Balance: {balanceQ.isLoading ? "…" : formatUsd(cashBox)}
          </p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Interest Rate</span>
          <span className="font-semibold text-violet-600">{formatRate(rate)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-600">Disable Interest on Savings</span>
          <Toggle checked={disableInterest} onChange={setDisableInterest} label="Disable interest" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
        <p className="text-sm font-medium text-slate-700">Savings Duration</p>
        <div className="flex flex-wrap gap-2">
          {quickDays.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setShowMore(false);
                setSelectedDays(d);
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                !showMore && selectedDays === d
                  ? "border border-violet-500 bg-violet-50 text-violet-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {d} days
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              showMore ? "border border-violet-500 bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            More
          </button>
        </div>
        {showMore ? (
          <input
            type="number"
            min={minDays}
            max={maxDays}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            placeholder={`${minDays} - ${maxDays} days`}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        ) : null}
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
        className="fixed bottom-6 left-4 right-4 mx-auto max-w-lg rounded-full bg-violet-600 py-3.5 text-center text-sm font-semibold text-white disabled:opacity-40"
      >
        Next
      </button>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Confirm your plan</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Amount: {formatUsd(amount)}</li>
              <li>Duration: {days} days ({dateRange})</li>
              <li>Rate: {formatRate(rate)}</li>
              {goalName.trim() ? <li>Goal: {goalName.trim()}</li> : null}
              <li>Auto-renewal: {autoRenewal ? "On" : "Off"}</li>
              <li>Interest: {disableInterest ? "Disabled" : "Enabled"}</li>
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
                className="flex-1 rounded-full bg-violet-600 py-2.5 text-sm font-semibold text-white"
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
