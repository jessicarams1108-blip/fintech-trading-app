import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
/** Six-digit string, leading zeros allowed. */
export function generateSixDigitOtp() {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
export async function hashOtp(code) {
    return bcrypt.hash(code, 8);
}
export async function verifyOtpHash(code, hash) {
    return bcrypt.compare(code, hash);
}
