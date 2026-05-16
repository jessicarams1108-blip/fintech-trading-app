export function buildKycApprovedEmailHtml(params: { tier: number }): string {
  const tierLabel =
    params.tier >= 3 ? "$100,000+" : params.tier >= 2 ? "up to $65,000" : "up to $30,000";
  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
  <h1 style="font-size:20px">Identity Verification Successful</h1>
  <p>Your identity verification has been approved. You can now access higher credit lines on Oove based on your tier and collateral.</p>
  <p><strong>Your tier:</strong> Tier ${params.tier} (borrow capacity ${tierLabel} with qualifying collateral).</p>
  <p><strong>Next steps:</strong></p>
  <ul>
    <li>Review your borrow limits on the Borrow page.</li>
    <li>Supply additional collateral if you need a higher line.</li>
    <li>Contact support if you have questions about your tier.</li>
  </ul>
  <p style="color:#64748b;font-size:13px">If you did not request this verification, contact support immediately.</p>
</body>
</html>`;
}
