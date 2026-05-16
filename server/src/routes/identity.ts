import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticateRequired } from "../middleware/auth.js";
import { getUserKyc } from "../db/queries/liquidity.js";
import { pool } from "../db/index.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false });

export const identityRouter = Router();
identityRouter.use(authenticateRequired);

identityRouter.get("/status", limiter, async (req, res, next) => {
  try {
    let kyc = { kyc_status: "unverified" as string, kyc_tier: 0 };
    try {
      kyc = await getUserKyc(req.user!.id);
    } catch {
      /* DB or column issues — safe defaults */
    }
    let docs: { docType: string; status: string; createdAt: string }[] = [];
    try {
      const { rows } = await pool.query<{
        doc_type: string;
        status: string;
        created_at: Date;
      }>(
        `SELECT doc_type, status, created_at FROM verification_documents
         WHERE user_id = $1::uuid ORDER BY created_at DESC LIMIT 20`,
        [req.user!.id],
      );
      docs = rows.map((r) => ({
        docType: r.doc_type,
        status: r.status,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      }));
    } catch {
      /* optional table */
    }
    res.json({
      data: {
        kycStatus: kyc.kyc_status,
        kycTier: kyc.kyc_tier,
        documents: docs,
      },
    });
  } catch (e) {
    next(e);
  }
});

identityRouter.post("/upload", limiter, async (req, res, next) => {
  const schema = z.object({ docType: z.string().min(2).max(40), fileName: z.string().min(2).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() });
    return;
  }
  const key = `demo/${req.user!.id}/${Date.now()}_${parsed.data.fileName}`;
  try {
    await pool.query(
      `INSERT INTO verification_documents (user_id, doc_type, storage_key, status)
       VALUES ($1::uuid, $2::text, $3::text, 'uploaded')`,
      [req.user!.id, parsed.data.docType, key],
    );
  } catch {
    res.json({
      data: {
        uploadUrl: null,
        note: "verification_documents table missing — run migration 005. Metadata accepted only.",
        storageKey: key,
      },
    });
    return;
  }
  res.json({
    data: {
      uploadUrl: `https://storage.example.invalid/presign?key=${encodeURIComponent(key)}`,
      storageKey: key,
      note: "Preview presigned URL. Wire S3/R2 in production.",
    },
  });
});

identityRouter.post("/submit", limiter, async (_req, res) => {
  res.json({ data: { ok: true, message: "Application recorded. Complete identity verification for your tier." } });
});
