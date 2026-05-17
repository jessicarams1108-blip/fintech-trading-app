import { apiFetch } from "@/lib/apiBase";

export type AiTrade = {
  id: string;
  asset: string;
  asset_class: string;
  amount: number;
  result_type: "profit" | "loss" | null;
  profit_loss_amount: number;
  status: "running" | "completed";
  start_time: string;
  end_time: string | null;
  user_email?: string;
};

export type AiBalance = {
  balance: number;
  tradesThisWeek: number;
  maxTradesPerWeek: number;
  canTrade: boolean;
  minTradeUsd: number;
  msUntilWeekReset: number;
};

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body;
}

export async function fetchAiBalance(token: string): Promise<AiBalance> {
  const res = await apiFetch("/api/ai-trading/balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parse<{ data: AiBalance }>(res);
  return body.data;
}

export async function fetchAiHistory(token: string): Promise<AiTrade[]> {
  const res = await apiFetch("/api/ai-trading/history", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parse<{ data: AiTrade[] }>(res);
  return body.data;
}

export async function startAiTrade(
  token: string,
  payload: { asset: string; amount: number; asset_class?: string },
): Promise<AiTrade> {
  const res = await apiFetch("/api/ai-trading/start-trade", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parse<{ data: AiTrade }>(res);
  return body.data;
}

export async function depositToAiWallet(token: string, amount: number): Promise<number> {
  const res = await apiFetch("/api/ai-trading/deposit", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  const body = await parse<{ data: { balance: number } }>(res);
  return body.data.balance;
}

export async function adminListAiTrades(token: string, status: string): Promise<AiTrade[]> {
  const res = await apiFetch(`/api/admin/ai-trading/trades?status=${encodeURIComponent(status)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parse<{ data: AiTrade[] }>(res);
  return body.data;
}

export async function adminSetAiResult(
  token: string,
  payload: { trade_id: string; result_type: "profit" | "loss"; profit_loss_amount: number },
): Promise<AiTrade> {
  const res = await apiFetch("/api/admin/ai-trading/set-result", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parse<{ data: AiTrade }>(res);
  return body.data;
}

export function formatTradeResult(trade: AiTrade): string {
  if (trade.status === "running") return "In progress";
  const amt = trade.profit_loss_amount;
  if (trade.result_type === "profit") return `+$${amt.toLocaleString()} Profit`;
  if (trade.result_type === "loss") return `-$${amt.toLocaleString()} Loss`;
  return "Completed";
}
