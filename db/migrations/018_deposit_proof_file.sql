-- Store deposit proof images on the API database (no S3 required).
ALTER TABLE deposits
  ADD COLUMN IF NOT EXISTS proof_file BYTEA,
  ADD COLUMN IF NOT EXISTS proof_mime TEXT;
