import { apiFetch } from "@/lib/apiBase";

export type FixedPlan = {
  id: string;
  name: string;
  rate: string;
  min_days: number;
  max_days: number;
  min_amount: string;
  max_amount: string;
  status: string;
  sort_order: number;
};

export type FixedSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  amount: string;
  days: number;
  start_date: string;
  end_date: string;
  interest_earned: string;
  accrued_interest?: string;
  last_interest_credit_at?: string | null;
  status: string;
  total_payout?: number;
  goal_name: string | null;
  auto_renewal: boolean;
  disable_interest: boolean;
  created_at: string;
  plan_name: string;
  rate: string;
  plan_min_days?: number;
  user_email?: string;
};

async function authJson<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers as object) },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body.data as T;
}

export function fetchFixedPlans(token: string) {
  return authJson<FixedPlan[]>("/api/fixed-plans", token);
}

export function fetchFixedPlan(token: string, planId: string) {
  return authJson<FixedPlan>(`/api/fixed-plans/${planId}`, token);
}

export function fetchMyFixedPlans(token: string) {
  return authJson<FixedSubscription[]>("/api/fixed-plans/my-plans", token);
}

export function fetchFixedSavingsSummary(token: string) {
  return authJson<{ activeTotalUsd: number }>("/api/fixed-plans/summary", token);
}

export function fetchCashBoxBalance(token: string) {
  return authJson<{ cashBoxUsd: number; currency: string }>("/api/wallet/balance", token);
}

export function withdrawFixedPlan(token: string, subscriptionId: string) {
  return authJson<{ payout: number; subscription: FixedSubscription }>("/api/fixed-plans/withdraw", token, {
    method: "POST",
    body: JSON.stringify({ subscription_id: subscriptionId }),
  });
}

export function subscribeFixedPlan(
  token: string,
  body: {
    plan_id: string;
    amount: number;
    days: number;
    goal_name?: string;
    auto_renewal: boolean;
    disable_interest: boolean;
  },
) {
  return authJson<FixedSubscription>("/api/fixed-plans/subscribe", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchAdminFixedSubscriptions(
  token: string,
  params: { status?: string; userId?: string; from?: string; to?: string },
) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.userId) q.set("userId", params.userId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  const qs = q.toString();
  return authJson<FixedSubscription[]>(`/api/admin/fixed-savings${qs ? `?${qs}` : ""}`, token);
}

export function matureAdminSubscription(token: string, id: string, action: "payout" | "renew") {
  return authJson<FixedSubscription>(`/api/admin/fixed-savings/${id}/mature`, token, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
