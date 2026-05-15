import { apiFetch } from "@/lib/apiBase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";

async function authFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers as object) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

type Row = { symbol: string; priceUsd: number; change24hPct: number; addedAt: string };

export function WatchlistPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [sym, setSym] = useState("");

  const q = useQuery({
    queryKey: ["watchlist", token],
    enabled: !!token,
    queryFn: () => authFetch<{ data: Row[] }>("/api/watchlist", token!).then((r) => r.data),
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!token) return;
      await authFetch("/api/watchlist/add", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym }),
      });
    },
    onSuccess: () => {
      setSym("");
      void qc.invalidateQueries({ queryKey: ["watchlist"] });
    },
    onError: (e: Error) => showToast(e.message),
  });

  const remove = useMutation({
    mutationFn: async (symbol: string) => {
      if (!token) return;
      await authFetch(`/api/watchlist/${encodeURIComponent(symbol)}`, token, { method: "DELETE" });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["watchlist"] }),
    onError: (e: Error) => showToast(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Watchlist</h1>
        <p className="mt-2 text-slate-600">Track symbols; prices refresh with the market feed (REST + Socket broadcast).</p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <input
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2"
          placeholder="Add symbol (e.g. BTC)"
          value={sym}
          onChange={(e) => setSym(e.target.value.toUpperCase())}
        />
        <button type="submit" disabled={add.isPending} className="rounded-xl bg-oove-blue px-5 py-2 font-semibold text-white disabled:opacity-50">
          Add
        </button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((r) => (
          <div key={r.symbol} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold text-slate-900">{r.symbol}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
                  ${r.priceUsd.toLocaleString(undefined, { maximumFractionDigits: r.priceUsd < 1 ? 4 : 2 })}
                </p>
                <p className="text-xs text-slate-500">24h Δ: {r.change24hPct.toFixed(2)}%</p>
              </div>
              <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => remove.mutate(r.symbol)}>
                Remove
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">Added {new Date(r.addedAt).toLocaleString()}</p>
          </div>
        ))}
        {!q.isLoading && (q.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500">Your watchlist is empty.</p>
        ) : null}
      </div>
    </div>
  );
}
