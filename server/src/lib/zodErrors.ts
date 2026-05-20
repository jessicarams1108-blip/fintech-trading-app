/** Turn Zod flatten() output into a single user-facing string for API responses. */
export function zodFlattenToMessage(flat: {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
}): string {
  const parts: string[] = [...flat.formErrors];
  for (const [field, messages] of Object.entries(flat.fieldErrors)) {
    if (messages?.length) {
      parts.push(`${field}: ${messages.join(", ")}`);
    }
  }
  return parts.join(" ").trim() || "Invalid request";
}
