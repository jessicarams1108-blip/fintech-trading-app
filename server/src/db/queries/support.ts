import { pool } from "../index.js";
import { findUserById, formatUserFullName } from "./users.js";
import { buildSupportWelcomeMessage, supportDisplayName } from "../../lib/supportWelcome.js";
import { publicUrlForSupportKey } from "../../lib/supportAttachmentStorage.js";

export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type SupportMessageRow = {
  id: string;
  ticket_id: string;
  sender_type: "user" | "admin" | "system";
  sender_user_id: string | null;
  body: string;
  attachment_key: string | null;
  attachment_name: string | null;
  created_at: Date | string;
};

export type SupportTicketRow = {
  id: string;
  user_id: string;
  status: SupportTicketStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

function serializeMessage(row: SupportMessageRow) {
  let attachmentUrl: string | null = null;
  if (row.attachment_key) {
    try {
      attachmentUrl = publicUrlForSupportKey(row.attachment_key);
    } catch {
      attachmentUrl = null;
    }
  }
  return {
    id: row.id,
    ticketId: row.ticket_id,
    senderType: row.sender_type,
    senderUserId: row.sender_user_id,
    body: row.body,
    attachmentKey: row.attachment_key,
    attachmentName: row.attachment_name,
    attachmentUrl,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function insertMessage(input: {
  ticketId: string;
  senderType: "user" | "admin" | "system";
  senderUserId?: string | null;
  body: string;
  attachmentKey?: string | null;
  attachmentName?: string | null;
}): Promise<SupportMessageRow> {
  const { rows } = await pool.query<SupportMessageRow>(
    `INSERT INTO support_messages (ticket_id, sender_type, sender_user_id, body, attachment_key, attachment_name)
     VALUES ($1::uuid, $2::text, $3::uuid, $4::text, $5::text, $6::text)
     RETURNING id::text, ticket_id::text, sender_type, sender_user_id::text, body,
               attachment_key, attachment_name, created_at`,
    [
      input.ticketId,
      input.senderType,
      input.senderUserId ?? null,
      input.body,
      input.attachmentKey ?? null,
      input.attachmentName ?? null,
    ],
  );
  await pool.query(`UPDATE support_tickets SET updated_at = NOW() WHERE id = $1::uuid`, [input.ticketId]);
  return rows[0]!;
}

export async function getOrCreateUserSupportConversation(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");

  let ticket = await pool.query<SupportTicketRow>(
    `SELECT id::text, user_id::text, status, created_at, updated_at
     FROM support_tickets
     WHERE user_id = $1::uuid AND status IN ('open', 'in_progress')
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId],
  );

  let ticketRow = ticket.rows[0];
  if (!ticketRow) {
    const created = await pool.query<SupportTicketRow>(
      `INSERT INTO support_tickets (user_id, status)
       VALUES ($1::uuid, 'open')
       RETURNING id::text, user_id::text, status, created_at, updated_at`,
      [userId],
    );
    ticketRow = created.rows[0]!;
    const display = supportDisplayName({
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
    });
    await insertMessage({
      ticketId: ticketRow.id,
      senderType: "system",
      body: buildSupportWelcomeMessage(display, user.email),
    });
  }

  const { rows: messages } = await pool.query<SupportMessageRow>(
    `SELECT id::text, ticket_id::text, sender_type, sender_user_id::text, body,
            attachment_key, attachment_name, created_at
     FROM support_messages
     WHERE ticket_id = $1::uuid
     ORDER BY created_at ASC`,
    [ticketRow.id],
  );

  return {
    ticket: {
      id: ticketRow.id,
      status: ticketRow.status,
      createdAt: ticketRow.created_at instanceof Date ? ticketRow.created_at.toISOString() : String(ticketRow.created_at),
      updatedAt: ticketRow.updated_at instanceof Date ? ticketRow.updated_at.toISOString() : String(ticketRow.updated_at),
    },
    user: {
      email: user.email,
      displayName: supportDisplayName({
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
      }),
      fullName: formatUserFullName(user.first_name, user.last_name),
    },
    messages: messages.map(serializeMessage),
  };
}

export async function addUserSupportMessage(input: {
  userId: string;
  body: string;
  attachmentKey?: string | null;
  attachmentName?: string | null;
}) {
  const trimmed = input.body.trim();
  if (!trimmed && !input.attachmentKey) {
    throw new Error("Message cannot be empty");
  }

  const conv = await getOrCreateUserSupportConversation(input.userId);
  if (conv.ticket.status === "resolved" || conv.ticket.status === "closed") {
    throw new Error("This ticket is closed. Please contact support to reopen.");
  }

  const row = await insertMessage({
    ticketId: conv.ticket.id,
    senderType: "user",
    senderUserId: input.userId,
    body: trimmed || "(attachment)",
    attachmentKey: input.attachmentKey,
    attachmentName: input.attachmentName,
  });

  return serializeMessage(row);
}

export type AdminSupportTicketListItem = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  status: SupportTicketStatus;
  updated_at: Date | string;
  last_message_preview: string | null;
};

export async function listSupportTicketsForAdmin(statusFilter?: string): Promise<AdminSupportTicketListItem[]> {
  const status = statusFilter && statusFilter !== "all" ? statusFilter : null;
  const { rows } = await pool.query<AdminSupportTicketListItem>(
    `SELECT t.id::text, t.user_id::text, u.email AS user_email,
            COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, u.email) AS user_name,
            t.status, t.updated_at,
            (
              SELECT LEFT(m.body, 120)
              FROM support_messages m
              WHERE m.ticket_id = t.id
              ORDER BY m.created_at DESC
              LIMIT 1
            ) AS last_message_preview
     FROM support_tickets t
     JOIN users u ON u.id = t.user_id
     WHERE ($1::text IS NULL OR t.status = $1::text)
     ORDER BY t.updated_at DESC
     LIMIT 100`,
    [status],
  );
  return rows;
}

export async function getSupportTicketForAdmin(ticketId: string) {
  const { rows: tickets } = await pool.query<SupportTicketRow & { user_email: string; user_name: string }>(
    `SELECT t.id::text, t.user_id::text, t.status, t.created_at, t.updated_at,
            u.email AS user_email,
            COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, u.email) AS user_name
     FROM support_tickets t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = $1::uuid`,
    [ticketId],
  );
  const ticket = tickets[0];
  if (!ticket) return null;

  const { rows: messages } = await pool.query<SupportMessageRow>(
    `SELECT id::text, ticket_id::text, sender_type, sender_user_id::text, body,
            attachment_key, attachment_name, created_at
     FROM support_messages
     WHERE ticket_id = $1::uuid
     ORDER BY created_at ASC`,
    [ticketId],
  );

  return {
    ticket: {
      id: ticket.id,
      userId: ticket.user_id,
      userEmail: ticket.user_email,
      userName: ticket.user_name,
      status: ticket.status,
      createdAt: ticket.created_at instanceof Date ? ticket.created_at.toISOString() : String(ticket.created_at),
      updatedAt: ticket.updated_at instanceof Date ? ticket.updated_at.toISOString() : String(ticket.updated_at),
    },
    messages: messages.map(serializeMessage),
  };
}

export async function addAdminSupportMessage(input: {
  ticketId: string;
  adminUserId: string;
  body: string;
}) {
  const trimmed = input.body.trim();
  if (!trimmed) throw new Error("Reply cannot be empty");

  const ticket = await pool.query<{ id: string; status: string }>(
    `SELECT id::text, status FROM support_tickets WHERE id = $1::uuid`,
    [input.ticketId],
  );
  if (!ticket.rows[0]) throw new Error("Ticket not found");

  const row = await insertMessage({
    ticketId: input.ticketId,
    senderType: "admin",
    senderUserId: input.adminUserId,
    body: trimmed,
  });

  if (ticket.rows[0].status === "open") {
    await pool.query(`UPDATE support_tickets SET status = 'in_progress', updated_at = NOW() WHERE id = $1::uuid`, [
      input.ticketId,
    ]);
  }

  return serializeMessage(row);
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicketStatus) {
  const res = await pool.query(
    `UPDATE support_tickets SET status = $2::text, updated_at = NOW() WHERE id = $1::uuid RETURNING id`,
    [ticketId, status],
  );
  return (res.rowCount ?? 0) > 0;
}
