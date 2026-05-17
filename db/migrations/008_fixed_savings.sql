-- Fixed savings plans and subscriptions
-- Run: npm run db:sql -- ../db/migrations/008_fixed_savings.sql

CREATE TABLE IF NOT EXISTS fixed_savings_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rate NUMERIC(6, 3) NOT NULL,
  min_days INTEGER NOT NULL,
  max_days INTEGER NOT NULL,
  min_amount NUMERIC(18, 2) NOT NULL DEFAULT 2000,
  max_amount NUMERIC(18, 2) NOT NULL DEFAULT 5000000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fixed_savings_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES fixed_savings_plans(id),
  amount NUMERIC(18, 2) NOT NULL,
  days INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  interest_earned NUMERIC(18, 6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'matured', 'withdrawn', 'renewed')),
  goal_name TEXT,
  auto_renewal BOOLEAN NOT NULL DEFAULT false,
  disable_interest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matured_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fixed_savings_subs_user ON fixed_savings_subscriptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fixed_savings_subs_status ON fixed_savings_subscriptions (status);

INSERT INTO fixed_savings_plans (id, name, rate, min_days, max_days, min_amount, max_amount, status, sort_order)
VALUES
  ('a1000001-0001-4001-8001-000000000001', '7 - 29 Days', 10.000, 7, 29, 2000, 5000000, 'active', 1),
  ('a1000001-0001-4001-8001-000000000002', '30 - 59 Days', 10.000, 30, 59, 2000, 5000000, 'active', 2),
  ('a1000001-0001-4001-8001-000000000003', '60 - 89 Days', 12.000, 60, 89, 2000, 5000000, 'active', 3),
  ('a1000001-0001-4001-8001-000000000004', '90 - 179 Days', 15.000, 90, 179, 2000, 5000000, 'active', 4),
  ('a1000001-0001-4001-8001-000000000005', '180 - 364 Days', 18.000, 180, 364, 2000, 5000000, 'active', 5),
  ('a1000001-0001-4001-8001-000000000006', '365 - 1000 Days', 20.000, 365, 1000, 2000, 5000000, 'active', 6)
ON CONFLICT (id) DO NOTHING;
