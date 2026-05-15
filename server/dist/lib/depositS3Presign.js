import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";
export function isS3DepositUploadConfigured() {
    return Boolean(env.S3_DEPOSIT_BUCKET &&
        env.S3_REGION &&
        env.S3_ACCESS_KEY_ID &&
        env.S3_SECRET_ACCESS_KEY &&
        env.S3_PUBLIC_BASE_URL);
}
function safeFileSegment(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "proof";
}
export async function createDepositProofPresignedPut(input) {
    if (!isS3DepositUploadConfigured()) {
        throw new Error("Deposit proof uploads are not configured on this server");
    }
    const proofKey = `deposits/${input.userId}/${Date.now()}-${safeFileSegment(input.fileName)}`;
    const usePathStyle = Boolean(env.S3_ENDPOINT?.trim());
    const client = new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT?.trim() || undefined,
        forcePathStyle: usePathStyle,
        credentials: {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
    });
    const cmd = new PutObjectCommand({
        Bucket: env.S3_DEPOSIT_BUCKET,
        Key: proofKey,
        ContentType: input.contentType,
    });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 120 });
    return {
        uploadUrl,
        proofKey,
        headers: { "Content-Type": input.contentType },
    };
}
