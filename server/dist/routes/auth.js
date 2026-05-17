import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authenticateRequired, signAccessToken, verifyAccessToken, } from "../middleware/auth.js";
import { env } from "../env.js";
import { createPendingUser, deleteUserById, ensureUserByEmail, findUserByEmail, findUserByEmailForLogin, findUserById, findPendingVerificationByEmail, isReservedUsername, isUsernameAvailable, markUserVerified, setUserOtp, toUserProfile, } from "../db/queries/users.js";
import { ensureStarterWalletsForUser } from "../db/queries/wallets.js";
import { generateSixDigitOtp, hashOtp, verifyOtpHash } from "../lib/otp.js";
import { mailFailureMessage, sendVerificationEmail } from "../lib/mail.js";
import { createSession } from "../db/queries/sessions.js";
import { isS3DepositUploadConfigured } from "../lib/depositS3Presign.js";
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
});
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    age: z.coerce.number().int().min(18).max(120),
    username: z
        .string()
        .min(3)
        .max(32)
        .regex(/^[a-zA-Z0-9_]+$/, "Username may contain letters, numbers, and underscores only"),
});
export const authRouter = Router();
authRouter.get("/public-config", (_req, res) => {
    res.json({
        data: {
            emailDelivery: env.RESEND_API_KEY ? "resend" : "console",
            depositProofUploads: isS3DepositUploadConfigured(),
        },
    });
});
authRouter.get("/check-username", authLimiter, async (req, res) => {
    const raw = String(req.query.username ?? "").trim();
    if (!raw) {
        res.status(400).json({ error: "username query required" });
        return;
    }
    try {
        const available = await isUsernameAvailable(raw);
        res.json({ available });
    }
    catch {
        res.status(500).json({ error: "Unable to check username" });
    }
});
authRouter.post("/register", authLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid registration data", details: parsed.error.flatten() });
        return;
    }
    const { email, password, firstName, lastName, age, username } = parsed.data;
    const normEmail = email.toLowerCase().trim();
    const normUser = username.toLowerCase();
    if (isReservedUsername(normUser)) {
        res.status(400).json({ error: "Username not allowed" });
        return;
    }
    if (!(await isUsernameAvailable(normUser))) {
        res.status(400).json({ error: "Username is taken" });
        return;
    }
    const existing = await findUserByEmail(normEmail);
    if (existing) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
    }
    const code = generateSixDigitOtp();
    const otpHash = await hashOtp(code);
    const expires = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
    const passwordHash = await bcrypt.hash(password, 10);
    try {
        const user = await createPendingUser({
            email: normEmail,
            passwordHash,
            firstName,
            lastName,
            age,
            username: normUser,
            otpHash,
            otpExpiresAt: expires,
        });
        try {
            await sendVerificationEmail(normEmail, code);
        }
        catch (mailErr) {
            console.error("[register] mail failed", mailErr);
            await deleteUserById(user.id);
            res.status(502).json({ error: mailFailureMessage(mailErr) });
            return;
        }
        const body = {
            userId: user.id,
            email: user.email,
            message: "Verification code sent",
        };
        if (!env.RESEND_API_KEY) {
            body.devVerificationCode = code;
        }
        res.status(201).json(body);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (/duplicate|unique/i.test(msg)) {
            res.status(409).json({ error: "Email or username already in use" });
            return;
        }
        console.error("[register]", e);
        res.status(500).json({ error: "Registration failed" });
    }
});
authRouter.post("/verify", authLimiter, async (req, res) => {
    const bodySchema = z.object({
        userId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload" });
        return;
    }
    const { userId, code } = parsed.data;
    const row = await findUserById(userId);
    if (!row) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    if (row.account_status !== "pending_verification") {
        res.status(400).json({ error: "Account is not awaiting verification" });
        return;
    }
    if (!row.verification_otp_hash || !row.verification_otp_expires_at) {
        res.status(400).json({ error: "No verification code pending" });
        return;
    }
    const exp = new Date(row.verification_otp_expires_at).getTime();
    if (Number.isNaN(exp) || Date.now() > exp) {
        res.status(400).json({ error: "Verification code expired" });
        return;
    }
    const ok = await verifyOtpHash(code, row.verification_otp_hash);
    if (!ok) {
        res.status(401).json({ error: "Invalid verification code" });
        return;
    }
    await markUserVerified(userId);
    await ensureStarterWalletsForUser(userId);
    const verified = (await findUserById(userId)) ?? row;
    const profile = toUserProfile(verified);
    const token = signAccessToken({ id: profile.id, email: profile.email });
    void createSession({
        userId: profile.id,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        ipAddress: typeof req.headers["x-forwarded-for"] === "string"
            ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
            : req.socket.remoteAddress ?? null,
    });
    res.json({
        token,
        user: profile,
    });
});
const sendVerificationByEmailSchema = z.object({
    email: z.string().email(),
});
authRouter.post("/send-verification-code", authLimiter, async (req, res) => {
    const parsed = sendVerificationByEmailSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid email" });
        return;
    }
    const normEmail = parsed.data.email.toLowerCase().trim();
    const row = await findPendingVerificationByEmail(normEmail);
    if (!row) {
        res.json({
            message: "If that email has a signup waiting on verification, check your inbox (and spam) for a code.",
        });
        return;
    }
    const code = generateSixDigitOtp();
    const otpHash = await hashOtp(code);
    const expires = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
    const updated = await setUserOtp(row.id, otpHash, expires);
    if (!updated) {
        res.status(404).json({ error: "No pending verification for this account" });
        return;
    }
    try {
        await sendVerificationEmail(row.email, code);
    }
    catch (mailErr) {
        console.error("[send-verification-code] mail failed", mailErr);
        res.status(502).json({ error: mailFailureMessage(mailErr) });
        return;
    }
    const body = {
        message: "Verification code sent",
        userId: row.id,
        email: row.email,
    };
    if (!env.RESEND_API_KEY) {
        body.devVerificationCode = code;
    }
    res.json(body);
});
authRouter.post("/resend-otp", authLimiter, async (req, res) => {
    const bodySchema = z.object({ userId: z.string().uuid() });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "userId required" });
        return;
    }
    const { userId } = parsed.data;
    const row = await findUserById(userId);
    if (!row || row.account_status !== "pending_verification") {
        res.status(404).json({ error: "No pending verification for this account" });
        return;
    }
    const code = generateSixDigitOtp();
    const otpHash = await hashOtp(code);
    const expires = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
    const updated = await setUserOtp(userId, otpHash, expires);
    if (!updated) {
        res.status(404).json({ error: "No pending verification for this account" });
        return;
    }
    try {
        await sendVerificationEmail(row.email, code);
    }
    catch (mailErr) {
        console.error("[resend-otp] mail failed", mailErr);
        res.status(502).json({ error: mailFailureMessage(mailErr) });
        return;
    }
    const body = {
        message: "Verification code sent",
    };
    if (!env.RESEND_API_KEY) {
        body.devVerificationCode = code;
    }
    res.json(body);
});
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
authRouter.post("/login", authLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid email or password" });
        return;
    }
    const normEmail = parsed.data.email.toLowerCase().trim();
    const row = await findUserByEmailForLogin(normEmail);
    if (!row) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
    }
    if (row.account_status === "pending_verification") {
        res.status(403).json({ error: "Verify your email to finish signup, then sign in here." });
        return;
    }
    const passwordOk = await bcrypt.compare(parsed.data.password, row.password_hash);
    if (!passwordOk) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
    }
    await ensureStarterWalletsForUser(row.id);
    const full = (await findUserById(row.id)) ?? null;
    if (!full) {
        res.status(500).json({ error: "User record missing" });
        return;
    }
    const profile = toUserProfile(full);
    const token = signAccessToken({ id: profile.id, email: profile.email });
    void createSession({
        userId: profile.id,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        ipAddress: typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0]?.trim() : req.socket.remoteAddress ?? null,
    });
    res.json({
        token,
        user: profile,
    });
});
authRouter.post("/session", authLimiter, async (req, res) => {
    if (!env.DEV_PASSWORDLESS_SESSION) {
        res.status(400).json({
            error: "Passwordless sign-in is disabled. Sign in with your email and password, or set DEV_PASSWORDLESS_SESSION=true for legacy demos.",
        });
        return;
    }
    const rawEmail = String(req.body?.email ?? "").trim();
    try {
        const user = await ensureUserByEmail(rawEmail);
        await ensureStarterWalletsForUser(user.id);
        const full = (await findUserById(user.id)) ?? null;
        if (!full) {
            res.status(500).json({ error: "User record missing" });
            return;
        }
        const profile = toUserProfile(full);
        const token = signAccessToken({ id: profile.id, email: profile.email });
        void createSession({
            userId: profile.id,
            userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
            ipAddress: typeof req.headers["x-forwarded-for"] === "string"
                ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
                : req.socket.remoteAddress ?? null,
        });
        res.json({
            token,
            user: profile,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("Complete email verification")) {
            res.status(403).json({ error: msg });
            return;
        }
        res.status(400).json({ error: "Unable to mint session token" });
    }
});
authRouter.get("/me", async (req, res) => {
    const header = req.header("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    if (!bearer) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const claims = verifyAccessToken(bearer);
        const row = await findUserById(claims.id);
        if (!row) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        res.json({ user: toUserProfile(row) });
    }
    catch {
        res.status(401).json({ error: "Invalid token" });
    }
});
authRouter.post("/logout", authenticateRequired, (_req, res) => {
    res.status(204).end();
});
