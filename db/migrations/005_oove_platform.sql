-- Oove platform: borrow, portfolio, watchlist, withdrawals, sessions, API keys, documents
-- Run after 004 (or on fresh DBs that already include prior migrations).

-- Allow USDC / DAI wallet lines (borrow + stables)
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_currency_check;
ALTER TABLE wallets ADD CONSTRAINT wallets_currency_check CHECK (
  currency IN ('USD', 'BTC', 'ETH', 'USDT', 'USDC', 'DAI')
);

CREATE TABLE IF NOT EXISTS borrow_positions (
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

CREATE INDEX IF NOT EXISTS idx_borrow_positions_user ON borrow_positions (user_id);
CREATE INDEX IF NOT EXISTS idx_borrow_positions_active ON borrow_positions (user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quantity NUMERIC(36, 18) NOT NULL,
  avg_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user ON portfolio_holdings (user_id);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_usd NUMERIC(24, 2) NOT NULL,
  UNIQUE (user_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items (user_id);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
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

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawal_requests (user_id);

CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (
    status IN ('uploaded', 'pending_review', 'approved', 'rejected')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);
