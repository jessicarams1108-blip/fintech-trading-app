-- Portfolio yield accrual timestamp + bootstrap operator account
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS portfolio_yield_last_accrual_at TIMESTAMPTZ;

UPDATE users
SET account_status = 'verified',
    verification_otp_hash = NULL,
    verification_otp_expires_at = NULL,
    kyc_status = 'verified',
    kyc_tier = GREATEST(COALESCE(kyc_tier, 0), 1)
WHERE lower(email) = lower('sheiserishadanyellejohnson@gmail.com');

UPDATE ledger_entries
SET reason = 'balance_adjust'
WHERE reason = 'admin_balance_adjust';
