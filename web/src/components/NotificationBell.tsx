import { apiFetch } from "@/lib/apiBase";
import { usePreferences } from "@/state/PreferencesContext";
import { useAuth } from "@/state/AuthContext";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

const READ_AT_KEY = "oove-notifications-read-at";

export type NotificationItem = {
  id: string;
  at: string;
  title: string;
  message: string;
  category: string;
  status: string;
  href: string;
  isPending: boolean;
};

function readAtStored(): string | null {
  try {
    return localStorage.getItem(READ_AT_KEY);
  } catch {
    return null;
  }
}

function storeReadAt(iso: string) {
  try {
    localStorage.setItem(READ_AT_KEY, iso);
  } catch {
    /* ignore */
  }
}

function categoryIcon(category: string): string {
  switch (category) {
    case "deposit":
      return "↓";
    case "withdrawal":
      return "↑";
    case "borrow":
      return "B";
    case "transfer":
      return "⇄";
    case "fixed_savings":
      return "◆";
    case "identity":
      return "✓";
    default:
      return "•";
  }
}

function stripAdminCopy(text: string): string {
  return text
    .replace(/pending_admin/gi, "pending")
    .replace(/\badmin\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s·\s·/g, " · ")
    .trim();
}

function safeFormatWhen(at: string, formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string): string {
  try {
    return formatDate(at, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    try {
      return new Date(at).toLocaleString();
    } catch {
      return at;
    }
  }
}

/** Map history rows on the client when /api/notifications is not deployed yet. */
function mapHistoryRows(rows: Array<{ id: string; at: string; type: string; status: string; detail: string | null; amount: string | null; asset: string | null; direction: string | null }>): NotificationItem[] {
  return rows.slice(0, 40).map((r) => {
    const st = String(r.status ?? "").toLowerCase();
    const amt = r.amount ? (r.asset && r.asset !== "USD" ? `${r.amount} ${r.asset}` : `$${r.amount}`) : "";
    const pending = ["pending", "pending_review", "pending_admin", "queued", "submitted", "under_review", "processing"].includes(st);
    let title = r.type.replace(/_/g, " ");
    let message = r.detail ?? amt ?? r.status;
    let href = "/history";
    if (r.type === "deposit") {
      title = st === "confirmed" ? "Deposit confirmed" : st === "rejected" ? "Deposit rejected" : "Deposit under review";
      href = st === "confirmed" ? "/history?type=deposit" : "/deposit";
      message = amt ? `${amt} · ${stripAdminCopy(r.status)}` : stripAdminCopy(r.status);
    } else if (r.type === "borrow" || r.type === "borrow_request") {
      title = "Borrow activity";
      href = "/borrow";
    } else if (r.type === "transfer") {
      title = r.direction === "send" ? "Transfer sent" : "Transfer received";
      href = "/transfers";
    } else if (r.type === "fixed_savings") {
      title = st === "matured" ? "Fixed savings matured" : "Fixed savings";
      href = "/fixed-plans?tab=my";
      message = stripAdminCopy(r.detail ?? amt ?? r.status);
    } else if (r.type === "identity") {
      title = st === "approved" ? "Identity verified" : "Identity verification";
      href = "/verify-identity";
    }
    return {
      id: r.id,
      at: r.at,
      title: stripAdminCopy(title),
      message: stripAdminCopy(message),
      category: r.type,
      status: stripAdminCopy(r.status),
      href,
      isPending: pending,
    };
  });
}

async function fetchNotifications(token: string): Promise<{ items: NotificationItem[]; pendingCount: number }> {
  const res = await apiFetch("/api/notifications?limit=40", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: { items: NotificationItem[]; pendingCount: number };
    error?: string;
  };
  if (res.ok && body.data?.items) {
    const items = body.data.items.map((n) => ({
      ...n,
      title: stripAdminCopy(n.title),
      message: stripAdminCopy(n.message),
      status: stripAdminCopy(n.status),
    }));
    return { items, pendingCount: body.data.pendingCount ?? 0 };
  }

  if (res.status === 404) {
    const histRes = await apiFetch("/api/history?page=1&pageSize=40", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const histBody = (await histRes.json().catch(() => ({}))) as {
      data?: { rows: Parameters<typeof mapHistoryRows>[0] };
      error?: string;
    };
    if (!histRes.ok) throw new Error(histBody.error ?? histRes.statusText);
    const items = mapHistoryRows(histBody.data?.rows ?? []);
    return { items, pendingCount: items.filter((i) => i.isPending).length };
  }

  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body.data ?? { items: [], pendingCount: 0 };
}

export function NotificationBell() {
  const { token } = useAuth();
  const { formatDate, t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(() => readAtStored());
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const q = useQuery({
    queryKey: ["notifications", token],
    enabled: !!token,
    queryFn: () => fetchNotifications(token!),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });

  const refresh = useCallback(() => {
    void q.refetch();
  }, [q]);

  useEffect(() => {
    const onRefresh = () => refresh();
    window.addEventListener("oove:notifications-refresh", onRefresh);
    window.addEventListener("oove:deposits-activity-refresh", onRefresh);
    return () => {
      window.removeEventListener("oove:notifications-refresh", onRefresh);
      window.removeEventListener("oove:deposits-activity-refresh", onRefresh);
    };
  }, [refresh]);

  const updatePanelPos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 16, 352);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    setPanelPos({ top: rect.bottom + 8, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPos();
    window.addEventListener("resize", updatePanelPos);
    window.addEventListener("scroll", updatePanelPos, true);
    return () => {
      window.removeEventListener("resize", updatePanelPos);
      window.removeEventListener("scroll", updatePanelPos, true);
    };
  }, [open, updatePanelPos]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const tId = window.setTimeout(() => {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
    }, 0);
    document.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(tId);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const items = q.data?.items ?? [];

  const unreadCount = useMemo(() => {
    const cutoff = readAt ? +new Date(readAt) : 0;
    return items.filter((i) => +new Date(i.at) > cutoff).length;
  }, [items, readAt]);

  function markAllRead() {
    const latest = items[0]?.at ?? new Date().toISOString();
    storeReadAt(latest);
    setReadAt(latest);
  }

  function toggleOpen() {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        updatePanelPos();
        if (items.length > 0) markAllRead();
      }
      return next;
    });
  }

  const panel =
    open && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("shell.notifications")}
            className="fixed z-[200] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{t("shell.notifications")}</p>
              {(q.data?.pendingCount ?? 0) > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  {q.data!.pendingCount} {t("shell.notificationsPending")}
                </span>
              ) : null}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {q.isLoading ? (
                <p className="px-3 py-6 text-center text-xs text-slate-600 dark:text-slate-400">{t("common.loading")}</p>
              ) : q.isError ? (
                <p className="px-3 py-6 text-center text-xs text-red-600 dark:text-red-400">
                  {t("shell.notificationsError")}
                </p>
              ) : items.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-600 dark:text-slate-400">{t("shell.notificationsEmpty")}</p>
              ) : (
                items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.href}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left text-slate-900 no-underline transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800/80",
                      item.isPending && "bg-amber-50/50 dark:bg-amber-950/20",
                    )}
                  >
                    <span
                      className={clsx(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        item.isPending
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                      )}
                      aria-hidden
                    >
                      {categoryIcon(item.category)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                        {item.message}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">
                        {safeFormatWhen(item.at, formatDate)}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
              <Link
                to="/history"
                onClick={() => setOpen(false)}
                className="block text-center text-xs font-semibold text-oove-blue no-underline hover:underline"
              >
                {t("shell.notificationsViewAll")}
              </Link>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={anchorRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("shell.notifications")}
        className="relative rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-oove-blue px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {panel}
    </div>
  );
}
