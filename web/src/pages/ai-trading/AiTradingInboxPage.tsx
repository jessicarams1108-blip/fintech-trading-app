import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiBase";
import { useAuth } from "@/state/AuthContext";
import { fetchAiHistory, formatTradeResult, type AiTrade } from "@/lib/aiTradingApi";
import { AiTradingTopBar } from "@/components/ai-trading/AiTradingTopBar";
import { ai } from "@/lib/aiTradingTheme";

type NotificationItem = {
  id: string;
  at: string;
  title: string;
  message: string;
  href: string;
  isPending: boolean;
};

function sanitizeText(text: string): string {
  return text.replace(/\badmin\b/gi, "").replace(/\s{2,}/g, " ").replace(/\s·\s·/g, " · ").trim();
}

function tradeToInboxItem(t: AiTrade): NotificationItem {
  const running = t.status === "running";
  return {
    id: `ai-${t.id}`,
    at: t.end_time ?? t.start_time,
    title: running ? "AI trade in progress" : t.result_type === "profit" ? "AI trade profit" : "AI trade closed",
    message: sanitizeText(
      running
        ? `${t.asset} · $${t.amount.toLocaleString()} — your agent is trading`
        : `${t.asset} · ${formatTradeResult(t)}`,
    ),
    href: `/ai-trading/trade/${t.id}`,
    isPending: running,
  };
}

async function fetchPlatformNotifications(token: string): Promise<NotificationItem[]> {
  const res = await apiFetch("/api/notifications?limit=30", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const body = (await res.json()) as {
      data?: { items: Array<{ id: string; at: string; title: string; message: string; href: string; isPending: boolean }> };
    };
    return (body.data?.items ?? []).map((n) => ({
      ...n,
      title: sanitizeText(n.title),
      message: sanitizeText(n.message),
    }));
  }
  return [];
}

export function AiTradingInboxPage() {
  const { token } = useAuth();

  const tradesQ = useQuery({
    queryKey: ["ai-history", token],
    enabled: !!token,
    queryFn: () => fetchAiHistory(token!),
    refetchInterval: 15_000,
  });

  const notifQ = useQuery({
    queryKey: ["notifications", token],
    enabled: !!token,
    queryFn: () => fetchPlatformNotifications(token!),
  });

  const items = useMemo(() => {
    const tradeItems = (tradesQ.data ?? []).map(tradeToInboxItem);
    const platform = notifQ.data ?? [];
    const merged = [...tradeItems, ...platform];
    merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const seen = new Set<string>();
    return merged.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
  }, [tradesQ.data, notifQ.data]);

  return (
    <div className="ai-trading-page pb-6">
      <AiTradingTopBar title="Inbox" />

      <div className="mt-2 px-4">
        {tradesQ.isLoading && notifQ.isLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No messages yet. Start trading with your agent to see updates here.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl overflow-hidden" style={{ backgroundColor: ai.card }}>
            {items.map((item) => (
              <li key={item.id}>
                <Link to={item.href} className="flex flex-col gap-1 px-4 py-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    {item.isPending ? (
                      <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-500">{item.message}</p>
                  <p className="text-[10px] text-slate-400">{new Date(item.at).toLocaleString()}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

