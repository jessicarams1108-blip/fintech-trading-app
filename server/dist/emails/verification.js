/**
 * Plain HTML email body for verification OTP.
 */
export function buildVerificationEmailHtml(params) {
    const brand = params.brandName ?? "Oove";
    return `<!DOCTYPE html>
<html>
  <body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
    <p>Your ${brand} verification code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:0.2em">${params.code}</p>
    <p style="font-size:14px;color:#64748b">This code expires in a few minutes. If you did not request it, you can ignore this email.</p>
  </body>
</html>`;
}
