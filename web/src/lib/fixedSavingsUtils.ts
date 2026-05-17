/** Three quick-pick day options inside [minDays, maxDays]. */
export function quickDayOptions(minDays: number, maxDays: number): number[] {
  if (maxDays <= minDays) return [minDays];
  if (maxDays - minDays <= 2) return [...new Set([minDays, maxDays])];
  let mid = Math.round((minDays + maxDays) / 2);
  if (minDays === 30 && maxDays === 59) mid = 40;
  return [...new Set([minDays, mid, maxDays])].sort((a, b) => a - b);
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

export function formatRate(rate: string | number): string {
  const n = typeof rate === "string" ? Number.parseFloat(rate) : rate;
  return `${n.toFixed(2)}% p.a.`;
}
