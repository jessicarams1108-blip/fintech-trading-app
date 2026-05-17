-- AI Agent simulated trading wallets and trades
CREATE TABLE IF NOT EXISTS ai_trading_wallets (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  balance NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset VARCHAR(50) NOT NULL,
  asset_class VARCHAR(20) NOT NULL DEFAULT 'crypto',
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  result_type VARCHAR(10),
  profit_loss_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  CONSTRAINT ai_trades_result_type_chk CHECK (
    result_type IS NULL OR result_type IN ('profit', 'loss')
  ),
  CONSTRAINT ai_trades_status_chk CHECK (status IN ('running', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_ai_trades_user_start ON ai_trades (user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_ai_trades_status_running ON ai_trades (status) WHERE status = 'running';
