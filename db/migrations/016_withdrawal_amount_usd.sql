ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(18, 4);
