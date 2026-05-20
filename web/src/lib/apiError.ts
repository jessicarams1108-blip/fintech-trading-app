type ZodFlatten = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

function messageFromZodFlatten(flat: ZodFlatten): string | null {
  const parts: string[] = [...(flat.formErrors ?? [])];
  for (const [field, messages] of Object.entries(flat.fieldErrors ?? {})) {
    if (messages?.length) parts.push(`${field}: ${messages.join(", ")}`);
  }
  const joined = parts.join(" ").trim();
  return joined.length > 0 ? joined : null;
}

/** Extract a human-readable error from API JSON bodies (string, Zod flatten, rate limits). */
export function parseApiError(body: unknown, fallback: string, status?: number): string {
  if (body && typeof body === "object") {
    const record = body as {
      error?: unknown;
      message?: unknown;
      detail?: unknown;
    };

    if (typeof record.error === "string" && record.error.length > 0) {
      if (record.error === "Internal server error" && typeof record.detail === "string") {
        return record.detail;
      }
      return record.error;
    }

    if (record.error && typeof record.error === "object") {
      const zodMsg = messageFromZodFlatten(record.error as ZodFlatten);
      if (zodMsg) return zodMsg;
    }

    if (typeof record.message === "string" && record.message.length > 0) {
      return record.message;
    }
  }

  if (status === 429) return "Too many deposit attempts. Wait a few minutes and try again.";
  if (status === 503) return "Deposit service is temporarily unavailable. Try again shortly.";
  return fallback;
}
