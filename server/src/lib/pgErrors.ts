/** PostgreSQL undefined_column */
export function isPgUndefinedColumn(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42703";
}

/** undefined_table */
export function isPgUndefinedTable(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";
}

/** check_violation (e.g. wallets.currency CHECK) */
export function isPgCheckViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23514";
}
