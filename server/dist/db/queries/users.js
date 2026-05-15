import bcrypt from "bcryptjs";
import { pool } from "../index.js";
import { ensureStarterWalletsForUser } from "./wallets.js";
const PLACEHOLDER_SECRET = "DISABLED_DEV_LOGIN";
const RESERVED_USERNAMES = new Set(["admin", "oove", "test", "support", "root", "system"]);
export function isReservedUsername(username) {
    return RESERVED_USERNAMES.has(username.trim().toLowerCase());
}
export async function findUserByEmail(normalizedEmail) {
    const res = await pool.query(`SELECT id, email, COALESCE(account_status, 'verified') AS account_status
     FROM users WHERE email = $1::text LIMIT 1`, [normalizedEmail]);
    return res.rows[0] ?? null;
}
/** For password sign-in only (includes password_hash). */
export async function findUserByEmailForLogin(normalizedEmail) {
    const res = await pool.query(`SELECT id, email, COALESCE(account_status, 'verified') AS account_status, password_hash
     FROM users WHERE email = $1::text LIMIT 1`, [normalizedEmail.trim().toLowerCase()]);
    return res.rows[0] ?? null;
}
/** Pending signup only — for “resend code by email” recovery. */
export async function findPendingVerificationByEmail(normalizedEmail) {
    const res = await pool.query(`SELECT id, email FROM users
     WHERE email = $1::text AND account_status = 'pending_verification'
     LIMIT 1`, [normalizedEmail.trim().toLowerCase()]);
    return res.rows[0] ?? null;
}
export async function findUserById(id) {
    const res = await pool.query(`SELECT id, email, account_status, password_hash,
            verification_otp_hash, verification_otp_expires_at,
            first_name, last_name, age, username
     FROM users WHERE id = $1::uuid LIMIT 1`, [id]);
    return res.rows[0] ?? null;
}
export async function listLoginEligibleUsersForAdmin(options) {
    const limit = Math.min(500, Math.max(1, options?.limit ?? 200));
    const rawQ = options?.q?.trim() ?? "";
    const q = rawQ.replace(/%/g, "").replace(/_/g, "");
    const hasQ = q.length >= 1;
    if (hasQ) {
        const pattern = `%${q.toLowerCase()}%`;
        const { rows } = await pool.query(`SELECT id, email, username, first_name, last_name,
              COALESCE(account_status, 'verified') AS account_status,
              created_at
       FROM users
       WHERE COALESCE(account_status, 'verified') = 'verified'
         AND (
           LOWER(email) LIKE $1
           OR LOWER(COALESCE(username, '')) LIKE $1
         )
       ORDER BY created_at DESC
       LIMIT $2::int`, [pattern, limit]);
        return rows;
    }
    const { rows } = await pool.query(`SELECT id, email, username, first_name, last_name,
            COALESCE(account_status, 'verified') AS account_status,
            created_at
     FROM users
     WHERE COALESCE(account_status, 'verified') = 'verified'
     ORDER BY created_at DESC
     LIMIT $1::int`, [limit]);
    return rows;
}
export async function usernameExistsIgnoreCase(username) {
    const u = username.trim().toLowerCase();
    const res = await pool.query(`SELECT 1 FROM users WHERE LOWER(username) = $1 LIMIT 1`, [u]);
    return (res.rowCount ?? 0) > 0;
}
export async function isUsernameAvailable(username) {
    const u = username.trim().toLowerCase();
    if (u.length < 3 || isReservedUsername(u))
        return false;
    return !(await usernameExistsIgnoreCase(u));
}
export async function ensureUserByEmail(rawEmail) {
    const email = rawEmail.trim().toLowerCase();
    if (!email.includes("@"))
        throw new Error("Invalid email");
    const existing = await findUserByEmail(email);
    if (existing) {
        if (existing.account_status === "pending_verification") {
            throw new Error("Complete email verification before signing in");
        }
        await ensureStarterWalletsForUser(existing.id);
        return { id: existing.id, email: existing.email };
    }
    const passwordHash = await bcrypt.hash(PLACEHOLDER_SECRET, 10);
    const res = await pool.query(`INSERT INTO users (email, password_hash)
     VALUES ($1::text, $2::text)
     RETURNING id, email`, [email, passwordHash]);
    const created = res.rows[0];
    await ensureStarterWalletsForUser(created.id);
    return created;
}
export async function createPendingUser(params) {
    const email = params.email.trim().toLowerCase();
    const username = params.username.trim().toLowerCase();
    const res = await pool.query(`INSERT INTO users (
       email, password_hash, account_status,
       verification_otp_hash, verification_otp_expires_at,
       first_name, last_name, age, username
     ) VALUES (
       $1, $2, 'pending_verification',
       $3, $4,
       $5, $6, $7, $8
     )
     RETURNING id, email`, [
        email,
        params.passwordHash,
        params.otpHash,
        params.otpExpiresAt,
        params.firstName.trim(),
        params.lastName.trim(),
        params.age,
        username,
    ]);
    return res.rows[0];
}
export async function deleteUserById(id) {
    await pool.query(`DELETE FROM users WHERE id = $1::uuid`, [id]);
}
export async function markUserVerified(userId) {
    await pool.query(`UPDATE users
     SET account_status = 'verified',
         verification_otp_hash = NULL,
         verification_otp_expires_at = NULL
     WHERE id = $1::uuid`, [userId]);
}
export async function setUserOtp(userId, otpHash, otpExpiresAt) {
    const res = await pool.query(`UPDATE users
     SET verification_otp_hash = $2,
         verification_otp_expires_at = $3
     WHERE id = $1::uuid AND account_status = 'pending_verification'`, [userId, otpHash, otpExpiresAt]);
    return (res.rowCount ?? 0) > 0;
}
export async function findVerifiedUserByEmail(normalizedEmail) {
    const res = await pool.query(`SELECT id, email FROM users
     WHERE email = $1::text AND account_status = 'verified'
     LIMIT 1`, [normalizedEmail.trim().toLowerCase()]);
    return res.rows[0] ?? null;
}
export async function updateUserNames(userId, firstName, lastName) {
    await pool.query(`UPDATE users SET first_name = $2::text, last_name = $3::text WHERE id = $1::uuid`, [userId, firstName, lastName]);
}
