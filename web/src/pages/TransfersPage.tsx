import { apiFetch } from "@/lib/apiBase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
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

export function TransfersPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"deposit" | "withdraw" | "send" | "receive">("deposit");
  const [asset, setAsset] = useState("BTC");
  const [depAddr, setDepAddr] = useState<string | null>(null);
  const [wdAmount, setWdAmount] = useState("");
  const [wdDest, setWdDest] = useState("");
  const [sendEmail, setSendEmail] = useState("");
  const [sendAmt, setSendAmt] = useState("");
  const [sendAsset, setSendAsset] = useState("USDT");

  const [plannedDeposit, setPlannedDeposit] = useState("");

  const transferReq = useQuery({
    queryKey: ["transfers", "my-transfer-requests", token],
    enabled: !!token,
    queryFn: () =>
      authFetch<{ data: { id: string; asset: string; amount: string; status: string; created_at: string }[] }>(
        "/api/transfers/my-transfer-requests",
        token!,
      ).then((r) => r.data),
  });

  const hist = useQuery({
    queryKey: ["transfers", "history", token],
    enabled: !!token,
    queryFn: () => authFetch<{ data: { withdrawals: unknown[] } }>("/api/transfers/history", token!),
  });

  async function loadDepositAddr() {
    if (!token) return;
    try {
      const r = await authFetch<{ data: { address: string } }>(
        `/api/transfers/deposit/address?asset=${encodeURIComponent(asset)}`,
        token,
      );
      setDepAddr(r.data.address);
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  const wdMut = useMutation({
    mutationFn: async () => {
      if (!token) return;
      await authFetch("/api/transfers/withdraw", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, amount: Number(wdAmount), destination: wdDest }),
      });
    },
    onSuccess: () => {
      showToast("Withdrawal queued for admin review");
      void qc.invalidateQueries({ queryKey: ["transfers", "history"] });
    },
    onError: (e: Error) => showToast(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!token) return;
      await authFetch("/api/transfers/send", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: sendEmail, asset: sendAsset, amount: Number(sendAmt) }),
      });
    },
    onSuccess: () => {
      showToast("Internal transfer queued for admin approval");
      void qc.invalidateQueries({ queryKey: ["transfers", "history"] });
      void qc.invalidateQueries({ queryKey: ["transfers", "my-transfer-requests"] });
    },
    onError: (e: Error) => showToast(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Transfers</h1>
        <p className="mt-2 text-slate-600">Deposit, withdraw, or send to another Oove user. Withdrawals and internal sends are released after administrator approval.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(["deposit", "withdraw", "send", "receive"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              if (t === "deposit") void loadDepositAddr();
            }}
            className={
              tab === t
                ? "rounded-full bg-oove-blue px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            }
          >
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "deposit" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <label className="text-sm font-medium">Asset</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          >
            {["BTC", "ETH", "USDT", "USDC", "DAI"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <p className="text-sm text-slate-600">
            For credited USD on-chain deposits, use <strong>Supply</strong> and declare the amount there (minimum applies). You can note how much you plan to send here for your own records.
          </p>
          <label className="text-sm font-medium text-slate-700">Planned amount (optional, not submitted)</label>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
            placeholder="e.g. 500 USDT"
            value={plannedDeposit}
            onChange={(e) => setPlannedDeposit(e.target.value)}
          />
          <button type="button" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => void loadDepositAddr()}>
            Show treasury address
          </button>
          {depAddr ? (
            <div className="flex flex-col items-center gap-4 pt-4">
              <QRCodeSVG value={depAddr} size={180} />
              <p className="break-all font-mono text-sm text-center">{depAddr}</p>
              <p className="text-xs text-amber-700">Preview address. Use Supply flow to submit proofs for credit.</p>
            </div>
          ) : null}
        </div>
      )}

      {tab === "withdraw" && (
        <form
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            wdMut.mutate();
          }}
        >
          <h2 className="font-semibold text-slate-900">Request withdrawal</h2>
          <select className="w-full rounded-xl border px-3 py-2" value={asset} onChange={(e) => setAsset(e.target.value)}>
            {["BTC", "ETH", "USDT", "USDC", "DAI"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input className="w-full rounded-xl border px-3 py-2" placeholder="Amount" value={wdAmount} onChange={(e) => setWdAmount(e.target.value)} />
          <input className="w-full rounded-xl border px-3 py-2" placeholder="Destination address" value={wdDest} onChange={(e) => setWdDest(e.target.value)} />
          <p className="text-sm text-slate-500">Fee: $0 · ETA after approval: 1–24h</p>
          <button type="submit" disabled={wdMut.isPending} className="w-full rounded-xl bg-oove-blue py-2 font-semibold text-white disabled:opacity-50">
            {wdMut.isPending ? "Submitting…" : "Request withdrawal"}
          </button>
        </form>
      )}

      {tab === "send" && (
        <form
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            sendMut.mutate();
          }}
        >
          <h2 className="font-semibold text-slate-900">Send to Oove user</h2>
          <input className="w-full rounded-xl border px-3 py-2" placeholder="Recipient email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} />
          <select className="w-full rounded-xl border px-3 py-2" value={sendAsset} onChange={(e) => setSendAsset(e.target.value)}>
            {["USDT", "USDC", "DAI", "ETH", "BTC"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input className="w-full rounded-xl border px-3 py-2" placeholder="Amount" value={sendAmt} onChange={(e) => setSendAmt(e.target.value)} />
          <button type="submit" disabled={sendMut.isPending} className="w-full rounded-xl bg-slate-900 py-2 font-semibold text-white disabled:opacity-50">
            {sendMut.isPending ? "Submitting…" : "Submit transfer request"}
          </button>
        </form>
      )}

      {tab === "receive" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-slate-700">Generate a deposit address for an asset (same treasury routing as Deposit tab).</p>
          <select className="w-full rounded-xl border px-3 py-2" value={asset} onChange={(e) => setAsset(e.target.value)}>
            {["BTC", "ETH", "USDT"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button type="button" className="rounded-xl border px-4 py-2 text-sm font-semibold" onClick={() => void loadDepositAddr()}>
            Show address
          </button>
          {depAddr ? <p className="font-mono text-sm break-all">{depAddr}</p> : null}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Internal transfer requests</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {(transferReq.data ?? []).length === 0 ? (
            <li>No transfer requests yet.</li>
          ) : (
            (transferReq.data ?? []).map((t) => (
              <li key={t.id}>
                {t.asset} {t.amount} — <span className="font-medium">{t.status}</span> · {new Date(t.created_at).toLocaleString()}
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Recent withdrawal requests</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {(hist.data?.data.withdrawals as { id: string; status: string; amount: string; asset: string }[] | undefined)?.map((w) => (
            <li key={w.id}>
              {w.asset} {w.amount} — <span className="font-medium">{w.status}</span>
            </li>
          )) ?? <li>No withdrawals yet.</li>}
        </ul>
      </div>
    </div>
  );
}
