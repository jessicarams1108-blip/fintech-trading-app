/** PostgreSQL undefined_column */
export function isPgUndefinedColumn(err) {
    return typeof err === "object" && err !== null && err.code === "42703";
}
/** undefined_table */
export function isPgUndefinedTable(err) {
    return typeof err === "object" && err !== null && err.code === "42P01";
}
/** check_violation (e.g. wallets.currency CHECK) */
export function isPgCheckViolation(err) {
    return typeof err === "object" && err !== null && err.code === "23514";
}
export const KYC_COLUMNS_MIGRATION_HINT = "KYC columns are missing on users. From the server folder run: npm run db:sql -- ../db/migrations/003_oove_liquidity_kyc.sql";
export const IDENTITY_TABLE_MIGRATION_HINT = "Identity verification table is missing. From the server folder run: npm run db:sql -- ../db/migrations/007_identity_verification.sql";
export function rethrowPgSchemaError(err) {
    const pgMessage = typeof err === "object" && err !== null && "message" in err
        ? String(err.message ?? "")
        : "";
    if (isPgUndefinedTable(err) || /identity_verification_submissions/i.test(pgMessage)) {
        throw new Error(IDENTITY_TABLE_MIGRATION_HINT);
    }
    if (isPgUndefinedColumn(err)) {
        if (/kyc_status|kyc_tier/i.test(pgMessage)) {
            throw new Error(KYC_COLUMNS_MIGRATION_HINT);
        }
        if (/first_name|last_name|username/i.test(pgMessage)) {
            throw new Error("User profile columns are missing. From the server folder run: npm run db:sql -- ../db/migrations/002_auth_registration.sql");
        }
        throw new Error(KYC_COLUMNS_MIGRATION_HINT);
    }
    throw err;
}
