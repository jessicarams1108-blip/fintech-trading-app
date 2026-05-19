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
  maxTradeUsd: number;
  minWalletDepositUsd?: number;
  msUntilWeekReset: number;
};

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body;
}

async function apiPost<T>(path: string, token: string, payload: unknown): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  return parse<T>(res);
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
  const body = await apiPost<{ data: { balance: number } }>("/api/ai-trading/deposit", token, { amount });
  return body.data.balance;
}

export async function withdrawFromAiWallet(
  token: string,
  amount: number,
): Promise<{ balance: number; cashBoxCreditedUsd: number }> {
  const body = await apiPost<{ data: { balance: number; cashBoxCreditedUsd: number } }>(
    "/api/ai-trading/withdraw",
    token,
    { amount },
  );
  return body.data;
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
  if (trade.status === "running") return "Trading";
  const amt = trade.profit_loss_amount;
  if (trade.result_type === "profit") return `+$${amt.toLocaleString()} Profit`;
  if (trade.result_type === "loss") return `-$${amt.toLocaleString()} Loss`;
  return "Completed";
}
