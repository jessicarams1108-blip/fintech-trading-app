-- Align plan display names with product tiers (rates + duration ranges)
UPDATE fixed_savings_plans SET name = '7 - 29 Days', rate = 10.000, min_days = 7, max_days = 29, sort_order = 1
  WHERE id = 'a1000001-0001-4001-8001-000000000001';
UPDATE fixed_savings_plans SET name = '30 - 59 Days', rate = 15.000, min_days = 30, max_days = 59, sort_order = 2
  WHERE id = 'a1000001-0001-4001-8001-000000000002';
UPDATE fixed_savings_plans SET name = '60 - 89 Days', rate = 20.000, min_days = 60, max_days = 89, sort_order = 3
  WHERE id = 'a1000001-0001-4001-8001-000000000003';
UPDATE fixed_savings_plans SET name = '90 - 179 Days', rate = 25.000, min_days = 90, max_days = 179, sort_order = 4
  WHERE id = 'a1000001-0001-4001-8001-000000000004';
UPDATE fixed_savings_plans SET name = '180 - 364 Days', rate = 30.000, min_days = 180, max_days = 364, sort_order = 5
  WHERE id = 'a1000001-0001-4001-8001-000000000005';
UPDATE fixed_savings_plans SET name = '365 - 1000 Days', rate = 35.000, min_days = 365, max_days = 1000, sort_order = 6
  WHERE id = 'a1000001-0001-4001-8001-000000000006';
