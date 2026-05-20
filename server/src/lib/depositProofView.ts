import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

const LEGACY_PLACEHOLDER_HOST = "objects.example.invalid";

export function isS3DepositStorageConfigured(): boolean {
  return Boolean(
    env.S3_DEPOSIT_BUCKET && env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
  );
}

function s3Client(): S3Client {
  const usePathStyle = Boolean(env.S3_ENDPOINT?.trim());
  return new S3Client({
    region: env.S3_REGION!,
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: usePathStyle,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

/** Extract `deposits/{userId}/{file}` from stored proof reference, if present. */
export function extractDepositProofKey(
  proofImageUrl: string | null | undefined,
  userId: string,
): string | null {
  if (!proofImageUrl?.trim()) return null;
  const url = proofImageUrl.trim();

  if (url.startsWith("deposit-key:")) {
    return url.slice("deposit-key:".length);
  }

  const s3Match = /^s3:\/\/[^/]+\/(.+)$/i.exec(url);
  if (s3Match?.[1]) return s3Match[1];

  const publicBase = env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (publicBase && url.startsWith(`${publicBase}/`)) {
    return url.slice(publicBase.length + 1);
  }

  const proofIdx = url.indexOf("deposits/");
  if (proofIdx >= 0) {
    const key = url.slice(proofIdx).split("?")[0]!;
    if (proofKeyBelongsToUser(userId, key)) return key;
  }

  return null;
}

export function proofKeyBelongsToUser(userId: string, key: string): boolean {
  const normalizedKey = key.trim();
  if (normalizedKey.length > 500) return false;
  const match = /^deposits\/([^/]+)\/([^/]+)$/i.exec(normalizedKey);
  if (!match || match[1]!.toLowerCase() !== userId.toLowerCase()) return false;
  const rest = match[2]!;
  if (!rest || rest.includes("..")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(rest);
}

export function isLegacyPlaceholderProof(proofImageUrl: string | null | undefined): boolean {
  if (!proofImageUrl?.trim()) return false;
  const url = proofImageUrl.trim();
  if (url.startsWith("proof://") || url.startsWith("deposit-filename:")) return true;
  try {
    return new URL(url).hostname === LEGACY_PLACEHOLDER_HOST;
  } catch {
    return false;
  }
}

export async function createDepositProofPresignedGet(
  proofKey: string,
): Promise<string> {
  if (!isS3DepositStorageConfigured()) {
    throw new Error("Deposit proof storage is not configured on this server");
  }
  const cmd = new GetObjectCommand({
    Bucket: env.S3_DEPOSIT_BUCKET!,
    Key: proofKey,
  });
  return getSignedUrl(s3Client(), cmd, { expiresIn: 300 });
}

export type DepositProofViewResult =
  | { ok: true; viewUrl: string }
  | { ok: false; error: string };

/** Resolve a viewable URL for admins (presigned GET or public URL). */
export async function resolveDepositProofViewUrl(
  proofImageUrl: string | null | undefined,
  userId: string,
): Promise<DepositProofViewResult> {
  if (!proofImageUrl?.trim()) {
    return { ok: false, error: "No proof file was attached to this deposit." };
  }

  if (isLegacyPlaceholderProof(proofImageUrl)) {
    return {
      ok: false,
      error:
        "This deposit only has a filename on file—the image was not stored in cloud storage. Ask the user to submit again with S3/R2 configured, or request the screenshot by email.",
    };
  }

  const key = extractDepositProofKey(proofImageUrl, userId);
  if (key) {
    if (!isS3DepositStorageConfigured()) {
      const publicBase = env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
      if (publicBase) {
        return { ok: true, viewUrl: `${publicBase}/${key}` };
      }
      return {
        ok: false,
        error: "Proof is stored in object storage but the server is missing S3 credentials for admin viewing.",
      };
    }
    try {
      const viewUrl = await createDepositProofPresignedGet(key);
      return { ok: true, viewUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not sign proof URL";
      return { ok: false, error: msg };
    }
  }

  if (/^https?:\/\//i.test(proofImageUrl)) {
    return { ok: true, viewUrl: proofImageUrl };
  }

  return { ok: false, error: "Proof reference is not a viewable file URL." };
}
