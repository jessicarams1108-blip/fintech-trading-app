/**
 * API routing for local dev (Vite proxy), Vercel production (same-origin proxy to Render),
 * and optional direct `VITE_API_URL` for other hosts.
 */
export const PRODUCTION_API_HOST = "https://theoove-app.onrender.com";

const envApiUrl = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");

function isTheooveProductionSite(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "theoove.com" || host === "www.theoove.com";
}

/** True when running the Vite dev server (not a production build). */
export function isLocalDev(): boolean {
  return import.meta.env.DEV;
}

/**
 * REST API origin. Empty string = same-origin `/api/...` (Vite proxy locally,
 * Vercel → Render proxy on theoove.com).
 */
function resolveApiOrigin(): string {
  if (isTheooveProductionSite()) return "";
  return envApiUrl;
}

export const API_ORIGIN = resolveApiOrigin();

/** Prefix `/api/...` with the resolved API origin when set. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const origin = resolveApiOrigin();
  return origin ? `${origin}${p}` : p;
}

/** Socket.IO connect target — direct Render host in production; Vite proxy locally. */
export function socketOrigin(): string {
  if (isTheooveProductionSite()) return PRODUCTION_API_HOST;
  if (envApiUrl) return envApiUrl;
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** Same as `fetch`, but prefixes app-relative `/api/...` paths with the resolved API origin. */
export function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === "string" && input.startsWith("/")) {
    return fetch(apiUrl(input), init);
  }
  return fetch(input, init);
}
