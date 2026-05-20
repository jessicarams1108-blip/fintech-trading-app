import { apiFetch } from "@/lib/apiBase";
import { parseApiError } from "@/lib/apiError";

type Capabilities = { data?: { depositProofUploads?: boolean } };
type PresignBody = {
  data?: { uploadUrl: string; proofKey: string; headers?: Record<string, string> };
  error?: string;
};

/**
 * When S3/R2 is configured on the API, uploads the file via presigned PUT and returns `depositProofKey`.
 * On upload failure, returns null so callers can still submit with `screenshotFileName` (ops review).
 */
export async function uploadDepositProofIfConfigured(token: string, file: File): Promise<string | null> {
  const capRes = await apiFetch("/api/deposit/capabilities");
  const cap = (await capRes.json().catch(() => ({}))) as Capabilities;
  if (!cap.data?.depositProofUploads) return null;

  try {
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
      throw new Error(parseApiError(presBody, "Could not prepare proof upload", pres.status));
    }
    const uploadUrl = presBody.data?.uploadUrl;
    const proofKey = presBody.data?.proofKey;
    const headers = presBody.data?.headers ?? {};
    if (!uploadUrl || !proofKey) {
      throw new Error("Invalid presign response from server");
    }

    const put = await fetch(uploadUrl, { method: "PUT", headers, body: file });
    if (!put.ok) {
      const hint = await put.text().catch(() => "");
      throw new Error(`Proof upload failed (${put.status}) ${hint.slice(0, 160)}`.trim());
    }

    return proofKey;
  } catch {
    return null;
  }
}
