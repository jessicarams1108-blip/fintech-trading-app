-- Tiered minimum deposit per fixed-return plan (1 Week unchanged at $2,000).

UPDATE fixed_savings_plans SET min_amount = 2000
WHERE id = 'b2000001-0001-4001-8001-000000000001';

UPDATE fixed_savings_plans SET min_amount = 5000
WHERE id = 'b2000001-0001-4001-8001-000000000002';

UPDATE fixed_savings_plans SET min_amount = 10000
WHERE id = 'b2000001-0001-4001-8001-000000000003';

UPDATE fixed_savings_plans SET min_amount = 15000
WHERE id = 'b2000001-0001-4001-8001-000000000004';

UPDATE fixed_savings_plans SET min_amount = 20000
WHERE id = 'b2000001-0001-4001-8001-000000000005';

UPDATE fixed_savings_plans SET min_amount = 30000
WHERE id = 'b2000001-0001-4001-8001-000000000006';

UPDATE fixed_savings_plans SET min_amount = 50000
WHERE id = 'b2000001-0001-4001-8001-000000000007';
