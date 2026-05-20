-- Wire transfer withdrawals: store payout method and bank details on withdrawal_requests.
ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'crypto',
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_routing_number TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'withdrawal_requests' AND constraint_name = 'withdrawal_requests_method_check'
  ) THEN
    ALTER TABLE withdrawal_requests
      ADD CONSTRAINT withdrawal_requests_method_check
      CHECK (method IN ('crypto', 'wire'));
  END IF;
END $$;
