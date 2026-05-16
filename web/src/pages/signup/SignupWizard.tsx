import { apiFetch } from "@/lib/apiBase";
import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PENDING_DEV_VERIFICATION_CODE_KEY,
  PENDING_EMAIL_SESSION_KEY,
  PENDING_USER_ID_KEY,
} from "@/lib/pendingSignup";
import { saveRegisteredProfile } from "@/lib/registeredProfile";
import { useToast } from "@/state/ToastContext";

type Step = "email" | "password" | "details" | "terms";

type FormState = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  age: string;
  username: string;
  termsAccepted: boolean;
};

const initialForm: FormState = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  age: "",
  username: "",
  termsAccepted: false,
};

function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(3, score) as 0 | 1 | 2 | 3;
}

function strengthLabel(s: 0 | 1 | 2 | 3): string {
  if (s <= 0) return "Weak";
  if (s === 1) return "Weak";
  if (s === 2) return "Medium";
  return "Strong";
}

async function checkUsernameAvailable(username: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return Boolean(data.available);
  } catch {
    return false;
  }
}

function registerErrorMessage(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error: unknown }).error;
    if (typeof e === "string") return e;
  }
  return "Registration failed";
}

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

export function SignupWizard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [form, setForm] = useState<FormState>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "ok" | "taken" | "short">("idle");
  const [registering, setRegistering] = useState(false);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const pwd = form.password;
  const pwdScore = passwordStrength(pwd);
  const pwdOk = pwdScore >= 2 && pwd.length >= 8;
  const ageNum = Number.parseInt(form.age, 10);
  const ageOk = Number.isFinite(ageNum) && ageNum >= 18;
  const detailsOk =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    ageOk &&
    form.username.trim().length >= 3 &&
    usernameStatus === "ok";

  const onUsernameBlur = useCallback(async () => {
    const u = form.username.trim();
    if (u.length < 3) {
      setUsernameStatus("short");
      return;
    }
    setUsernameStatus("checking");
    const ok = await checkUsernameAvailable(u);
    setUsernameStatus(ok ? "ok" : "taken");
  }, [form.username]);

  const submitRegister = useCallback(async () => {
    if (!form.termsAccepted || registering) return;
    setRegistering(true);
    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          age: ageNum,
          username: form.username.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(registerErrorMessage(data));
        return;
      }
      const payload = data as { userId?: string; devVerificationCode?: string };
      const userId = payload.userId;
      if (!userId) {
        showToast("Invalid response from server");
        return;
      }
      localStorage.setItem(PENDING_USER_ID_KEY, userId);
      saveRegisteredProfile(userId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      });
      sessionStorage.setItem(PENDING_EMAIL_SESSION_KEY, form.email.trim());
      if (typeof payload.devVerificationCode === "string" && /^\d{6}$/.test(payload.devVerificationCode)) {
        sessionStorage.setItem(PENDING_DEV_VERIFICATION_CODE_KEY, payload.devVerificationCode);
      } else {
        sessionStorage.removeItem(PENDING_DEV_VERIFICATION_CODE_KEY);
      }
      navigate("/verify", {
        state: {
          email: form.email.trim(),
          ...(typeof payload.devVerificationCode === "string" && /^\d{6}$/.test(payload.devVerificationCode)
            ? { devVerificationCode: payload.devVerificationCode }
            : {}),
        },
      });
    } catch {
      showToast("Cannot reach server. Is the API running?");
    } finally {
      setRegistering(false);
    }
  }, [form, ageNum, registering, navigate, showToast]);

  return (
    <div className="min-h-screen bg-[#f4f4fb] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 pb-10 pt-8 sm:px-8 sm:pt-12">
        {step !== "email" && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => {
              if (step === "password") setStep("email");
              else if (step === "details") setStep("password");
              else if (step === "terms") setStep("details");
            }}
            className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <BackIcon />
          </button>
        )}

        {step === "email" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create your Oove account</h1>
            <p className="mt-2 text-sm text-slate-600">Use your email to get started.</p>
            <label className="mt-10 block text-sm font-medium text-slate-700">Email address</label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <MailIcon />
              </span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-base outline-none ring-oove-blue/30 focus:ring-2"
              />
            </div>
            <button
              type="button"
              disabled={!emailOk}
              onClick={() => setStep("password")}
              className="mt-8 w-full rounded-full bg-oove-blue py-3.5 text-base font-semibold text-white shadow-lg shadow-oove-blue/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-oove-blue hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}

        {step === "password" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create a secure password</h1>
            <label className="mt-10 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative mt-2 flex">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-4 pr-24 text-base outline-none ring-oove-blue/30 focus:ring-2"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-sm font-medium text-oove-blue hover:bg-oove-blue/10"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="mt-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      pwdScore > i ? (pwdScore >= 3 ? "bg-emerald-500" : pwdScore === 2 ? "bg-amber-400" : "bg-red-400") : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-600">
                Strength: <span className="text-slate-900">{strengthLabel(pwdScore)}</span>
              </p>
            </div>
            <button
              type="button"
              disabled={!pwdOk}
              onClick={() => setStep("details")}
              className="mt-10 w-full rounded-full bg-oove-blue py-3.5 text-base font-semibold text-white shadow-lg shadow-oove-blue/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </>
        )}

        {step === "details" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tell us about you</h1>
            <p className="mt-2 text-sm text-slate-600">We use this to personalize your account.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="text-sm font-medium text-slate-700">First name</label>
                <input
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-oove-blue/30 focus:ring-2"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="text-sm font-medium text-slate-700">Last name</label>
                <input
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-oove-blue/30 focus:ring-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Age</label>
                <input
                  inputMode="numeric"
                  value={form.age}
                  onChange={(e) => update("age", e.target.value.replace(/\D/g, ""))}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-oove-blue/30 focus:ring-2"
                />
                {form.age.length > 0 && !ageOk && (
                  <p className="mt-1 text-xs text-red-600">You must be 18 or older.</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Username</label>
                <input
                  value={form.username}
                  onChange={(e) => {
                    update("username", e.target.value);
                    setUsernameStatus("idle");
                  }}
                  onBlur={onUsernameBlur}
                  autoCapitalize="none"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none ring-oove-blue/30 focus:ring-2"
                />
                {usernameStatus === "checking" && <p className="mt-1 text-xs text-slate-500">Checking availability…</p>}
                {usernameStatus === "taken" && <p className="mt-1 text-xs text-red-600">Username is taken.</p>}
                {usernameStatus === "short" && <p className="mt-1 text-xs text-amber-700">At least 3 characters.</p>}
                {usernameStatus === "ok" && <p className="mt-1 text-xs text-emerald-600">Username is available.</p>}
              </div>
            </div>
            <button
              type="button"
              disabled={!detailsOk}
              onClick={() => setStep("terms")}
              className="mt-10 w-full rounded-full bg-oove-blue py-3.5 text-base font-semibold text-white shadow-lg shadow-oove-blue/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </>
        )}

        {step === "terms" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Almost there</h1>
            <p className="mt-2 text-sm text-slate-600">Review and accept our policies.</p>
            <label className="mt-10 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <input
                type="checkbox"
                checked={form.termsAccepted}
                onChange={(e) => update("termsAccepted", e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-oove-blue focus:ring-oove-blue"
              />
              <span className="text-sm leading-relaxed text-slate-700">
                I agree to the{" "}
                <a href="#footer" className="font-semibold text-oove-blue hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#footer" className="font-semibold text-oove-blue hover:underline">
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            <button
              type="button"
              disabled={!form.termsAccepted || registering}
              onClick={submitRegister}
              className="mt-8 w-full rounded-full bg-oove-blue py-3.5 text-base font-semibold text-white shadow-lg shadow-oove-blue/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {registering ? "Creating account…" : "Create Account"}
            </button>
          </>
        )}

        <div className="mt-auto pt-10 text-center">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Back to Oove.com
          </Link>
        </div>
      </div>
    </div>
  );
}
