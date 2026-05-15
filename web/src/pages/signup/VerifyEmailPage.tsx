import { apiFetch } from "@/lib/apiBase";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";

import { PENDING_DEV_VERIFICATION_CODE_KEY, PENDING_EMAIL_SESSION_KEY, PENDING_USER_ID_KEY } from "@/lib/pendingSignup";

function maskEmail(email: string): string {
  const [local, domain] = email.trim().split("@");
  if (!local || !domain) return email;
  const first = local[0] ?? "";
  return `${first}****@${domain}`;
}

function BackIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applySession } = useAuth();
  const { showToast } = useToast();

  const emailFromState = (location.state as { email?: string } | null)?.email ?? "";
  const emailFromStorage =
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_EMAIL_SESSION_KEY) ?? "" : "";
  const email = emailFromState || emailFromStorage;

  const devFromState = (location.state as { devVerificationCode?: string } | null)?.devVerificationCode;
  const [devShownCode, setDevShownCode] = useState(() => {
    if (typeof window === "undefined") return "";
    const fromSession = sessionStorage.getItem(PENDING_DEV_VERIFICATION_CODE_KEY) ?? "";
    if (devFromState && /^\d{6}$/.test(devFromState)) return devFromState;
    return /^\d{6}$/.test(fromSession) ? fromSession : "";
  });

  const [verifyDigits, setVerifyDigits] = useState(["", "", "", "", "", ""]);
  const [resendSec, setResendSec] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [emailDelivery, setEmailDelivery] = useState<"loading" | "resend" | "console">("loading");
  const verifyRefs = useRef<(HTMLInputElement | null)[]>([]);

  const userId = typeof window !== "undefined" ? localStorage.getItem(PENDING_USER_ID_KEY) : null;

  useEffect(() => {
    void apiFetch("/api/auth/public-config")
      .then((r) => r.json())
      .then((b: { data?: { emailDelivery?: string } }) => {
        const d = b.data?.emailDelivery;
        if (d === "resend") {
          sessionStorage.removeItem(PENDING_DEV_VERIFICATION_CODE_KEY);
          setDevShownCode("");
        }
        setEmailDelivery(d === "resend" ? "resend" : "console");
      })
      .catch(() => setEmailDelivery("console"));
  }, []);

  useEffect(() => {
    if (!userId || !email) {
      navigate("/signup", { replace: true });
      return;
    }
  }, [userId, email, navigate]);

  useEffect(() => {
    if (devFromState && /^\d{6}$/.test(devFromState)) {
      sessionStorage.setItem(PENDING_DEV_VERIFICATION_CODE_KEY, devFromState);
      setDevShownCode(devFromState);
    }
  }, [devFromState]);

  useEffect(() => {
    if (resendSec <= 0) return;
    const t = window.setInterval(() => setResendSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [resendSec]);

  const codeStr = verifyDigits.join("");
  const codeOk = /^\d{6}$/.test(codeStr);

  const setDigit = (i: number, val: string) => {
    const d = val.replace(/\D/g, "").slice(-1);
    setVerifyDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 5) verifyRefs.current[i + 1]?.focus();
  };

  const onDigitKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !verifyDigits[i] && i > 0) verifyRefs.current[i - 1]?.focus();
  };

  const onPasteVerify = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const arr = text.split("");
    setVerifyDigits((prev) => {
      const next = [...prev];
      for (let j = 0; j < 6; j++) next[j] = arr[j] ?? "";
      return next;
    });
    const last = Math.min(text.length, 5);
    verifyRefs.current[last]?.focus();
  };

  const resend = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        devVerificationCode?: string;
      };
      if (!res.ok) {
        showToast(data.error ?? "Could not resend code");
        return;
      }
      setResendSec(60);
      setVerifyDigits(["", "", "", "", "", ""]);
      verifyRefs.current[0]?.focus();
      if (typeof data.devVerificationCode === "string" && /^\d{6}$/.test(data.devVerificationCode)) {
        sessionStorage.setItem(PENDING_DEV_VERIFICATION_CODE_KEY, data.devVerificationCode);
        setDevShownCode(data.devVerificationCode);
      }
      showToast("New code sent");
    } catch {
      showToast("Network error — try again");
    }
  }, [userId, showToast]);

  const verify = useCallback(async () => {
    if (!userId || !codeOk) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: codeStr }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        token?: string;
        user?: { id: string; email: string };
      };
      if (!res.ok) {
        showToast(data.error ?? "Verification failed");
        return;
      }
      if (!data.token || !data.user) {
        showToast("Invalid server response");
        return;
      }
      localStorage.removeItem(PENDING_USER_ID_KEY);
      sessionStorage.removeItem(PENDING_EMAIL_SESSION_KEY);
      sessionStorage.removeItem(PENDING_DEV_VERIFICATION_CODE_KEY);
      applySession(data.token, data.user);
      navigate("/dashboard", { replace: true, state: { welcomeSignup: true } });
    } catch {
      showToast("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  }, [userId, codeOk, codeStr, applySession, navigate, showToast]);

  if (!userId || !email) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f4f4fb] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 pb-10 pt-8 sm:px-8 sm:pt-12">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate("/signup")}
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <BackIcon />
        </button>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Verify your email</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          We sent a 6-digit code to <span className="font-medium text-slate-900">{maskEmail(email)}</span>. Please enter
          it below.
        </p>

        {emailDelivery === "resend" ? (
          <div
            className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            role="status"
          >
            <p className="font-semibold">Check your inbox</p>
            <p className="mt-1 text-emerald-900/90">
              The code was sent by email. If you do not see it within a minute, check spam and promotions folders.
            </p>
          </div>
        ) : null}

        {emailDelivery === "console" && devShownCode ? (
          <div
            className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-semibold">Email delivery is off in this environment</p>
            <p className="mt-1 text-amber-900/90">
              Use this code to continue:{" "}
              <span className="font-mono text-base font-bold tracking-widest text-amber-950">{devShownCode}</span>
            </p>
            <p className="mt-2 text-xs text-amber-800/80">
              When <code className="rounded bg-amber-100/80 px-1">RESEND_API_KEY</code> is set on the server, codes are
              sent by email instead.
            </p>
          </div>
        ) : null}

        <div className="mt-10 flex justify-center gap-2 sm:gap-3" onPaste={onPasteVerify}>
          {verifyDigits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                verifyRefs.current[i] = el;
              }}
              inputMode="numeric"
              maxLength={1}
              autoFocus={i === 0}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onDigitKeyDown(i, e)}
              className="h-12 w-10 rounded-lg border border-slate-200 bg-white text-center text-lg font-semibold outline-none ring-oove-blue/30 focus:ring-2 sm:h-14 sm:w-12"
            />
          ))}
        </div>

        <div className="mt-6 text-center text-sm">
          {resendSec > 0 ? (
            <span className="text-slate-500">Resend code in {resendSec}s</span>
          ) : (
            <button type="button" className="font-semibold text-oove-blue hover:underline" onClick={resend}>
              Resend code
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={!codeOk || submitting}
          onClick={verify}
          className="mt-10 w-full rounded-full bg-oove-blue py-3.5 text-base font-semibold text-white shadow-lg shadow-oove-blue/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Verifying…" : "Verify"}
        </button>

        <div className="mt-auto pt-10 text-center">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Back to Oove.com
          </Link>
        </div>
      </div>
    </div>
  );
}
