import { apiFetch } from "@/lib/apiBase";

export type VerificationState = "unverified" | "pending" | "approved" | "rejected";

export type IdentityStatusDto = {
  kycStatus: string;
  kycTier: number;
  verificationState: VerificationState;
  email: string;
  latestSubmission: {
    id: string;
    status: string;
    rejectionReason: string | null;
    submittedAt: string;
  } | null;
};

export type IdentitySubmitPayload = {
  idDocType: "passport" | "drivers_license" | "national_id";
  idFileName: string;
  idContentType: string;
  idFileBase64: string;
  ssnLast4: string;
  phoneCountryCode: string;
  phoneNumber: string;
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  dateOfBirth?: string;
  nationality?: string;
  occupation?: string;
  sourceOfFunds?: string;
};

export type PendingIdentitySubmission = {
  id: string;
  userId: string;
  status: string;
  userEmail: string;
  userName: string;
  username: string | null;
  phone: string;
  ssnLast4: string;
  address: string;
  email: string;
  idDocType: string;
  idFileName: string | null;
  vendorFields: Record<string, unknown>;
  submittedAt: string;
  hasInlineDocument: boolean;
  idViewUrl: string | null;
};

function parseError(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string" && err.length > 0) return err;
  }
  return fallback;
}

export async function fetchIdentityStatus(token: string): Promise<IdentityStatusDto> {
  const res = await apiFetch("/api/identity/status", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: IdentityStatusDto; error?: string };
  if (!res.ok) throw new Error(parseError(body, res.statusText));
  if (!body.data) throw new Error("Invalid identity status response");
  return body.data;
}

export async function submitIdentityVerification(
  token: string,
  payload: IdentitySubmitPayload,
): Promise<{ message: string; verificationState: VerificationState }> {
  const res = await apiFetch("/api/identity/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { message?: string; verificationState?: VerificationState };
    error?: string;
  };
  if (!res.ok) throw new Error(parseError(body, res.statusText));
  return {
    message: body.data?.message ?? "Verification submitted.",
    verificationState: body.data?.verificationState ?? "pending",
  };
}

export async function fetchPendingIdentityVerifications(token: string): Promise<PendingIdentitySubmission[]> {
  const res = await apiFetch("/api/admin/identity-verifications/pending", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: PendingIdentitySubmission[]; error?: string };
  if (!res.ok) throw new Error(parseError(body, res.statusText));
  return body.data ?? [];
}

export async function fetchIdentityDocumentUrl(token: string, submissionId: string): Promise<string> {
  const res = await apiFetch(`/api/admin/identity-verifications/${submissionId}/document`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { url?: string }; error?: string };
  if (!res.ok) throw new Error(parseError(body, res.statusText));
  if (!body.data?.url) throw new Error("Document URL missing");
  return body.data.url;
}

export async function approveIdentityVerification(
  token: string,
  submissionId: string,
  tier?: number,
): Promise<void> {
  const res = await apiFetch(`/api/admin/identity-verifications/${submissionId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tier != null ? { tier } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(body, res.statusText));
}

export async function rejectIdentityVerification(
  token: string,
  submissionId: string,
  reason: string,
): Promise<void> {
  const res = await apiFetch(`/api/admin/identity-verifications/${submissionId}/reject`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(body, res.statusText));
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const base64 = result.includes(",") ? (result.split(",")[1] ?? "") : result;
      if (!base64) {
        reject(new Error("Could not read file"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
