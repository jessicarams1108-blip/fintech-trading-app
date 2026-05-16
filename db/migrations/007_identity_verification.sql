-- Identity verification submissions (KYC form + admin review)
-- Run: npm run db:sql -- db/migrations/007_identity_verification.sql

CREATE TABLE IF NOT EXISTS identity_verification_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  id_doc_type TEXT NOT NULL,
  id_storage_key TEXT NOT NULL,
  id_content_type TEXT,
  id_file_name TEXT,
  id_document_base64 TEXT,
  ssn_last4 TEXT NOT NULL,
  phone_country_code TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  state_province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  vendor_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_verify_user_created
  ON identity_verification_submissions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_identity_verify_pending
  ON identity_verification_submissions (created_at ASC)
  WHERE status = 'pending';
