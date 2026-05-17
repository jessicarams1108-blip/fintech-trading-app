/** Monday 00:00:00.000 UTC through next Monday 00:00:00.000 UTC (exclusive end). */
export function currentUtcWeekBounds(now = new Date()): { weekStart: Date; weekEnd: Date } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const weekStart = new Date(d);
  weekStart.setUTCDate(d.getUTCDate() - daysFromMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return { weekStart, weekEnd };
}

export function msUntilWeekReset(now = new Date()): number {
  const { weekEnd } = currentUtcWeekBounds(now);
  return Math.max(0, weekEnd.getTime() - now.getTime());
}
