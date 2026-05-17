/**
 * Fixed return model: A = P(1 + r)
 * - P = principal (amount)
 * - r = return rate as decimal (rate% / 100)
 * - A = total payout
 */
export function computeReturn(amount: number, ratePct: number, disableInterest: boolean): number {
  if (disableInterest || !Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * (ratePct / 100) * 100) / 100;
}

export function computeTotalPayout(amount: number, ratePct: number, disableInterest: boolean): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (disableInterest) return Math.round(amount * 100) / 100;
  return Math.round(amount * (1 + ratePct / 100) * 100) / 100;
}

/** Daily accrual toward total return over the subscription term. */
export function computeDailyAccrual(amount: number, ratePct: number, termDays: number): number {
  if (!Number.isFinite(amount) || amount <= 0 || termDays <= 0) return 0;
  const totalReturn = amount * (ratePct / 100);
  return Math.round((totalReturn / termDays) * 100) / 100;
}
