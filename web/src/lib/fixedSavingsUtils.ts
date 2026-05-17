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

import { formatDisplayDate, formatDisplayMoney, localeForLanguage } from "@/lib/displayFx";
import type { DisplayCurrency } from "@/lib/currencyCatalog";
import type { DisplayLanguage } from "@/lib/languageCatalog";

export function formatDateRange(start: Date, days: number, language: DisplayLanguage = "en"): string {
  const end = addDaysToDate(start, days);
  const locale = localeForLanguage(language);
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(start)} - ${fmt(end)}`;
}

/** @deprecated Use usePreferences().formatMoney — kept for non-React callers. */
export function formatUsd(
  amount: number,
  currency: DisplayCurrency = "USD",
  language: DisplayLanguage = "en",
): string {
  return formatDisplayMoney(amount, currency, language);
}

/** e.g. "20% Return" */
export function formatRate(rate: string | number, returnLabel = "Return"): string {
  const n = typeof rate === "string" ? Number.parseFloat(rate) : rate;
  return `${n.toFixed(0)}% ${returnLabel}`;
}

export function formatPlanLabel(
  planName: string,
  minDays: number,
  maxDays: number,
  dayLabel = "day",
  daysLabel = "days",
): string {
  if (minDays === maxDays && minDays > 0) {
    return `${planName} · ${minDays} ${minDays === 1 ? dayLabel : daysLabel} lock`;
  }
  return `${planName} · ${minDays} - ${maxDays} ${daysLabel}`;
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

export function formatMaturityDate(endDate: string, language: DisplayLanguage = "en"): string {
  const d = new Date(`${endDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return endDate;
  return formatDisplayDate(d, language);
}
