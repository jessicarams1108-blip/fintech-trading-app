import { apiFetch } from "@/lib/apiBase";

export type ProfileDto = {
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
};

function parseError(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string" && err.length > 0) return err;
  }
  return fallback;
}

export async function fetchProfile(token: string): Promise<ProfileDto> {
  const res = await apiFetch("/api/settings/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: ProfileDto; error?: string };
  if (!res.ok) throw new Error(parseError(body, res.statusText));
  if (!body.data) throw new Error("Invalid profile response");
  return body.data;
}

export async function patchProfile(
  token: string,
  payload: { fullName?: string; username?: string },
): Promise<ProfileDto> {
  const res = await apiFetch("/api/settings/profile", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: ProfileDto & { ok?: boolean }; error?: string };
  if (!res.ok) throw new Error(parseError(body, res.statusText));
  if (!body.data) throw new Error("Invalid profile response");
  return {
    email: body.data.email,
    username: body.data.username,
    firstName: body.data.firstName,
    lastName: body.data.lastName,
    fullName: body.data.fullName,
  };
}

export async function changePassword(
  token: string,
  payload: { currentPassword: string; newPassword: string; confirmPassword: string },
): Promise<void> {
  const res = await apiFetch("/api/settings/change-password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(parseError(body, res.statusText));
}
