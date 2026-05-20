import { apiFetch } from "@/lib/apiBase";
import { parseApiError } from "@/lib/apiError";
import { fileToBase64 } from "@/lib/fileToBase64";
import { uploadDepositProofIfConfigured } from "@/lib/depositProofUpload";
import type { AssetSymbol } from "@/types";

export type SubmitDepositProofInput = {
  token: string;
  asset: AssetSymbol;
  declaredAmountUsd: number;
  proofFile: File | null;
};

export async function submitDepositWithProof(input: SubmitDepositProofInput): Promise<string> {
  const { token, asset, declaredAmountUsd, proofFile } = input;
  if (!proofFile) {
    throw new Error("Choose a payment proof file before submitting.");
  }

  let depositProofKey: string | undefined;
  const uploadedKey = await uploadDepositProofIfConfigured(token, proofFile);
  if (uploadedKey) depositProofKey = uploadedKey;

  const proofFileBase64 = await fileToBase64(proofFile);
  const proofMime = proofFile.type || "application/octet-stream";

  const res = await apiFetch("/api/deposit/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      asset,
      declaredAmountUsd,
      proofFileBase64,
      proofMime,
      screenshotFileName: proofFile.name,
      ...(depositProofKey ? { depositProofKey } : {}),
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseApiError(body, "Submission failed", res.status));
  }

  return (body as { data?: { id?: string } }).data?.id ?? "";
}
