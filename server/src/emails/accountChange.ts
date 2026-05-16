export type AccountChangeKind = "profile" | "username" | "password";

export function buildAccountChangeEmailHtml(params: {
  kind: AccountChangeKind;
  brandName?: string;
}): string {
  const brand = params.brandName ?? "Oove";
  const titles: Record<AccountChangeKind, string> = {
    profile: "Your profile was updated",
    username: "Your username was changed",
    password: "Your password was changed",
  };
  const bodies: Record<AccountChangeKind, string> = {
    profile: "Your display name on your account was updated. If you did not make this change, contact support immediately.",
    username: "Your username was changed. If you did not make this change, contact support immediately.",
    password: "Your sign-in password was changed. If you did not make this change, reset your password or contact support immediately.",
  };
  return `<!DOCTYPE html>
<html>
  <body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
    <p><strong>${titles[params.kind]}</strong></p>
    <p>${bodies[params.kind]}</p>
    <p style="font-size:14px;color:#64748b">This is an automated message from ${brand}.</p>
  </body>
</html>`;
}
