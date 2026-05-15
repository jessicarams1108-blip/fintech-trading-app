import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";

function MailIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fromState = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
  const from =
    fromState && !["/login", "/signup", "/verify", "/verify/request", "/verify-identity"].includes(fromState)
      ? fromState
      : "/dashboard";

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length > 0;

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f4fb] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 pb-10 pt-8 sm:px-8 sm:pt-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Use the email and password from your Oove account.</p>

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
              placeholder="you@gmail.com"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-base outline-none ring-oove-blue/30 focus:ring-2"
            />
          </div>

          <label className="mt-8 block text-sm font-medium text-slate-700">Password</label>
          <div className="relative mt-2 flex">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
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

          {error ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-red-600">{error}</p>
              {/verify your email/i.test(error) ? (
                <p className="text-sm text-slate-600">
                  <Link
                    to="/verify/request"
                    state={{ prefilledEmail: email.trim() || undefined }}
                    className="font-semibold text-oove-blue hover:underline"
                  >
                    Finish email verification
                  </Link>{" "}
                  — on live site you may see a 6-digit code on screen (no email yet).
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="mt-10 w-full rounded-full bg-oove-blue py-3.5 text-base font-semibold text-white shadow-lg shadow-oove-blue/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="mt-6 text-center text-sm text-slate-600">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-oove-blue hover:underline">
              Create an account
            </Link>
          </p>

          <div className="mt-4 flex flex-row items-center justify-between gap-4">
            <Link
              to="/verify/request"
              state={{ prefilledEmail: email.trim() || undefined }}
              className="shrink-0 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Verify email
            </Link>
            <button
              type="button"
              className="shrink-0 text-sm font-medium text-slate-500 hover:text-slate-800"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-auto pt-10 text-center">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Back to Oove.com
          </Link>
        </div>
      </div>
    </div>
  );
}
