-- User-declared USD equivalent at deposit submission (minimum $100 enforced in API).
ALTER TABLE deposits
  ADD COLUMN IF NOT EXISTS declared_amount_usd NUMERIC(18, 2);
