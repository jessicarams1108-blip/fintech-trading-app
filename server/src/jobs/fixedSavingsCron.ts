import {
  accrueDailyInterestForActiveSubscriptions,
  matureSubscriptionsPastEndDate,
} from "../db/queries/fixedSavings.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function msUntilNextUtc(hour: number, minute: number): number {
  const now = new Date();
  let next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0);
  if (next <= now.getTime()) next += MS_PER_DAY;
  return next - now.getTime();
}

async function runFixedSavingsDailyJobs(): Promise<void> {
  const accrued = await accrueDailyInterestForActiveSubscriptions();
  const matured = await matureSubscriptionsPastEndDate();
  if (matured > 0 || accrued > 0) {
    console.log(`[fixed-savings-cron] matured=${matured} accrued=${accrued}`);
  }
}

/** Daily at 00:05 UTC: accrue interest, then mark matured plans. */
export function startFixedSavingsCron(): void {
  const schedule = () => {
    void runFixedSavingsDailyJobs().catch((err) => {
      console.error("[fixed-savings-cron] job failed:", err);
    });
  };

  const initialDelay = msUntilNextUtc(0, 5);
  console.log(`[fixed-savings-cron] first run in ${Math.round(initialDelay / 1000)}s (00:05 UTC daily)`);
  setTimeout(() => {
    schedule();
    setInterval(schedule, MS_PER_DAY);
  }, initialDelay);
}
