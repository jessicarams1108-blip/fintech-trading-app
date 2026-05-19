import { apiFetch } from "@/lib/apiBase";

export type SupportMessage = {
  id: string;
  ticketId: string;
  senderType: "user" | "admin" | "system";
  senderUserId: string | null;
  body: string;
  attachmentKey: string | null;
  attachmentName: string | null;
  attachmentUrl: string | null;
  createdAt: string;
};

export type SupportConversation = {
  ticket: { id: string; status: string; createdAt: string; updatedAt: string };
  user: { email: string; displayName: string; fullName: string | null };
  messages: SupportMessage[];
};

export type AdminSupportTicket = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: string;
  updatedAt: string;
  lastMessagePreview: string | null;
};

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body;
}

function authHeaders(token: string, extra?: Record<string, string>) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

export async function fetchSupportCapabilities(token: string): Promise<{ attachments: boolean }> {
  const res = await apiFetch("/api/support/capabilities", { headers: authHeaders(token) });
  const body = await parse<{ data: { attachments: boolean } }>(res);
  return body.data;
}

export async function fetchSupportConversation(token: string): Promise<SupportConversation> {
  const res = await apiFetch("/api/support/conversation", { headers: authHeaders(token) });
  const body = await parse<{ data: SupportConversation }>(res);
  return body.data;
}

export async function sendSupportMessage(
  token: string,
  payload: { body: string; attachmentKey?: string; attachmentName?: string },
): Promise<SupportMessage> {
  const res = await apiFetch("/api/support/messages", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const body = await parse<{ data: SupportMessage }>(res);
  return body.data;
}

export async function uploadSupportAttachment(token: string, ticketId: string, file: File): Promise<string> {
  const pres = await apiFetch("/api/support/presign", {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      ticketId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  });
  const presBody = await parse<{ data: { uploadUrl: string; attachmentKey: string; headers?: Record<string, string> } }>(
    pres,
  );
  const { uploadUrl, attachmentKey, headers = {} } = presBody.data;
  const put = await fetch(uploadUrl, { method: "PUT", headers, body: file });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return attachmentKey;
}

export async function adminListSupportTickets(token: string, status: string): Promise<AdminSupportTicket[]> {
  const res = await apiFetch(`/api/admin/support/tickets?status=${encodeURIComponent(status)}`, {
    headers: authHeaders(token),
  });
  const body = await parse<{ data: AdminSupportTicket[] }>(res);
  return body.data;
}

export async function adminFetchSupportTicket(
  token: string,
  ticketId: string,
): Promise<{ ticket: AdminSupportTicket & { createdAt: string }; messages: SupportMessage[] }> {
  const res = await apiFetch(`/api/admin/support/tickets/${ticketId}`, { headers: authHeaders(token) });
  const body = await parse<{
    data: { ticket: AdminSupportTicket & { createdAt: string }; messages: SupportMessage[] };
  }>(res);
  return body.data;
}

export async function adminReplySupport(token: string, ticketId: string, body: string): Promise<SupportMessage> {
  const res = await apiFetch(`/api/admin/support/tickets/${ticketId}/messages`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ body }),
  });
  const parsed = await parse<{ data: SupportMessage }>(res);
  return parsed.data;
}

export async function adminUpdateTicketStatus(token: string, ticketId: string, status: string): Promise<void> {
  const res = await apiFetch(`/api/admin/support/tickets/${ticketId}/status`, {
    method: "PATCH",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ status }),
  });
  await parse<{ data: { ok: boolean } }>(res);
}
