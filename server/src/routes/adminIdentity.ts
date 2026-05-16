import { Router } from "express";
import { z } from "zod";
import { authenticateRequired, requireAdmin } from "../middleware/auth.js";
import {
  approveIdentitySubmission,
  getIdentitySubmissionById,
  listPendingIdentitySubmissions,
  rejectIdentitySubmission,
  submissionUserFullName,
} from "../db/queries/identityVerification.js";
import { getKycDocumentViewUrl } from "../lib/kycDocumentStorage.js";
import { sendKycApprovedEmail, sendKycRejectedEmail } from "../lib/mail.js";

function formatAddress(row: {
  street: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
}): string {
  return [row.street, row.city, row.state_province, row.postal_code, row.country].filter(Boolean).join(", ");
}

function mapSubmissionDto(row: Awaited<ReturnType<typeof listPendingIdentitySubmissions>>[number]) {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    userEmail: row.user_email,
    userName: submissionUserFullName(row),
    username: row.user_username,
    phone: `${row.phone_country_code} ${row.phone_number}`,
    ssnLast4: row.ssn_last4,
    address: formatAddress(row),
    street: row.street,
    city: row.city,
    stateProvince: row.state_province,
    postalCode: row.postal_code,
    country: row.country,
    email: row.email,
    idDocType: row.id_doc_type,
    idFileName: row.id_file_name,
    idContentType: row.id_content_type,
    vendorFields: row.vendor_fields ?? {},
    submittedAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    hasInlineDocument: Boolean(row.id_document_base64),
    idViewUrl: null as string | null,
  };
}

export function createAdminIdentityRoutes(): Router {
  const router = Router();
  router.use(authenticateRequired, requireAdmin);

  router.get("/identity-verifications/pending", async (_req, res, next) => {
    try {
      const rows = await listPendingIdentitySubmissions();
      const data = await Promise.all(
        rows.map(async (row) => {
          const dto = mapSubmissionDto(row);
          if (!row.id_document_base64) {
            dto.idViewUrl = await getKycDocumentViewUrl(row.id_storage_key);
          }
          return dto;
        }),
      );
      res.json({ data });
    } catch (e) {
      next(e);
    }
  });

  router.get("/identity-verifications/:id/document", async (req, res, next) => {
    try {
      const row = await getIdentitySubmissionById(req.params.id);
      if (!row) {
        res.status(404).json({ error: "Submission not found" });
        return;
      }
      if (row.id_document_base64) {
        const mime = row.id_content_type || "application/octet-stream";
        res.json({
          data: {
            url: `data:${mime};base64,${row.id_document_base64}`,
            contentType: mime,
            fileName: row.id_file_name,
          },
        });
        return;
      }
      const url = await getKycDocumentViewUrl(row.id_storage_key);
      if (!url) {
        res.status(404).json({ error: "Document not available" });
        return;
      }
      res.json({ data: { url, contentType: row.id_content_type, fileName: row.id_file_name } });
    } catch (e) {
      next(e);
    }
  });

  router.post("/identity-verifications/:id/approve", async (req, res, next) => {
    const parsed = z
      .object({ tier: z.coerce.number().int().min(1).max(3).optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid payload" });
      return;
    }
    try {
      const updated = await approveIdentitySubmission({
        submissionId: req.params.id,
        reviewerId: req.user!.id,
        tier: parsed.data.tier ?? 1,
      });
      if (!updated) {
        res.status(404).json({ error: "Pending submission not found" });
        return;
      }
      const tier = Math.min(3, Math.max(1, parsed.data.tier ?? 1));
      void sendKycApprovedEmail(updated.user_email, { tier });
      res.json({
        data: {
          ok: true,
          status: "Approved",
          verificationState: "approved",
          kycStatus: "verified",
          kycTier: tier,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/identity-verifications/:id/reject", async (req, res, next) => {
    const parsed = z.object({ reason: z.string().min(3).max(500) }).safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(422).json({ error: "Rejection reason is required (min 3 characters)" });
      return;
    }
    try {
      const updated = await rejectIdentitySubmission({
        submissionId: req.params.id,
        reviewerId: req.user!.id,
        reason: parsed.data.reason.trim(),
      });
      if (!updated) {
        res.status(404).json({ error: "Pending submission not found" });
        return;
      }
      void sendKycRejectedEmail(updated.user_email, { reason: parsed.data.reason.trim() });
      res.json({
        data: {
          ok: true,
          status: "Rejected",
          verificationState: "rejected",
          kycStatus: "rejected",
        },
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
