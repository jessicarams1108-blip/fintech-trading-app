/**
 * Production API origin when the SPA is on Vercel and the API runs elsewhere (Railway, Render, etc.).
 * Leave VITE_API_URL unset for local dev (Vite proxies /api to the backend).
 */
const raw = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");

export const API_ORIGIN = raw;

/** Prefix `/api/...` with VITE_API_URL when set; otherwise same-origin relative path. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_ORIGIN ? `${API_ORIGIN}${p}` : p;
}

/** Socket.IO connect target — API host when split, else current page origin. */
export function socketOrigin(): string {
  return API_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");
}

/** Same as `fetch`, but prefixes app-relative `/api/...` paths with `VITE_API_URL` when set. */
export function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === "string" && input.startsWith("/")) {
    return fetch(apiUrl(input), init);
  }
  return fetch(input, init);
}
