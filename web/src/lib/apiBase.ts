/**
 * API routing for local dev (Vite proxy) and production builds.
 */
const DEFAULT_PRODUCTION_API_HOST = "https://fintech-trading-app-nor2.onrender.com";
const envApiUrl = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");

export const PRODUCTION_API_HOST = envApiUrl || DEFAULT_PRODUCTION_API_HOST;

/** True when running the Vite dev server (not a production build). */
export function isLocalDev(): boolean {
  return import.meta.env.DEV;
}

/**
 * REST API origin. Empty string = same-origin `/api/...` through Vite locally.
 */
function resolveApiOrigin(): string {
  if (envApiUrl) return envApiUrl;
  return import.meta.env.PROD ? DEFAULT_PRODUCTION_API_HOST : "";
}

export const API_ORIGIN = resolveApiOrigin();

/** Prefix `/api/...` with the resolved API origin when set. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = resolveApiOrigin();
  return origin ? `${origin}${p}` : p;
}

/** Socket.IO connect target: direct API host in production, same-origin in local dev. */
export function socketOrigin(): string {
  if (envApiUrl) return envApiUrl;
  if (import.meta.env.PROD) return DEFAULT_PRODUCTION_API_HOST;
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Same as `fetch`; production REST traffic uses the same-origin Vercel rewrite. */
export function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === "string" && input.startsWith("/")) {
    // Production REST calls stay same-origin so Vercel's /api rewrite routes them
    // to the live backend. This also prevents a stale VITE_API_URL from bypassing
    // the deployed rewrite and sending sign-in to an obsolete API host.
    return fetch(import.meta.env.PROD ? input : apiUrl(input), init);
  }
  return fetch(input, init);
}
