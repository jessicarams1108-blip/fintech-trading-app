import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";
import { isS3DepositUploadConfigured } from "./depositS3Presign.js";

function safeFileSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document";
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

export function isKycDocumentS3Enabled(): boolean {
  return isS3DepositUploadConfigured();
}

export async function uploadKycDocument(input: {
  userId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}): Promise<string> {
  if (!isKycDocumentS3Enabled()) {
    throw new Error("S3 is not configured");
  }
  const key = `kyc/${input.userId}/${Date.now()}-${safeFileSegment(input.fileName)}`;
  const client = s3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_DEPOSIT_BUCKET!,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
  return key;
}

export async function getKycDocumentViewUrl(storageKey: string): Promise<string | null> {
  if (!isKycDocumentS3Enabled() || storageKey.startsWith("inline:")) {
    return null;
  }
  const client = s3Client();
  const cmd = new GetObjectCommand({
    Bucket: env.S3_DEPOSIT_BUCKET!,
    Key: storageKey,
  });
  return getSignedUrl(client, cmd, { expiresIn: 300 });
}
