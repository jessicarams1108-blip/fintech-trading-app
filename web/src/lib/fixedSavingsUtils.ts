/** Fixed term: one duration per plan (min === max). */
export function planTermDays(minDays: number, maxDays: number): number {
  return Math.max(minDays, maxDays);
}

export function isFixedTermPlan(minDays: number, maxDays: number): boolean {
  return minDays === maxDays;
}

export function addDaysToDate(start: Date, days: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + days - 1);
  return d;
}

export function formatDateRange(start: Date, days: number): string {
  const end = addDaysToDate(start, days);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(start)} - ${fmt(end)}`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** e.g. "20% Return" */
export function formatRate(rate: string | number): string {
  const n = typeof rate === "string" ? Number.parseFloat(rate) : rate;
  return `${n.toFixed(0)}% Return`;
}

export function formatPlanLabel(planName: string, minDays: number, maxDays: number): string {
  if (minDays === maxDays && minDays > 0) {
    return `${planName} · ${minDays} day${minDays === 1 ? "" : "s"} lock`;
  }
  return `${planName} · ${minDays} - ${maxDays} days`;
}

/**
 * A = P(1 + r). Total payout does not vary with days within a fixed-term plan.
 */
export function computeTotalPayout(
  amount: number,
  ratePct: number,
  _days: number,
  _minDays: number,
  disableInterest: boolean,
): number {
  void _days;
  void _minDays;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (disableInterest) return Math.round(amount * 100) / 100;
  return Math.round(amount * (1 + ratePct / 100) * 100) / 100;
}

export function computeReturn(
  amount: number,
  ratePct: number,
  _days: number,
  _minDays: number,
  disableInterest: boolean,
): number {
  void _days;
  void _minDays;
  if (disableInterest || !Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * (ratePct / 100) * 100) / 100;
}

export function formatMaturityDate(endDate: string): string {
  const d = new Date(`${endDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return endDate;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
