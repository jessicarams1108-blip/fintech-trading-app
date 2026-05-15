import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export type JwtUser = {
  id: string;
  email: string;
};

const ADMIN_EMAIL_NORMALIZED = (
  env.ADMIN_PRIMARY_EMAIL ??
  // Default matches product owner allowlist (case-insensitive at check time).
  "Hardewusi@gmail.com"
).toLowerCase();

export type AccessTokenClaims = JwtUser;

export function signAccessToken(user: JwtUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function verifyAccessToken(token: string): JwtUser {
  const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
    email?: string;
    sub?: string;
  };
  const id = decoded.sub ?? "";
  const email = decoded.email ?? "";
  if (!id || !email) throw new jwt.JsonWebTokenError("Malformed token payload");
  return { id, email };
}

export function authenticateRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  if (!bearer) {
    res.status(401).json({ error: "Authorization bearer token required" });
    return;
  }

  try {
    req.user = verifyAccessToken(bearer);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Locks admin surfaces to one primary operator email (upgrade to role column ASAP).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user?.email) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (user.email.trim().toLowerCase() !== ADMIN_EMAIL_NORMALIZED) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }
  next();
}
