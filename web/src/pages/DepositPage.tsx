import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiBase";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import type { AssetSymbol, DepositStatus } from "@/types";
import { offlineDepositConfig } from "@/lib/offlineDepositConfig";
import { uploadDepositProofIfConfigured } from "@/lib/depositProofUpload";
import { useAuth } from "@/state/AuthContext";
import { DepositUsdAmountPicker } from "@/components/DepositUsdAmountPicker";

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
        const res = await apiFetch(`/api/deposit/config?asset=${encodeURIComponent(asset)}`);
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

  const priceQ = useQuery({
    queryKey: ["market", "price", asset],
    queryFn: async () => {
      const res = await apiFetch(`/api/market/price?symbol=${encodeURIComponent(asset)}`);
      const body = (await res.json().catch(() => ({}))) as { data?: { priceUsd?: number }; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Price unavailable");
      const px = body.data?.priceUsd;
      if (typeof px !== "number" || !Number.isFinite(px) || px <= 0) throw new Error("Price unavailable");
      return px;
    },
    staleTime: 20_000,
    refetchInterval: 35_000,
  });

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
        description: "We are verifying your transfer and proof.",
      },
      {
        key: "confirmed",
        label: "Confirmed",
        description: "Balance credited; you will get a notification.",
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
    const minDec = Math.max(config?.minDeclaredUsd ?? MIN_DEPOSIT_USD, MIN_DEPOSIT_USD);
    if (!Number.isFinite(declared) || declared < minDec) {
      setError(`Declare at least $${minDec.toLocaleString("en-US")} USD for this deposit (policy).`);
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

      const res = await apiFetch("/api/deposit/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset,
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
        <h1 className="text-3xl font-semibold text-slate-900">Crypto deposit</h1>
        <p className="mt-2 text-slate-600">
          Each supply submission must declare at least{" "}
          <span className="font-semibold text-slate-900">
            ${(config?.minDeclaredUsd ?? MIN_DEPOSIT_USD).toLocaleString("en-US")} USD
          </span>{" "}
          equivalent for that transfer. Borrowing is a separate step: you need a cumulative{" "}
          <span className="font-semibold text-slate-900">$10,000</span> supplied (USD equivalent) plus verified identity
          before you can borrow — see the Home checklist.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {config?.network ? (
            <>
              Network: <span className="font-semibold text-slate-900">{config.network}</span>
              {" · "}
            </>
          ) : null}
          <span>{summaryParagraph}</span> Allow up to <span className="font-semibold text-slate-800">30 minutes</span>{" "}
          for confirmations.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="text-sm font-medium text-slate-700">Asset</label>
        <select
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-lg font-semibold text-slate-900 shadow-inner"
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

      {step !== "pending_review" ? (
        <DepositUsdAmountPicker
          minUsd={Math.max(config?.minDeclaredUsd ?? MIN_DEPOSIT_USD, MIN_DEPOSIT_USD)}
          value={declaredUsd}
          onChange={setDeclaredUsd}
          assetSymbol={asset}
          spotUsdPerUnit={priceQ.data ?? null}
          spotError={priceQ.isError}
        />
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Status</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {tracker.map((t, idx) => {
            const completed = milestoneIndex > idx && milestoneIndex >= 0;
            const active =
              milestoneIndex === idx ||
              (step === "form" && t.key === "awaiting_payment" && milestoneIndex <= 0);
            return (
              <li
                key={t.key}
                className={
                  completed
                    ? "rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm"
                    : active
                      ? "rounded-xl border-2 border-oove-blue bg-blue-50/80 p-4 shadow-sm ring-2 ring-oove-blue/15"
                      : "rounded-xl border border-slate-200 bg-slate-50/80 p-4"
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      completed
                        ? "inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
                        : active
                          ? "inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-oove-blue"
                          : "inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300"
                    }
                  />
                  <p className="font-semibold text-slate-900">{t.label}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.description}</p>
              </li>
            );
          })}
        </ol>
      </div>

      {showQr && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-6 shadow-sm">
            <div className="flex flex-col items-center gap-4">
              {address ? (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <QRCodeSVG value={address} size={192} bgColor="#ffffff" fgColor="#0f172a" />
                  </div>
                  <div className="w-full rounded-xl border border-slate-200 bg-white p-4 text-center font-mono text-sm break-all text-slate-900">
                    {address}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600">Waiting for treasury configuration…</p>
              )}
              <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                {config?.note ??
                  `Only send ${asset} on the advertised network — never mix networks or unrelated assets.`}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {step === "awaiting_payment" && (
              <button
                type="button"
                className="w-full rounded-2xl bg-oove-blue px-4 py-3 text-lg font-semibold text-white shadow-md shadow-oove-blue/25 transition hover:brightness-105"
                onClick={() => setStep("form")}
              >
                I’ve made the payment
              </button>
            )}
            {step === "form" && (
              <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={submitProof}>
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Declaring{" "}
                  <span className="font-semibold tabular-nums text-slate-900">${declaredUsd}</span> USD equivalent · adjust
                  amount above if needed.
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-800">Proof file</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="mt-2 w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-800"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {proofFile ? (
                      <>
                        Selected: <span className="font-mono">{proofFile.name}</span> — when object storage is
                        configured, this uploads before submit; otherwise only the file name is stored for review.
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
                  className="w-full rounded-xl bg-oove-blue py-3 font-semibold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!token ? "Sign in to submit proofs" : submitting ? "Submitting…" : "Submit for review"}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-slate-600 underline hover:text-slate-900"
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
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-blue-950 shadow-sm">
          <p className="font-semibold text-blue-950">Proof received</p>
          <p className="mt-2 text-sm leading-relaxed text-blue-900/90">
            Your submission is in the queue. We reconcile transfers against your proof and notify you by WebSocket and
            email/SMS once your balance is credited.
          </p>
        </div>
      )}
    </div>
  );
}
