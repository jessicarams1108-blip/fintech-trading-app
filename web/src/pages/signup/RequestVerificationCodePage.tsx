import { apiFetch } from "@/lib/apiBase";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  PENDING_DEV_VERIFICATION_CODE_KEY,
  PENDING_EMAIL_SESSION_KEY,
  PENDING_USER_ID_KEY,
} from "@/lib/pendingSignup";
import { useToast } from "@/state/ToastContext";

function MailIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function BackIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function RequestVerificationCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const hint = (location.state as { prefilledEmail?: string } | null)?.prefilledEmail?.trim();
    if (hint && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint)) {
      setEmail(hint);
    }
  }, [location.state]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!emailOk || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        userId?: string;
        email?: string;
        devVerificationCode?: string;
      };
      if (!res.ok) {
        showToast(data.error ?? "Could not send code");
        return;
      }
      if (typeof data.userId === "string" && data.userId.length > 0 && typeof data.email === "string") {
        localStorage.setItem(PENDING_USER_ID_KEY, data.userId);
        sessionStorage.setItem(PENDING_EMAIL_SESSION_KEY, data.email);
        if (typeof data.devVerificationCode === "string" && /^\d{6}$/.test(data.devVerificationCode)) {
          sessionStorage.setItem(PENDING_DEV_VERIFICATION_CODE_KEY, data.devVerificationCode);
        } else {
          sessionStorage.removeItem(PENDING_DEV_VERIFICATION_CODE_KEY);
        }
        navigate("/verify", {
          replace: true,
          state: {
            email: data.email,
            ...(typeof data.devVerificationCode === "string" && /^\d{6}$/.test(data.devVerificationCode)
              ? { devVerificationCode: data.devVerificationCode }
              : {}),
          },
        });
        return;
      }
      showToast(data.message ?? "If that email has a pending signup, check your inbox.");
    } catch {
      showToast("Cannot reach server. Is the API running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f4fb] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 pb-10 pt-8 sm:px-8 sm:pt-12">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate("/login")}
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <BackIcon />
        </button>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Get a verification code</h1>
        <p className="mt-2 text-sm text-slate-600">
          If you created an account but did not enter the 6-digit code yet, enter your email and we will send a new
          code. Then you can finish signup and sign in.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="mt-10 block text-sm font-medium text-slate-700">Email address</label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <MailIcon />
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-base outline-none ring-oove-blue/30 focus:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={!emailOk || submitting}
            className="mt-10 w-full rounded-full bg-oove-blue py-3.5 text-base font-semibold text-white shadow-lg shadow-oove-blue/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Sending…" : "Send code"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link to="/login" className="font-semibold text-oove-blue hover:underline">
            Back to sign in
          </Link>
        </p>

        <div className="mt-auto pt-10 text-center">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Back to Oove.com
          </Link>
        </div>
      </div>
    </div>
  );
}
