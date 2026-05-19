import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Headphones, Paperclip, Send } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";
import {
  fetchSupportCapabilities,
  fetchSupportConversation,
  sendSupportMessage,
  uploadSupportAttachment,
  type SupportMessage,
} from "@/lib/supportApi";

function MessageBubble({ msg }: { msg: SupportMessage }) {
  const isUser = msg.senderType === "user";
  const isSystem = msg.senderType === "system";

  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[min(100%,28rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser && "rounded-br-md bg-oove-blue text-white",
          isSystem &&
            "rounded-bl-md border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-oove-card-muted dark:text-slate-100",
          !isUser &&
            !isSystem &&
            "rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-oove-panel dark:text-slate-100",
        )}
      >
        {!isSystem && !isUser ? <p className="mb-1 text-xs font-semibold text-oove-blue">Theoove Support</p> : null}
        <p className="whitespace-pre-wrap">{msg.body}</p>
        {msg.attachmentUrl ? (
          <a
            href={msg.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx("mt-2 inline-flex text-xs font-semibold underline", isUser ? "text-white/90" : "text-oove-blue")}
          >
            {msg.attachmentName ?? "View attachment"}
          </a>
        ) : null}
        <p className={clsx("mt-2 text-[10px]", isUser ? "text-white/70" : "text-slate-400")}>
          {new Date(msg.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function SupportPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const capsQ = useQuery({
    queryKey: ["support", "capabilities", token],
    enabled: !!token,
    queryFn: () => fetchSupportCapabilities(token!),
  });

  const convQ = useQuery({
    queryKey: ["support", "conversation", token],
    enabled: !!token,
    queryFn: () => fetchSupportConversation(token!),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convQ.data?.messages.length]);

  const sendM = useMutation({
    mutationFn: async () => {
      if (!token || !convQ.data) throw new Error("Not ready");
      let attachmentKey: string | undefined;
      let attachmentName: string | undefined;
      if (pendingFile) {
        if (!capsQ.data?.attachments) {
          throw new Error("File uploads are not available. Send a text message or try again later.");
        }
        attachmentKey = await uploadSupportAttachment(token, convQ.data.ticket.id, pendingFile);
        attachmentName = pendingFile.name;
      }
      return sendSupportMessage(token, {
        body: draft,
        attachmentKey,
        attachmentName,
      });
    },
    onSuccess: () => {
      setDraft("");
      setPendingFile(null);
      void qc.invalidateQueries({ queryKey: ["support", "conversation"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const messages = convQ.data?.messages ?? [];

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-3xl flex-col">
      <header className="shrink-0 border-b border-slate-200 pb-4 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-oove-blue/10 text-oove-blue">
            <Headphones className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Customer support</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Theoove Support · We typically reply within one business day
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        {convQ.isLoading ? (
          <p className="text-center text-sm text-slate-500">Loading conversation…</p>
        ) : convQ.isError ? (
          <p className="text-center text-sm text-red-600">{(convQ.error as Error).message}</p>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-slate-200 pt-4 dark:border-slate-700">
        {pendingFile ? (
          <p className="mb-2 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-oove-card-muted">
            <span className="truncate font-medium text-slate-700 dark:text-slate-200">{pendingFile.name}</span>
            <button type="button" className="text-red-600" onClick={() => setPendingFile(null)}>
              Remove
            </button>
          </p>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim() && !pendingFile) return;
            sendM.mutate();
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPendingFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-oove-card-muted"
            onClick={() => fileRef.current?.click()}
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Describe your issue…"
            className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-oove-blue dark:border-slate-600 dark:bg-oove-panel dark:text-white"
          />
          <button
            type="submit"
            disabled={sendM.isPending || (!draft.trim() && !pendingFile)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-oove-blue text-white disabled:opacity-50"
            title="Send"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
