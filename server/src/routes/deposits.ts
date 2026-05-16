import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { Server as SocketIOServer } from "socket.io";
import { z } from "zod";
import {
  confirmDeposit,
  getDepositById,
  getPendingDeposits,
  insertDeposit,
  listUserDepositActivity,
  rejectDeposit,
  type DepositAsset,
} from "../db/queries/deposits.js";
import { WALLET_ADDRESSES, type WalletAssetKey } from "../config.js";
import { authenticateRequired, requireAdmin } from "../middleware/auth.js";
import { MIN_DEPOSIT_USD, assetAmountToUsd } from "../lib/assetUsd.js";
import { findUserById } from "../db/queries/users.js";
import { sendDepositConfirmedEmail } from "../lib/mail.js";
import { env } from "../env.js";
import {
  createDepositProofPresignedPut,
  isS3DepositUploadConfigured,
} from "../lib/depositS3Presign.js";

const btcHash = /^[a-fA-F0-9]{64}$/;
const evmTx = /^0x[a-fA-F0-9]{64}$/;

const submitSchema = z.object({
  asset: z.enum(["BTC", "ETH", "USDT"]),
  /** Optional; omitted or empty uses a server-generated placeholder (ops reconciles via proof). */
  txHash: z.string().max(120).optional(),
  screenshotFileName: z.string().max(260).nullable().optional(),
  /** Object key returned from POST /api/deposit/presign (must belong to the signed-in user). */
  depositProofKey: z.string().min(30).max(500).optional(),
  declaredAmountUsd: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= MIN_DEPOSIT_USD, {
      message: `Each deposit must declare at least $${MIN_DEPOSIT_USD} USD equivalent.`,
    }),
});

const presignSchema = z.object({
  fileName: z.string().min(1).max(260),
  contentType: z.string().min(1).max(120),
});

function proofKeyBelongsToUser(userId: string, key: string): boolean {
  const prefix = `deposits/${userId}/`;
  if (!key.startsWith(prefix) || key.length > 500) return false;
  const rest = key.slice(prefix.length);
  if (!rest || rest.includes("/") || rest.includes("..")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(rest);
}

function resolveProofImageUrl(userId: string, parsed: z.infer<typeof submitSchema>): string | null {
  const key = parsed.depositProofKey?.trim();
  if (key) {
    if (!proofKeyBelongsToUser(userId, key)) {
      throw new Error("Invalid deposit proof key");
    }
    const base = env.S3_PUBLIC_BASE_URL?.trim();
    if (!base) {
      throw new Error("Server is missing S3_PUBLIC_BASE_URL");
    }
    return `${base.replace(/\/+$/, "")}/${key}`;
  }
  const fn = parsed.screenshotFileName?.trim();
  if (fn?.length) {
    return `https://objects.example.invalid/${encodeURIComponent(fn)}`;
  }
  return null;
}

function validateTxHash(asset: DepositAsset, hash: string) {
  const trimmed = hash.trim();
  if (asset === "BTC" && btcHash.test(trimmed)) return trimmed;
  if ((asset === "ETH" || asset === "USDT") && evmTx.test(trimmed)) return trimmed;
  if (asset === "USDT" && /^[a-fA-F0-9]{64}$/.test(trimmed)) return trimmed;
  throw new Error("Malformed transaction identifier for asset");
}

/** Valid on-chain-shaped ID so DB + duplicate checks stay consistent when the user skips tx hash. */
function generatedPendingTxHash(asset: DepositAsset): string {
  const hex = randomBytes(32).toString("hex");
  if (asset === "BTC") return hex;
  return `0x${hex}`;
}

const NETWORK_LABELS: Record<WalletAssetKey, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  USDT: "Ethereum (ERC-20)",
};

const depositNotice: Record<WalletAssetKey, string> = {
  BTC: "Only send BTC to this address. Do not send other assets.",
  ETH: "Only send ETH on the configured Ethereum network.",
  USDT: "Only send supported USDT on the configured Ethereum network.",
};

