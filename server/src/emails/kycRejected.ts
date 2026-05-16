export function buildKycRejectedEmailHtml(params: { reason: string }): string {
  const reason = params.reason.trim() || "We could not verify the information provided.";
  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
  <h1 style="font-size:20px">Identity Verification Update</h1>
  <p>We reviewed your identity verification submission and could not approve it at this time.</p>
  <p><strong>Reason:</strong> ${reason.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
  <p>You may correct your information and submit a new verification request from your Oove account when ready.</p>
  <p style="color:#64748b;font-size:13px">If you believe this is an error, reply to this email or contact support.</p>
</body>
</html>`;
}
