import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import type { AssetSymbol, DepositStatus } from "@/types";
import { offlineDepositConfig } from "@/lib/offlineDepositConfig";
import { validateTxHash } from "@/lib/validators";
import { uploadDepositProofIfConfigured } from "@/lib/depositProofUpload";
import { useAuth } from "@/state/AuthContext";

const DEFAULT_ASSETS: AssetSymbol[] = ["BTC", "ETH", "USDT"];

type Step = DepositStatus | "form";

type DepositConfigPayload = {
  address: string;
  network: string;
  note?: string;
  minDeclaredUsd?: number;
};

const MIN_DEPOSIT_USD = 100;

export function DepositPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [asset, setAsset] = useState<AssetSymbol>("BTC");
  const [step, setStep] = useState<Step>("awaiting_payment");
  const [txHash, setTxHash] = useState("");
  const [declaredUsd, setDeclaredUsd] = useState("100");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<DepositConfigPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      setConfig(null);
      try {
        const res = await fetch(`/api/deposit/config?asset=${encodeURIComponent(asset)}`);
        if (!res.ok) {
          const message = await res.text();
          throw new Error(message);
        }
        const body = (await res.json()) as DepositConfigPayload;
        if (!cancelled) {
          setConfig(body);
        }
      } catch {
        if (!cancelled) {
          setConfig(offlineDepositConfig(asset));
        }
      }
    }
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [asset]);

  const address = config?.address ?? "";

  const tracker = useMemo(
    () => [
      {
        key: "awaiting_payment",
        label: "Awaiting payment",
        description: "Send funds to the address below.",
      },
      {
        key: "pending_review",
        label: "Pending review",
        description: "Ops is verifying your transaction.",
      },
      {
        key: "confirmed",
        label: "Confirmed",
        description: "Balance credited and notification sent.",
      },
    ],
    [],
  );

  const milestoneIndex =
    step === "pending_review"
      ? 1
      : step === "confirmed"
        ? 2
        : step === "form" || step === "awaiting_payment"
          ? 0
          : -1;

  async function submitProof(ev: FormEvent) {
    ev.preventDefault();
    if (!token) {
      navigate("/login");
      return;
    }

    setError(null);
    const declared = Number.parseFloat(declaredUsd);
    if (!Number.isFinite(declared) || declared < MIN_DEPOSIT_USD) {
      setError(`Declare at least $${MIN_DEPOSIT_USD} USD for this deposit (policy).`);
      return;
    }
    const v = validateTxHash(asset, txHash);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setSubmitting(true);
    try {
      let depositProofKey: string | undefined;
      let screenshotFileName: string | undefined;

      if (proofFile) {
        const uploadedKey = await uploadDepositProofIfConfigured(token, proofFile);
        if (uploadedKey) depositProofKey = uploadedKey;
        else screenshotFileName = proofFile.name;
      }

      const res = await fetch("/api/deposit/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset,
          txHash: txHash.trim(),
          declaredAmountUsd: declared,
          ...(depositProofKey ? { depositProofKey } : screenshotFileName ? { screenshotFileName } : {}),
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? body?.message ?? "Submission failed");
      }
      setProofFile(null);
      setStep("pending_review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submit failed";
      if (/fetch|network|failed to load|load failed/i.test(msg)) {
        setError(
          "Backend is offline. Start it from the project folder: npm run dev:server (needs .env). You can still preview the deposit screens above.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const showQr = step === "awaiting_payment" || step === "form";

  const summaryParagraph = useMemo(() => {
    if (config?.note) return config.note;
    return `Send only the selected asset (${asset}). Wrong transfers may be lost.`;
  }, [asset, config?.note]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-500">Funding</p>
        <h1 className="text-3xl font-semibold">Crypto deposit</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Each supply submission must declare at least{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-50">
            ${(config?.minDeclaredUsd ?? MIN_DEPOSIT_USD).toLocaleString("en-US")} USD
          </span>{" "}
          equivalent for that transfer. Borrowing is a separate step: you need a cumulative{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-50">$10,000</span> supplied (USD equivalent) plus
          verified identity before you can borrow — see the Home checklist.
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {config?.network ? (
            <>
              Network:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-50">{config.network}</span>
              {" · "}
            </>
          ) : null}
          <span>{summaryParagraph}</span> Allow up to <span className="font-semibold">30 minutes</span> for
          confirmations.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Asset</label>
        <select
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-lg font-semibold dark:border-slate-700 dark:bg-slate-950"
          value={asset}
          onChange={(ev) => setAsset(ev.target.value as AssetSymbol)}
        >
          {DEFAULT_ASSETS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Status</h2>
        <ol className="mt-4 space-y-4">
          {tracker.map((t, idx) => {
            const completed = milestoneIndex > idx && milestoneIndex >= 0;
            const active =
              milestoneIndex === idx ||
              (step === "form" && t.key === "awaiting_payment" && milestoneIndex <= 0);
            return (
              <li key={t.key} className="flex gap-4">
                <div
                  className={
                    completed
                      ? "mt-1 h-3 w-3 rounded-full bg-emerald-500"
                      : active
                        ? "mt-1 h-3 w-3 rounded-full bg-accent ring-4 ring-accent/30"
                        : "mt-1 h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-700"
                  }
                />
                <div>
                  <p className="font-semibold">{t.label}</p>
                  <p className="text-sm text-slate-500">{t.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {showQr && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col items-center gap-4">
              {address ? (
                <>
                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    <QRCodeSVG value={address} size={192} bgColor="#ffffff" fgColor="#0f172a" />
                  </div>
                  <div className="w-full rounded-xl bg-white p-4 text-center font-mono text-sm break-all dark:bg-slate-900">
                    {address}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Waiting for treasury configuration…
                </p>
              )}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50">
                {config?.note ??
                  `Only send ${asset} on the advertised network — never mix networks or unrelated assets.`}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {step === "awaiting_payment" && (
              <button
                type="button"
                className="w-full rounded-2xl bg-accent px-4 py-3 text-lg font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600"
                onClick={() => setStep("form")}
              >
                I’ve made the payment
              </button>
            )}
            {step === "form" && (
              <form
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                onSubmit={submitProof}
              >
                <div>
                  <label className="text-sm font-medium">Declared amount (USD)</label>
                  <input
                    type="number"
                    min={MIN_DEPOSIT_USD}
                    step="0.01"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950"
                    value={declaredUsd}
                    onChange={(e) => setDeclaredUsd(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">Minimum ${MIN_DEPOSIT_USD} per deposit declaration.</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Transaction hash / ID</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                    placeholder={asset === "BTC" ? "64 hex chars" : "0x + 64 hex"}
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Proof file (optional)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="mt-2 w-full text-sm"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {proofFile ? (
                      <>
                        Selected: <span className="font-mono">{proofFile.name}</span> — when the server has object
                        storage configured, this file is uploaded before submit; otherwise only the file name is sent
                        for demo review.
                      </>
                    ) : (
                      "Attach a receipt screenshot or PDF if you have one."
                    )}
                  </p>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || !token}
                  className="w-full rounded-xl bg-accent py-3 font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!token ? "Sign in to submit proofs" : submitting ? "Submitting…" : "Submit for review"}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-slate-500 underline"
                  onClick={() => setStep("awaiting_payment")}
                >
                  Back
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {step === "pending_review" && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-50">
          Your proof is queued. Ops will reconcile on‑chain movement and notify you via WebSocket + email/SMS once the
          balance is credited.
        </div>
      )}
    </div>
  );
}
