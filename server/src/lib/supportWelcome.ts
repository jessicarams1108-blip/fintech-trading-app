export function supportDisplayName(input: {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  const user = input.username?.trim();
  if (user) return user.toUpperCase();
  const full = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  if (full) return full.toUpperCase();
  const local = input.email.split("@")[0]?.trim();
  if (local) return local.toUpperCase();
  return "THERE";
}

export function buildSupportWelcomeMessage(displayName: string, email: string): string {
  return [
    `Hi ${displayName}, Welcome to Theoove Support. Thanks for reaching out.`,
    "",
    "How can we help you today?",
    "",
    "Tell us what's going on and we'll take it from there.",
    "",
    "To help you faster, please include:",
    `1. Your account email (${email})`,
    "2. The issue or request",
    "3. Any screenshots or transaction IDs",
  ].join("\n");
}
