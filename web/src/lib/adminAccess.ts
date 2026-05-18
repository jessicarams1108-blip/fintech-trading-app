const DEFAULT_ADMINS = ["Hardewusi@gmail.com", "sheiserishadanyellejohnson@gmail.com"];

export function listAdminEmails(): string[] {
  const raw =
    import.meta.env.VITE_ADMIN_EMAILS?.trim() ||
    import.meta.env.VITE_ADMIN_PRIMARY_EMAIL?.trim() ||
    DEFAULT_ADMINS.join(",");
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return emails.length > 0 ? [...new Set(emails)] : DEFAULT_ADMINS.map((e) => e.toLowerCase());
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return listAdminEmails().includes(email.trim().toLowerCase());
}
