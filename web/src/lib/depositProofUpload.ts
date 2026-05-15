import { apiFetch } from "@/lib/apiBase";

type Capabilities = { data?: { depositProofUploads?: boolean } };
type PresignBody = {
  data?: { uploadUrl: string; proofKey: string; headers?: Record<string, string> };
  error?: string;
};

/**
 * When S3/R2 is configured on the API, uploads the file via presigned PUT and returns `depositProofKey`.
 * Otherwise returns null so callers can fall back to filename-only proof (dev / legacy).
 */
export async function uploadDepositProofIfConfigured(token: string, file: File): Promise<string | null> {
  const capRes = await apiFetch("/api/deposit/capabilities");
  const cap = (await capRes.json().catch(() => ({}))) as Capabilities;
  if (!cap.data?.depositProofUploads) return null;

  const pres = await apiFetch("/api/deposit/presign", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  });
  const presBody = (await pres.json().catch(() => ({}))) as PresignBody;
  if (!pres.ok) {
    throw new Error(presBody.error ?? "Could not prepare proof upload");
  }
  const uploadUrl = presBody.data?.uploadUrl;
  const proofKey = presBody.data?.proofKey;
  const headers = presBody.data?.headers ?? {};
  if (!uploadUrl || !proofKey) {
    throw new Error("Invalid presign response from server");
  }

  const put = await apiFetch(uploadUrl, { method: "PUT", headers, body: file });
  if (!put.ok) {
    const hint = await put.text().catch(() => "");
    throw new Error(`Proof upload failed (${put.status}) ${hint.slice(0, 160)}`.trim());
  }

  return proofKey;
}
