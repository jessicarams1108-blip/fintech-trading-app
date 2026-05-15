export function buildDepositConfirmedEmailHtml(params) {
    const brand = params.brandName ?? "Oove";
    return `<!DOCTYPE html>
<html>
  <body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
    <p>Your ${brand} deposit has been <strong>confirmed</strong>.</p>
    <ul style="font-size:15px">
      <li>Asset: <strong>${params.asset}</strong></li>
      <li>Credited amount: <strong>${params.amount}</strong></li>
      <li>Reference tx: <span style="font-family:monospace;font-size:12px">${params.txHash}</span></li>
    </ul>
    <p style="font-size:14px;color:#64748b">You can review this activity in your Oove account history.</p>
  </body>
</html>`;
}
