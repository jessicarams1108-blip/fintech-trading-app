-- Borrow & internal transfer requests (admin approval). Safe to run after 005.

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