export function createPublicDepositRoutes() {
  const router = Router();

  router.get("/capabilities", (_req, res) => {
    res.json({ data: { depositProofUploads: isS3DepositUploadConfigured() } });
  });

  router.get("/config", (req, res) => {
    const raw = typeof req.query.asset === "string" ? req.query.asset.toUpperCase() : "";
    if (!["BTC", "ETH", "USDT"].includes(raw)) {
      return res.status(400).json({ error: "Unsupported asset" });
    }

    const asset = raw as WalletAssetKey;

    const address = WALLET_ADDRESSES[asset];
    const networkLabel = NETWORK_LABELS[asset];
    const note = depositNotice[asset];

    return res.json({
      address,
      asset,
      network: networkLabel,
      note,
      minDeclaredUsd: MIN_DEPOSIT_USD,
    });
  });

  router.get("/my-activity", authenticateRequired, async (req, res, next) => {
    const raw = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : NaN;
    const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, raw)) : 50;
    try {
      const rows = await listUserDepositActivity(req.user!.id, limit);
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  router.post("/presign", authenticateRequired, async (req, res, next) => {
    if (!isS3DepositUploadConfigured()) {
      return res.status(503).json({ error: "Deposit proof uploads are not enabled on this server" });
    }
    const parsed = presignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: parsed.error.flatten() });
    }
    const ct = parsed.data.contentType.toLowerCase();
  if (!ct.startsWith("image/") && ct !== "application/pdf" && ct !== "application/octet-stream") {
      return res.status(400).json({ error: "Unsupported content type for proof upload" });
    }
    try {
      const out = await createDepositProofPresignedPut({
        userId: req.user!.id,
        fileName: parsed.data.fileName,
        contentType: parsed.data.contentType,
      });
      res.json({ data: out });
    } catch (err) {
      next(err);
    }
  });

  router.post("/submit", authenticateRequired, async (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: parsed.error.flatten() });
    }

    try {
      const rawTx = (parsed.data.txHash ?? "").trim();
      const txHashClean =
        rawTx.length > 0
          ? validateTxHash(parsed.data.asset as DepositAsset, rawTx)
          : generatedPendingTxHash(parsed.data.asset as DepositAsset);
      let proof: string | null;
      try {
        proof = resolveProofImageUrl(req.user!.id, parsed.data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid proof";
        return res.status(400).json({ error: msg });
      }

      const record = await insertDeposit({
        userId: req.user!.id,
        asset: parsed.data.asset as DepositAsset,
        txHash: txHashClean,
        proofImageUrl: proof,
        declaredAmountUsd: parsed.data.declaredAmountUsd,
      });

      res.status(201).json({ data: record });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed";
      const statusCode = message.includes("TX hash already submitted") ? 409 : 400;
      res.status(statusCode).json({ error: message });
    }
  });

  return router;
}

export function createAdminDepositRoutes(io: SocketIOServer) {
  const router = Router();
  router.use(authenticateRequired, requireAdmin);

  router.get("/deposits/pending", async (_req, res, next) => {
    try {
      const rows = await getPendingDeposits();
      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  });

  router.post("/deposit/:id/confirm", async (req, res, next) => {
    const amountCandidate = req.body?.amount;
    const amountRaw =
      typeof amountCandidate === "number"
        ? amountCandidate.toString()
        : typeof amountCandidate === "string"
          ? amountCandidate.trim()
          : "";

    const notes =
      typeof req.body?.notes === "string" && req.body.notes.trim().length > 0 ? req.body.notes.trim() : undefined;

    if (!/^([0-9]+(\.[0-9]+)?)$/.test(amountRaw)) {
      return res.status(400).json({
        error: "Provide numeric credited amount via body.amount",
      });
    }

    const depositRow = await getDepositById(req.params.id);
    if (!depositRow) {
      return res.status(404).json({ error: "Deposit not found" });
    }
    if (depositRow.status !== "pending_review") {
      return res.status(400).json({ error: "Deposit is not awaiting review" });
    }
    const usdEq = assetAmountToUsd(depositRow.asset, amountRaw);
    if (usdEq < MIN_DEPOSIT_USD) {
      return res.status(400).json({
        error: `Credited amount must be at least $${MIN_DEPOSIT_USD} USD equivalent for ${depositRow.asset} (oracle estimate: $${usdEq.toFixed(2)}).`,
      });
    }

    try {
      await confirmDeposit({
        depositId: req.params.id,
        creditedAmount: amountRaw,
        adminUserId: req.user!.id,
        notes,
      });

      const deposit = await getDepositById(req.params.id);
      if (!deposit) {
        return res.status(500).json({ error: "Confirmed deposit missing unexpectedly" });
      }

      io.to(`user:${deposit.user_id}`).emit("deposit:confirmed", {
        depositId: deposit.id,
        asset: deposit.asset,
        amount: deposit.credited_amount ? Number(deposit.credited_amount) : Number(amountRaw),
      });

      const userRow = await findUserById(deposit.user_id);
      if (userRow?.email) {
        void sendDepositConfirmedEmail(userRow.email, {
          asset: String(deposit.asset),
          amount: amountRaw,
          txHash: deposit.tx_hash,
        }).catch((err: unknown) => {
          console.warn("[deposit] confirmation email failed:", err instanceof Error ? err.message : err);
        });
      }

      res.json({ data: deposit });
    } catch (err) {
      next(err);
    }
  });

  router.post("/deposit/:id/reject", async (req, res, next) => {
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) {
      return res.status(400).json({ error: "Rejection requires `reason`" });
    }
    try {
      await rejectDeposit({
        depositId: req.params.id,
        reason,
        adminUserId: req.user!.id,
      });

      const deposit = await getDepositById(req.params.id);
      res.json({ data: deposit });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
