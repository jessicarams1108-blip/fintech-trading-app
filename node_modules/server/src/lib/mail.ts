import { env } from "../env.js";
import { buildVerificationEmailHtml } from "../emails/verification.js";
import { buildDepositConfirmedEmailHtml } from "../emails/depositConfirmed.js";

const DEFAULT_FROM = "Oove <onboarding@resend.dev>";

function parseResendError(status: number, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return `Resend returned HTTP ${status} (empty response). Check API key and RESEND_FROM_EMAIL.`;
  }
  try {
    const j = JSON.parse(trimmed) as { message?: unknown };
    if (typeof j.message === "string" && j.message.length > 0) {
      return j.message;
    }
  } catch {
    /* not JSON */
  }
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
}

export function mailFailureMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message.trim();
  }
  return "Could not send email";
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const html = buildVerificationEmailHtml({ code });

  if (!env.RESEND_API_KEY) {
    console.warn(`[mail] RESEND_API_KEY not set — verification code for ${to}: ${code}`);
    return;
  }

  const from = (env.RESEND_FROM_EMAIL ?? DEFAULT_FROM).trim();

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your Oove verification code",
        html,
      }),
    });
  } catch (e) {
    const net = e instanceof Error ? e.message : String(e);
    console.error("[mail] network error calling Resend", e);
    throw new Error(`Could not reach Resend (${net}). Check outbound HTTPS / firewall.`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const detail = parseResendError(res.status, text);
    console.error("[mail] Resend HTTP", res.status, text.slice(0, 1200));
    throw new Error(detail);
  }
}

export async function sendDepositConfirmedEmail(
  to: string,
  params: { asset: string; amount: string; txHash: string },
): Promise<void> {
  const html = buildDepositConfirmedEmailHtml(params);

  if (!env.RESEND_API_KEY) {
    console.warn(`[mail] RESEND_API_KEY not set — deposit confirmed for ${to} (${params.asset} ${params.amount})`);
    return;
  }

  const from = (env.RESEND_FROM_EMAIL ?? DEFAULT_FROM).trim();

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Your ${params.asset} deposit is confirmed`,
        html,
      }),
    });
  } catch (e) {
    const net = e instanceof Error ? e.message : String(e);
    console.error("[mail] network error calling Resend (deposit)", e);
    throw new Error(`Could not reach Resend (${net}).`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const detail = parseResendError(res.status, text);
    console.error("[mail] Resend HTTP deposit", res.status, text.slice(0, 800));
    throw new Error(detail);
  }
}
