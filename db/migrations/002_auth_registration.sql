-- Email verification + profile fields for signup flow
-- Run after schema.sql on existing databases: psql $DATABASE_URL -f db/migrations/002_auth_registration.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS verification_otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS verification_otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS age SMALLINT,
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
