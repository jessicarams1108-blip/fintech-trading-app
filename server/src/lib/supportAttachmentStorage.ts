import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";
import { isS3DepositUploadConfigured } from "./depositS3Presign.js";

export function isSupportUploadConfigured(): boolean {
  return isS3DepositUploadConfigured();
}

function safeFileSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export function publicUrlForSupportKey(key: string): string {
  const base = env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (!base) throw new Error("S3_PUBLIC_BASE_URL is not configured");
  return `${base}/${key}`;
}

export async function createSupportAttachmentPresignedPut(input: {
  userId: string;
  ticketId: string;
  fileName: string;
  contentType: string;
}): Promise<{ uploadUrl: string; attachmentKey: string; headers: Record<string, string> }> {
  if (!isSupportUploadConfigured()) {
    throw new Error("Support file uploads are not configured on this server");
  }

  const attachmentKey = `support/${input.userId}/${input.ticketId}/${Date.now()}-${safeFileSegment(input.fileName)}`;
  const usePathStyle = Boolean(env.S3_ENDPOINT?.trim());

  const client = new S3Client({
    region: env.S3_REGION!,
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: usePathStyle,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });

  const cmd = new PutObjectCommand({
    Bucket: env.S3_DEPOSIT_BUCKET!,
    Key: attachmentKey,
    ContentType: input.contentType,
  });

  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 120 });
  return {
    uploadUrl,
    attachmentKey,
    headers: { "Content-Type": input.contentType },
  };
}
