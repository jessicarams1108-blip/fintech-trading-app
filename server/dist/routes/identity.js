import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateRequired } from "../middleware/auth.js";
import { getUserKyc } from "../db/queries/liquidity.js";
import { findUserById } from "../db/queries/users.js";
import { pool } from "../db/index.js";
import { createIdentitySubmissionAndMarkPending, getLatestSubmissionForUser, resolveEffectiveVerificationState, } from "../db/queries/identityVerification.js";
import { getIdentitySchemaStatus } from "../lib/dbSchema.js";
import { isKycDocumentS3Enabled, uploadKycDocument } from "../lib/kycDocumentStorage.js";
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false });
const idDocTypes = ["passport", "drivers_license", "national_id"];
const submitSchema = z.object({
    idDocType: z.enum(idDocTypes),
    idFileName: z.string().min(1).max(200),
    idContentType: z.string().min(3).max(120),
    idFileBase64: z.string().min(32).max(8_000_000),
    ssnLast4: z.string().regex(/^\d{4}$/, "SSN last 4 must be exactly 4 digits"),
    phoneCountryCode: z.string().min(1).max(6),
    phoneNumber: z.string().min(4).max(24),
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    stateProvince: z.string().min(1).max(100),
    postalCode: z.string().min(2).max(20),
    country: z.string().min(2).max(100),
    dateOfBirth: z.string().min(4).max(32).optional(),
    nationality: z.string().min(2).max(80).optional(),
    occupation: z.string().min(2).max(120).optional(),
    sourceOfFunds: z.string().min(2).max(200).optional(),
});
export const identityRouter = Router();
identityRouter.use(authenticateRequired);
identityRouter.get("/status", limiter, async (req, res, next) => {
    try {
        const userId = req.user.id;
        let kyc = { kyc_status: "unverified", kyc_tier: 0 };
        try {
            kyc = await getUserKyc(userId);
        }
        catch {
            /* safe defaults */
        }
        const user = await findUserById(userId);
        let submission = null;
        try {
            submission = await getLatestSubmissionForUser(userId);
        }
        catch {
            /* table may be missing */
        }
        let docs = [];
        try {
            const { rows } = await pool.query(`SELECT doc_type, status, created_at FROM verification_documents
         WHERE user_id = $1::uuid ORDER BY created_at DESC LIMIT 20`, [userId]);
            docs = rows.map((r) => ({
                docType: r.doc_type,
                status: r.status,
                createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
            }));
        }
        catch {
            /* optional */
        }
        res.json({
            data: {
                kycStatus: kyc.kyc_status,
                kycTier: kyc.kyc_tier,
                verificationState: resolveEffectiveVerificationState(kyc.kyc_status, submission),
                email: user?.email ?? req.user.email,
                documents: docs,
                latestSubmission: submission
                    ? {
                        id: submission.id,
                        status: submission.status,
                        rejectionReason: submission.rejection_reason,
                        submittedAt: submission.created_at instanceof Date
                            ? submission.created_at.toISOString()
                            : String(submission.created_at),
                    }
                    : null,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
identityRouter.post("/submit", limiter, async (req, res, next) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: "Invalid verification data", details: parsed.error.flatten() });
        return;
    }
    try {
        const schema = await getIdentitySchemaStatus();
        if (!schema.ready) {
            res.status(503).json({
                error: schema.message ?? "Identity verification database is not ready.",
            });
            return;
        }
        const userId = req.user.id;
        const kyc = await getUserKyc(userId);
        if (kyc.kyc_status === "verified") {
            res.status(400).json({ error: "Identity is already verified." });
            return;
        }
        const existingSubmission = await getLatestSubmissionForUser(userId);
        if (kyc.kyc_status === "pending" && existingSubmission?.status === "pending") {
            res.status(409).json({ error: "A verification request is already pending review." });
            return;
        }
        const user = await findUserById(userId);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        let fileBuffer;
        try {
            fileBuffer = Buffer.from(parsed.data.idFileBase64, "base64");
        }
        catch {
            res.status(422).json({ error: "Invalid ID document encoding" });
            return;
        }
        if (fileBuffer.length < 32 || fileBuffer.length > 6 * 1024 * 1024) {
            res.status(422).json({ error: "ID document must be between 32 bytes and 6 MB" });
            return;
        }
        const vendorFields = {};
        if (parsed.data.dateOfBirth)
            vendorFields.dateOfBirth = parsed.data.dateOfBirth;
        if (parsed.data.nationality)
            vendorFields.nationality = parsed.data.nationality;
        if (parsed.data.occupation)
            vendorFields.occupation = parsed.data.occupation;
        if (parsed.data.sourceOfFunds)
            vendorFields.sourceOfFunds = parsed.data.sourceOfFunds;
        let idStorageKey;
        let idDocumentBase64 = null;
        if (isKycDocumentS3Enabled()) {
            idStorageKey = await uploadKycDocument({
                userId,
                fileName: parsed.data.idFileName,
                contentType: parsed.data.idContentType,
                body: fileBuffer,
            });
        }
        else {
            idStorageKey = `inline:${userId}:${Date.now()}`;
            idDocumentBase64 = parsed.data.idFileBase64;
        }
        const submission = await createIdentitySubmissionAndMarkPending({
            userId,
            idDocType: parsed.data.idDocType,
            idStorageKey,
            idContentType: parsed.data.idContentType,
            idFileName: parsed.data.idFileName,
            idDocumentBase64,
            ssnLast4: parsed.data.ssnLast4,
            phoneCountryCode: parsed.data.phoneCountryCode,
            phoneNumber: parsed.data.phoneNumber,
            email: user.email,
            street: parsed.data.street,
            city: parsed.data.city,
            stateProvince: parsed.data.stateProvince,
            postalCode: parsed.data.postalCode,
            country: parsed.data.country,
            vendorFields,
        });
        try {
            await pool.query(`INSERT INTO verification_documents (user_id, doc_type, storage_key, status)
         VALUES ($1::uuid, $2::text, $3::text, 'pending_review')`, [userId, parsed.data.idDocType, idStorageKey]);
        }
        catch {
            /* optional table */
        }
        res.status(201).json({
            data: {
                ok: true,
                message: "Verification submitted. We'll notify you once it's complete.",
                verificationState: "pending",
                kycStatus: "pending",
                submissionId: submission.id,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
/** Legacy metadata-only upload — kept for compatibility. */
identityRouter.post("/upload", limiter, async (req, res) => {
    const schema = z.object({ docType: z.string().min(2).max(40), fileName: z.string().min(2).max(200) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: parsed.error.flatten() });
        return;
    }
    const key = `legacy/${req.user.id}/${Date.now()}_${parsed.data.fileName}`;
    res.json({
        data: {
            uploadUrl: null,
            storageKey: key,
            note: "Use POST /api/identity/submit with the full verification form and ID file.",
        },
    });
});
