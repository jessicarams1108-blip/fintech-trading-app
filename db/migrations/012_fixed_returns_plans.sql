-- Fixed returns: A = P(1 + r). New duration tiers; retire legacy day-range plans.

UPDATE fixed_savings_plans SET status = 'inactive'
WHERE id IN (
  'a1000001-0001-4001-8001-000000000001',
  'a1000001-0001-4001-8001-000000000002',
  'a1000001-0001-4001-8001-000000000003',
  'a1000001-0001-4001-8001-000000000004',
  'a1000001-0001-4001-8001-000000000005',
  'a1000001-0001-4001-8001-000000000006'
);

INSERT INTO fixed_savings_plans (id, name, rate, min_days, max_days, min_amount, max_amount, status, sort_order)
VALUES
  ('b2000001-0001-4001-8001-000000000001', '1 Week', 20.000, 7, 7, 2000, 5000000, 'active', 1),
  ('b2000001-0001-4001-8001-000000000002', '1 Month', 30.000, 30, 30, 5000, 5000000, 'active', 2),
  ('b2000001-0001-4001-8001-000000000003', '3 Months', 50.000, 90, 90, 10000, 5000000, 'active', 3),
  ('b2000001-0001-4001-8001-000000000004', '6 Months', 80.000, 180, 180, 15000, 5000000, 'active', 4),
  ('b2000001-0001-4001-8001-000000000005', '1 Year', 120.000, 365, 365, 20000, 5000000, 'active', 5),
  ('b2000001-0001-4001-8001-000000000006', '5 Years', 200.000, 1825, 1825, 30000, 5000000, 'active', 6),
  ('b2000001-0001-4001-8001-000000000007', '10 Years', 300.000, 3650, 3650, 50000, 5000000, 'active', 7)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  rate = EXCLUDED.rate,
  min_days = EXCLUDED.min_days,
  max_days = EXCLUDED.max_days,
  min_amount = EXCLUDED.min_amount,
  max_amount = EXCLUDED.max_amount,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order;
