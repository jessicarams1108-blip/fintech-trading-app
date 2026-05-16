import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/state/AuthContext";
import {
  approveIdentityVerification,
  fetchIdentityDocumentUrl,
  fetchPendingIdentityVerifications,
  rejectIdentityVerification,
  type PendingIdentitySubmission,
} from "@/lib/identityApi";

export function AdminIdentityVerificationsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<PendingIdentitySubmission[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      return;
    }
    setLoadError(null);
    try {
      const data = await fetchPendingIdentityVerifications(token);
      setRows(data);
    } catch (e) {
      setRows([]);
      throw e;
    }
  }, [token]);

  useEffect(() => {
    void load().catch((err: unknown) =>
      setLoadError(err instanceof Error ? err.message : "Unable to load identity verifications"),
    );
  }, [load]);

  async function viewDocument(row: PendingIdentitySubmission) {
    if (!token) return;
    try {
      const url =
        row.idViewUrl && !row.hasInlineDocument
          ? row.idViewUrl
          : await fetchIdentityDocumentUrl(token, row.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not open document");
    }
  }

  async function approve(id: string) {
    if (!token) return;
    const tierStr = window.prompt("Approval tier (1–3)?", "1")?.trim() ?? "";
    const tier = Number.parseInt(tierStr, 10);
    if (!Number.isFinite(tier) || tier < 1 || tier > 3) {
      alert("Tier must be 1, 2, or 3");
      return;
    }
    setBusyId(id);
    try {
      await approveIdentityVerification(token, id, tier);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (!token) return;
    const reason = window.prompt("Rejection reason (required)?")?.trim() ?? "";
    if (reason.length < 3) {
      alert("Rejection reason is required (min 3 characters)");
      return;
    }
    setBusyId(id);
    try {
      await rejectIdentityVerification(token, id, reason);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!token) {
    return <p className="text-sm text-slate-600">Sign in as administrator to review identity verifications.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-500">Operations</p>
        <h1 className="text-3xl font-semibold text-slate-900">Identity verifications</h1>
        <p className="mt-2 text-sm text-slate-600">Pending submissions awaiting approve or reject.</p>
      </div>

      {loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
      ) : null}

      {rows.length === 0 && !loadError ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
          No pending identity verifications.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{row.userName || row.userEmail}</p>
                  <p className="text-sm text-slate-600">{row.userEmail}</p>
                  {row.username ? <p className="text-xs text-slate-500">@{row.username}</p> : null}
                </div>
                <p className="text-xs text-slate-500">
                  Submitted {new Date(row.submittedAt).toLocaleString()}
                </p>
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-medium text-slate-900">{row.phone}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">SSN (last 4)</dt>
                  <dd className="font-mono font-medium text-slate-900">{row.ssnLast4}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Address</dt>
                  <dd className="font-medium text-slate-900">{row.address}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">ID type</dt>
                  <dd className="capitalize font-medium text-slate-900">{row.idDocType.replace(/_/g, " ")}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Registered email</dt>
                  <dd className="font-medium text-slate-900">{row.email}</dd>
                </div>
              </dl>

              {Object.keys(row.vendorFields).length > 0 ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Additional KYC fields</p>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(row.vendorFields).map(([k, v]) => (
                      <li key={k}>
                        <span className="font-medium">{k}:</span> {String(v)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => void viewDocument(row)}
                >
                  View ID document
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
                  onClick={() => void approve(row.id)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50"
                  onClick={() => void reject(row.id)}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
