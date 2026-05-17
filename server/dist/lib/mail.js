import { env } from "../env.js";
import { buildVerificationEmailHtml } from "../emails/verification.js";
import { buildDepositConfirmedEmailHtml } from "../emails/depositConfirmed.js";
import { buildAccountChangeEmailHtml } from "../emails/accountChange.js";
import { buildKycApprovedEmailHtml } from "../emails/kycApproved.js";
import { buildKycRejectedEmailHtml } from "../emails/kycRejected.js";
const DEFAULT_FROM = "Oove <onboarding@resend.dev>";
function parseResendError(status, text) {
    const trimmed = text.trim();
    if (!trimmed) {
        return `Resend returned HTTP ${status} (empty response). Check API key and RESEND_FROM_EMAIL.`;
    }
    try {
        const j = JSON.parse(trimmed);
        if (typeof j.message === "string" && j.message.length > 0) {
            return j.message;
        }
    }
    catch {
        /* not JSON */
    }
    return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
}
export function mailFailureMessage(err) {
    if (err instanceof Error && err.message.trim().length > 0) {
        return err.message.trim();
    }
    return "Could not send email";
}
export async function sendVerificationEmail(to, code) {
    const html = buildVerificationEmailHtml({ code });
    if (!env.RESEND_API_KEY) {
        console.warn(`[mail] RESEND_API_KEY not set — verification code for ${to}: ${code}`);
        return;
    }
    const from = (env.RESEND_FROM_EMAIL ?? DEFAULT_FROM).trim();
    let res;
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
    }
    catch (e) {
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
export async function sendDepositConfirmedEmail(to, params) {
    const html = buildDepositConfirmedEmailHtml(params);
    if (!env.RESEND_API_KEY) {
        console.warn(`[mail] RESEND_API_KEY not set — deposit confirmed for ${to} (${params.asset} ${params.amount})`);
        return;
    }
    const from = (env.RESEND_FROM_EMAIL ?? DEFAULT_FROM).trim();
    let res;
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
    }
    catch (e) {
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
const ACCOUNT_CHANGE_SUBJECTS = {
    profile: "Your Oove profile was updated",
    username: "Your Oove username was changed",
    password: "Your Oove password was changed",
};
/** Best-effort security notice; logs and returns without throwing when Resend is unset. */
export async function sendAccountChangeEmail(to, kind) {
    const html = buildAccountChangeEmailHtml({ kind });
    if (!env.RESEND_API_KEY) {
        console.warn(`[mail] RESEND_API_KEY not set — account ${kind} notice for ${to}`);
        return;
    }
    const from = (env.RESEND_FROM_EMAIL ?? DEFAULT_FROM).trim();
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [to],
                subject: ACCOUNT_CHANGE_SUBJECTS[kind],
                html,
            }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("[mail] account change notice failed", res.status, text.slice(0, 600));
        }
    }
    catch (e) {
        console.error("[mail] account change notice network error", e);
    }
}
/** Identity verification approved — best-effort, does not throw when Resend is unset. */
export async function sendKycApprovedEmail(to, params) {
    const html = buildKycApprovedEmailHtml(params);
    if (!env.RESEND_API_KEY) {
        console.warn(`[mail] RESEND_API_KEY not set — KYC approved for ${to} (tier ${params.tier})`);
        return;
    }
    const from = (env.RESEND_FROM_EMAIL ?? DEFAULT_FROM).trim();
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [to],
                subject: "Identity Verification Successful",
                html,
            }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("[mail] KYC approved email failed", res.status, text.slice(0, 600));
        }
    }
    catch (e) {
        console.error("[mail] KYC approved email network error", e);
    }
}
/** Identity verification rejected — best-effort. */
export async function sendKycRejectedEmail(to, params) {
    const html = buildKycRejectedEmailHtml(params);
    if (!env.RESEND_API_KEY) {
        console.warn(`[mail] RESEND_API_KEY not set — KYC rejected for ${to}: ${params.reason}`);
        return;
    }
    const from = (env.RESEND_FROM_EMAIL ?? DEFAULT_FROM).trim();
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [to],
                subject: "Identity Verification Update",
                html,
            }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("[mail] KYC rejected email failed", res.status, text.slice(0, 600));
        }
    }
    catch (e) {
        console.error("[mail] KYC rejected email network error", e);
    }
}
