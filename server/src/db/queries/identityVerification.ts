import { pool } from "../index.js";
import { formatUserFullName } from "./users.js";

export type IdentitySubmissionRow = {
  id: string;
  user_id: string;
  status: string;
  id_doc_type: string;
  id_storage_key: string;
  id_content_type: string | null;
  id_file_name: string | null;
  id_document_base64: string | null;
  ssn_last4: string;
  phone_country_code: string;
  phone_number: string;
  email: string;
  street: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  vendor_fields: Record<string, unknown>;
  rejection_reason: string | null;
  reviewed_at: Date | string | null;
  reviewed_by: string | null;
  created_at: Date | string;
};

export type IdentitySubmissionWithUser = IdentitySubmissionRow & {
  user_email: string;
  user_first_name: string | null;
  user_last_name: string | null;
  user_username: string | null;
};

export async function createIdentitySubmission(input: {
  userId: string;
  idDocType: string;
  idStorageKey: string;
  idContentType: string;
  idFileName: string;
  idDocumentBase64: string | null;
  ssnLast4: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  vendorFields: Record<string, unknown>;
}): Promise<IdentitySubmissionRow> {
  const { rows } = await pool.query<IdentitySubmissionRow>(
    `INSERT INTO identity_verification_submissions (
       user_id, status, id_doc_type, id_storage_key, id_content_type, id_file_name,
       id_document_base64, ssn_last4, phone_country_code, phone_number, email,
       street, city, state_province, postal_code, country, vendor_fields
     ) VALUES (
       $1::uuid, 'pending', $2, $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15, $16::jsonb
     )
     RETURNING *`,
    [
      input.userId,
      input.idDocType,
      input.idStorageKey,
      input.idContentType,
      input.idFileName,
      input.idDocumentBase64,
      input.ssnLast4,
      input.phoneCountryCode,
      input.phoneNumber,
      input.email,
      input.street,
      input.city,
      input.stateProvince,
      input.postalCode,
      input.country,
      JSON.stringify(input.vendorFields),
    ],
  );
  return rows[0]!;
}

export async function getLatestSubmissionForUser(userId: string): Promise<IdentitySubmissionRow | null> {
  const { rows } = await pool.query<IdentitySubmissionRow>(
    `SELECT * FROM identity_verification_submissions
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function listPendingIdentitySubmissions(): Promise<IdentitySubmissionWithUser[]> {
  const { rows } = await pool.query<IdentitySubmissionWithUser>(
    `SELECT s.*,
            u.email AS user_email,
            u.first_name AS user_first_name,
            u.last_name AS user_last_name,
            u.username AS user_username
     FROM identity_verification_submissions s
     JOIN users u ON u.id = s.user_id
     WHERE s.status = 'pending'
     ORDER BY s.created_at ASC`,
  );
  return rows;
}

export async function getIdentitySubmissionById(id: string): Promise<IdentitySubmissionWithUser | null> {
  const { rows } = await pool.query<IdentitySubmissionWithUser>(
    `SELECT s.*,
            u.email AS user_email,
            u.first_name AS user_first_name,
            u.last_name AS user_last_name,
            u.username AS user_username
     FROM identity_verification_submissions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1::uuid
     LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function approveIdentitySubmission(input: {
  submissionId: string;
  reviewerId: string;
  tier: number;
}): Promise<IdentitySubmissionWithUser | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: subRows } = await client.query<IdentitySubmissionRow>(
      `UPDATE identity_verification_submissions
       SET status = 'approved',
           rejection_reason = NULL,
           reviewed_at = now(),
           reviewed_by = $2::uuid
       WHERE id = $1::uuid AND status = 'pending'
       RETURNING *`,
      [input.submissionId, input.reviewerId],
    );
    const sub = subRows[0];
    if (!sub) {
      await client.query("ROLLBACK");
      return null;
    }
    const tier = Math.min(3, Math.max(1, Math.floor(input.tier)));
    await client.query(
      `UPDATE users SET kyc_status = 'verified', kyc_tier = $2::smallint WHERE id = $1::uuid`,
      [sub.user_id, tier],
    );
    await client.query("COMMIT");
    return getIdentitySubmissionById(sub.id);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function rejectIdentitySubmission(input: {
  submissionId: string;
  reviewerId: string;
  reason: string;
}): Promise<IdentitySubmissionWithUser | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: subRows } = await client.query<IdentitySubmissionRow>(
      `UPDATE identity_verification_submissions
       SET status = 'rejected',
           rejection_reason = $3,
           reviewed_at = now(),
           reviewed_by = $2::uuid
       WHERE id = $1::uuid AND status = 'pending'
       RETURNING *`,
      [input.submissionId, input.reviewerId, input.reason],
    );
    const sub = subRows[0];
    if (!sub) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      `UPDATE users SET kyc_status = 'rejected', kyc_tier = 0 WHERE id = $1::uuid`,
      [sub.user_id],
    );
    await client.query("COMMIT");
    return getIdentitySubmissionById(sub.id);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export function submissionUserFullName(row: IdentitySubmissionWithUser): string {
  return formatUserFullName(row.user_first_name, row.user_last_name);
}

export function mapVerificationState(kycStatus: string): string {
  if (kycStatus === "verified") return "approved";
  if (kycStatus === "pending") return "pending";
  if (kycStatus === "rejected") return "rejected";
  return "unverified";
}
