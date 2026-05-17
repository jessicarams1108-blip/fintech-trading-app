import { pool } from "../db/index.js";
import {
  IDENTITY_TABLE_MIGRATION_HINT,
  KYC_COLUMNS_MIGRATION_HINT,
} from "./pgErrors.js";

export type IdentitySchemaStatus = {
  ready: boolean;
  identityTable: boolean;
  kycColumns: boolean;
  message?: string;
};

export async function getIdentitySchemaStatus(): Promise<IdentitySchemaStatus> {
  try {
    const { rows } = await pool.query<{
      identity_table: string | null;
      kyc_status: string | null;
    }>(
      `SELECT to_regclass('public.identity_verification_submissions')::text AS identity_table,
              (SELECT column_name FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'kyc_status'
               LIMIT 1) AS kyc_status`,
    );
    const row = rows[0];
    const identityTable = Boolean(row?.identity_table);
    const kycColumns = Boolean(row?.kyc_status);
    if (!identityTable) {
      return {
        ready: false,
        identityTable: false,
        kycColumns,
        message: IDENTITY_TABLE_MIGRATION_HINT,
      };
    }
    if (!kycColumns) {
      return {
        ready: false,
        identityTable: true,
        kycColumns: false,
        message: KYC_COLUMNS_MIGRATION_HINT,
      };
    }
    return { ready: true, identityTable: true, kycColumns: true };
  } catch {
    return {
      ready: false,
      identityTable: false,
      kycColumns: false,
      message: "Could not verify database schema for identity verification.",
    };
  }
}
