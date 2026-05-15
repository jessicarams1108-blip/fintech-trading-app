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
