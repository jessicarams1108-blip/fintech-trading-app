import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import {
  adminFetchSupportTicket,
  adminListSupportTickets,
  adminReplySupport,
  adminUpdateTicketStatus,
  type SupportMessage,
} from "@/lib/supportApi";

const STATUS_FILTERS = ["open", "in_progress", "resolved", "closed", "all"] as const;

function AdminMessage({ msg }: { msg: SupportMessage }) {
  const isAdmin = msg.senderType === "admin";
  const isUser = msg.senderType === "user";
  return (
    <div className={clsx("flex", isAdmin ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[min(100%,32rem)] rounded-2xl px-4 py-3 text-sm shadow-sm",
          isAdmin && "bg-oove-blue text-white",
          isUser && "border border-slate-200 bg-white dark:border-slate-600 dark:bg-oove-panel",
          msg.senderType === "system" && "border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-oove-card-muted",
        )}
      >
        <p className="mb-1 text-xs font-semibold opacity-80">
          {isAdmin ? "You (Support)" : isUser ? "Customer" : "Theoove"}
        </p>
        <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
        {msg.attachmentUrl ? (
          <a
            href={msg.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx("mt-2 block text-xs font-semibold underline", isAdmin ? "text-white/90" : "text-oove-blue")}
          >
            {msg.attachmentName ?? "Attachment"}
          </a>
        ) : null}
        <p className="mt-2 text-[10px] opacity-70">{new Date(msg.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

export function AdminSupportPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const listQ = useQuery({
    queryKey: ["admin", "support", statusFilter, token],
    enabled: !!token,
    queryFn: () => adminListSupportTickets(token!, statusFilter),
    refetchInterval: 15_000,
  });

  const ticketQ = useQuery({
    queryKey: ["admin", "support", "ticket", selectedId, token],
    enabled: !!token && !!selectedId,
    queryFn: () => adminFetchSupportTicket(token!, selectedId!),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!selectedId && listQ.data?.[0]) setSelectedId(listQ.data[0].id);
  }, [listQ.data, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticketQ.data?.messages.length]);

  const replyM = useMutation({
    mutationFn: () => adminReplySupport(token!, selectedId!, reply),
    onSuccess: () => {
      setReply("");
      void qc.invalidateQueries({ queryKey: ["admin", "support"] });
      showToast("Reply sent");
    },
    onError: (e: Error) => showToast(e.message),
  });

  const statusM = useMutation({
    mutationFn: (status: string) => adminUpdateTicketStatus(token!, selectedId!, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "support"] });
      showToast("Status updated");
    },
    onError: (e: Error) => showToast(e.message),
  });

  const ticket = ticketQ.data?.ticket;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Support tickets</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Review and respond to customer help requests.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-semibold capitalize",
              statusFilter === s
                ? "bg-oove-blue text-white"
                : "border border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300",
            )}
          >
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-oove-panel">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700">
            Tickets
          </p>
          <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
            {(listQ.data ?? []).length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">No tickets in this queue.</li>
            ) : (
              (listQ.data ?? []).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={clsx(
                      "w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-oove-card-muted",
                      selectedId === t.id && "bg-slate-100 dark:bg-oove-card-muted",
                    )}
                  >
                    <p className="font-semibold text-slate-900 dark:text-white">{t.userName}</p>
                    <p className="text-xs text-slate-500">{t.userEmail}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {t.lastMessagePreview ?? "—"}
                    </p>
                    <p className="mt-1 text-[10px] font-medium uppercase text-oove-blue">{t.status.replace(/_/g, " ")}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-oove-panel">
          {!selectedId || !ticket ? (
            <p className="m-auto text-sm text-slate-500">Select a ticket to view the conversation.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{ticket.userName}</p>
                  <p className="text-xs text-slate-500">{ticket.userEmail}</p>
                </div>
                <select
                  value={ticket.status}
                  onChange={(e) => statusM.mutate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-oove-card-muted dark:text-white"
                >
                  {STATUS_FILTERS.filter((s) => s !== "all").map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {(ticketQ.data?.messages ?? []).map((m) => (
                  <AdminMessage key={m.id} msg={m} />
                ))}
                <div ref={bottomRef} />
              </div>

              <form
                className="border-t border-slate-100 p-4 dark:border-slate-700"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reply.trim()) return;
                  replyM.mutate();
                }}
              >
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="Type your reply to the customer…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-oove-card-muted dark:text-white"
                />
                <button
                  type="submit"
                  disabled={replyM.isPending || !reply.trim()}
                  className="mt-2 w-full rounded-xl bg-oove-blue py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {replyM.isPending ? "Sending…" : "Send reply"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
