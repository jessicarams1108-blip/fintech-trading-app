-- Allow SOL wallet lines (deposit confirm credits wallets.currency).
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_currency_check;
ALTER TABLE wallets ADD CONSTRAINT wallets_currency_check CHECK (
  currency IN ('USD', 'BTC', 'ETH', 'USDT', 'USDC', 'DAI', 'SOL')
);
