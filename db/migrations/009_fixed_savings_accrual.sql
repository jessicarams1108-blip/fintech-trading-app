-- Accrued interest tracking for fixed savings
ALTER TABLE fixed_savings_subscriptions
  ADD COLUMN IF NOT EXISTS accrued_interest NUMERIC(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_interest_credit_at TIMESTAMPTZ;
