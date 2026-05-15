-- Oove liquidity + identity (KYC) fields for borrow gating
-- Run after prior migrations on existing DBs.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS kyc_tier SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.kyc_status IS 'unverified | pending | verified';
COMMENT ON COLUMN users.kyc_tier IS '0 none, 1 standard ($30k cap), 2 enhanced ($65k), 3 premium ($100k+)';
