-- PostgreSQL starter schema for fiat/crypto ledger + deposits queue
-- Optionally: CREATE EXTENSION IF NOT EXISTS citext; -- then swap email to citext type

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    account_status TEXT NOT NULL DEFAULT 'verified',
    verification_otp_hash TEXT,
    verification_otp_expires_at TIMESTAMPTZ,
    first_name TEXT,
    last_name TEXT,
    age SMALLINT,
    username TEXT,
    totp_secret TEXT,
    biometric_public_key BYTEA,
    kyc_status TEXT NOT NULL DEFAULT 'unverified',
    kyc_tier SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username));

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id),
    currency TEXT NOT NULL CHECK (currency IN ('USD', 'BTC', 'ETH', 'USDT', 'USDC', 'DAI')),
    balance NUMERIC(36, 18) NOT NULL DEFAULT 0,
    UNIQUE (user_id, currency)
);

CREATE TYPE deposit_status AS ENUM (
    'awaiting_payment',
    'pending_review',
    'confirmed',
    'rejected'
);

CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id),
    asset TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    proof_image_url TEXT,
    declared_amount_usd NUMERIC(18, 2),
    status deposit_status NOT NULL DEFAULT 'pending_review',
    credited_amount NUMERIC(36, 18),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users (id)
);

CREATE INDEX idx_deposits_status ON deposits (status);

CREATE TYPE ledger_direction AS ENUM ('credit', 'debit');

CREATE TABLE ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    currency TEXT NOT NULL,
    direction ledger_direction NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    reason TEXT NOT NULL,
    ref_type TEXT NOT NULL,
    ref_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES users (id),
    action TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE borrow_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    principal_usd NUMERIC(18, 2) NOT NULL CHECK (principal_usd > 0),
    rate_mode TEXT NOT NULL DEFAULT 'variable' CHECK (rate_mode IN ('variable', 'stable')),
    variable_apr NUMERIC(10, 4) NOT NULL,
    stable_apr NUMERIC(10, 4) NOT NULL,
    interest_accrued_usd NUMERIC(18, 6) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_borrow_positions_user ON borrow_positions (user_id);

CREATE TABLE portfolio_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    quantity NUMERIC(36, 18) NOT NULL,
    avg_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, symbol)
);

CREATE TABLE portfolio_snapshots (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_usd NUMERIC(24, 2) NOT NULL,
    UNIQUE (user_id, snapshot_date)
);

CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, symbol)
);

CREATE TABLE withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    destination TEXT NOT NULL,
    fee_usd NUMERIC(18, 4) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending_admin' CHECK (
      status IN ('pending_admin', 'approved', 'rejected', 'completed')
    ),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE verification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (
      status IN ('uploaded', 'pending_review', 'approved', 'rejected')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS borrow_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    amount_usd NUMERIC(18, 2) NOT NULL CHECK (amount_usd > 0),
    rate_mode TEXT NOT NULL DEFAULT 'variable' CHECK (rate_mode IN ('variable', 'stable')),
    variable_apr NUMERIC(10, 4) NOT NULL,
    stable_apr NUMERIC(10, 4) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_admin' CHECK (status IN ('pending_admin', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_borrow_requests_user ON borrow_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_borrow_requests_pending ON borrow_requests (created_at DESC) WHERE status = 'pending_admin';

CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    asset TEXT NOT NULL,
    amount NUMERIC(36, 18) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending_admin' CHECK (status IN ('pending_admin', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_requests_pending ON transfer_requests (created_at DESC) WHERE status = 'pending_admin';

CREATE TABLE IF NOT EXISTS identity_verification_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  id_doc_type TEXT NOT NULL,
  id_storage_key TEXT NOT NULL,
  id_content_type TEXT,
  id_file_name TEXT,
  id_document_base64 TEXT,
  ssn_last4 TEXT NOT NULL,
  phone_country_code TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  state_province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  vendor_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_verify_user_created
  ON identity_verification_submissions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_identity_verify_pending
  ON identity_verification_submissions (created_at ASC)
  WHERE status = 'pending';
