import { apiFetch } from "@/lib/apiBase";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";

type KycStatusResponse = {
  kycStatus: string;
  kycTier: number;
  demoKycEnabled?: boolean;
};

type IdentityBundle = {
  data?: {
    kycStatus: string;
    kycTier: number;
    documents: { docType: string; status: string; createdAt: string }[];
  };
};

export function IdentityVerificationPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<KycStatusResponse | null>(null);
  const [docs, setDocs] = useState<{ docType: string; status: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [kycRes, idRes] = await Promise.all([
        apiFetch("/api/kyc/status", { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch("/api/identity/status", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const kycBody = (await kycRes.json().catch(() => ({}))) as KycStatusResponse & { error?: string };
      if (!kycRes.ok) {
        showToast(kycBody.error ?? "Could not load status");
        setData(null);
        setDocs([]);
        return;
      }
      setData(kycBody);
      const idBody = (await idRes.json().catch(() => ({}))) as IdentityBundle;
      setDocs(idBody.data?.documents ?? []);
    } catch {
      showToast("Network error");
      setData(null);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitApplication() {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/kyc/submit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        showToast(body.error ?? "Submit failed");
        return;
      }
      showToast(body.message ?? "Submitted");
      await load();
    } catch {
      showToast("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function demoVerify(tier: number) {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/kyc/demo-verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        showToast(body.error ?? "Verification failed");
        return;
      }
      showToast(body.message ?? "Verified");
      await load();
    } catch {
      showToast("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Identity verification</h1>
        <p className="mt-3 text-slate-600">
          Oove uses tiered identity checks to size borrow limits ($30,000–$100,000+ depending on tier and
          collateral), similar in spirit to permissioned pools in the broader DeFi ecosystem. Complete verification
          before requesting larger credit lines.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Status</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : data ? (
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 py-2">
              <dt className="text-slate-500">Verification state</dt>
              <dd className="font-medium capitalize text-slate-900">{data.kycStatus}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-slate-500">Tier</dt>
              <dd className="font-medium text-slate-900">{data.kycTier}</dd>
            </div>
          </dl>
        ) : null}

        {docs.length > 0 ? (
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Uploaded documents</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {docs.map((d) => (
                <li key={`${d.docType}-${d.createdAt}`} className="flex justify-between gap-2">
                  <span>{d.docType}</span>
                  <span className="font-medium capitalize">{d.status}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data?.kycStatus === "verified" ? (
          <p className="mt-4 text-sm text-emerald-700">You are verified. Borrow caps follow your tier and supplied collateral.</p>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              Submit a verification request (government ID, proof of address). In production this connects to a KYC
              vendor; here it marks your account as <strong>pending</strong> for review.
            </p>
            <button
              type="button"
              disabled={submitting || data?.kycStatus === "pending"}
              onClick={() => void submitApplication()}
              className="rounded-full bg-oove-blue px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-40"
            >
              {data?.kycStatus === "pending" ? "Review pending" : "Submit verification request"}
            </button>
          </div>
        )}

        {import.meta.env.DEV ? (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Developer</p>
            <p className="mt-2 text-sm text-slate-600">
              When test KYC mode is enabled on the API, you can simulate an approved identity for local testing.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void demoVerify(1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-40"
              >
                Quick verify · Tier 1 ($30k cap)
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void demoVerify(2)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-40"
              >
                Quick verify · Tier 2 ($65k cap)
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void demoVerify(3)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-40"
              >
                Quick verify · Tier 3 ($100k+ cap)
              </button>
            </div>
          </div>
        ) : null}

        <p className="mt-8 text-center text-sm">
          <Link to="/dashboard" className="font-semibold text-oove-blue hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
