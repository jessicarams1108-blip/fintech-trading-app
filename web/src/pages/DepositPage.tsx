import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiBase";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import clsx from "clsx";
import { Copy, Check } from "lucide-react";
import type { AssetSymbol } from "@/types";
import { offlineDepositConfig } from "@/lib/offlineDepositConfig";
import {
  BUY_CRYPTO_PLATFORMS,
  DEPOSIT_ASSETS,
  MAX_DEPOSIT_USD,
  MIN_DEPOSIT_USD,
  depositStepsForAsset,
} from "@/lib/depositConstants";
import { marketSpotPriceQueryOptions } from "@/lib/marketSpotPrice";
import { uploadDepositProofIfConfigured } from "@/lib/depositProofUpload";
import { useAuth } from "@/state/AuthContext";
import { DepositUsdAmountPicker } from "@/components/DepositUsdAmountPicker";

type FlowStep = "asset" | "amount" | "wallet" | "proof" | "pending_review";

type DepositConfigPayload = {
  address: string;
  network: string;
  note?: string;
  minDeclaredUsd?: number;
  maxDeclaredUsd?: number;
};

export function DepositPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [asset, setAsset] = useState<AssetSymbol>("BTC");
  const [flowStep, setFlowStep] = useState<FlowStep>("asset");
  const [declaredUsd, setDeclaredUsd] = useState("100");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<DepositConfigPayload | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (flowStep === "asset") return;
    let cancelled = false;
    async function loadConfig() {
      setConfig(null);
      try {
        const res = await apiFetch(`/api/deposit/config?asset=${encodeURIComponent(asset)}`);
        if (!res.ok) throw new Error(await res.text());
        const body = (await res.json()) as DepositConfigPayload;
        if (!cancelled) setConfig(body);
      } catch {
        if (!cancelled) setConfig(offlineDepositConfig(asset));
      }
    }
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [asset, flowStep]);

  const priceQ = useQuery({
    ...marketSpotPriceQueryOptions(asset),
    enabled: flowStep !== "asset",
  });

  const minUsd = Math.max(config?.minDeclaredUsd ?? MIN_DEPOSIT_USD, MIN_DEPOSIT_USD);
  const maxUsd = config?.maxDeclaredUsd ?? MAX_DEPOSIT_USD;
  const address = config?.address ?? "";
  const declared = Number.parseFloat(declaredUsd);
  const amountValid = Number.isFinite(declared) && declared >= minUsd && declared <= maxUsd;

  function selectAsset(next: AssetSymbol) {
    setAsset(next);
    setFlowStep("amount");
    setError(null);
  }

  function continueToWallet() {
    if (!amountValid) {
      setError(`Enter an amount between $${minUsd.toLocaleString()} and $${maxUsd.toLocaleString()} USD.`);
      return;
    }
    setError(null);
    setFlowStep("wallet");
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy address. Select and copy manually.");
    }
  }

  async function submitProof(ev: FormEvent) {
    ev.preventDefault();
    if (!token) {
      navigate("/login");
      return;
    }
    if (!amountValid) {
      setError(`Amount must be between $${minUsd.toLocaleString()} and $${maxUsd.toLocaleString()} USD.`);
      return;
    }
    setError(null);
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
      if (!res.ok) throw new Error(body?.error ?? body?.message ?? "Submission failed");
      setProofFile(null);
      setFlowStep("pending_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (flowStep === "pending_review") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">Funding</p>
          <h1 className="text-3xl font-semibold text-slate-900">Deposit submitted</h1>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-blue-950 shadow-sm">
          <p className="font-semibold">Proof received</p>
          <p className="mt-2 text-sm leading-relaxed">
            Your {asset} deposit (${declared.toLocaleString()} USD) is in review. We will notify you when your balance is
            credited.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-slate-500">Funding</p>
        <h1 className="text-3xl font-semibold text-slate-900">Deposit crypto</h1>
        <p className="mt-2 text-slate-600">
          Choose an asset, enter how much you plan to send (${minUsd.toLocaleString()}–${maxUsd.toLocaleString()} USD), then
          send to your deposit wallet and submit proof for review.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">1. Choose asset</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DEPOSIT_ASSETS.map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => selectAsset(sym)}
              className={clsx(
                "rounded-xl border-2 py-4 text-center text-sm font-semibold transition",
                asset === sym && flowStep !== "asset"
                  ? "border-oove-blue bg-oove-blue/10 text-oove-blue"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:border-oove-blue/40",
              )}
            >
              {sym}
            </button>
          ))}
        </div>
      </section>

      {flowStep !== "asset" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">2. Deposit amount (USD)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Selected: <span className="font-semibold text-slate-900">{asset}</span>
            {config?.network ? (
              <>
                {" "}
                · Network: <span className="font-semibold">{config.network}</span>
              </>
            ) : null}
          </p>
          <div className="mt-4">
            <DepositUsdAmountPicker
              minUsd={minUsd}
              maxUsd={maxUsd}
              value={declaredUsd}
              onChange={setDeclaredUsd}
              assetSymbol={asset}
              spotUsdPerUnit={priceQ.data ?? null}
              spotError={priceQ.isError}
            />
          </div>
          {flowStep === "amount" ? (
            <button
              type="button"
              disabled={!amountValid}
              onClick={continueToWallet}
              className="mt-4 w-full rounded-xl bg-oove-blue py-3 font-semibold text-white hover:brightness-105 disabled:opacity-40"
            >
              Continue to wallet
            </button>
          ) : null}
        </section>
      ) : null}

      {(flowStep === "wallet" || flowStep === "proof") && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">3. Send {asset} to this wallet</h2>
            <p className="mt-1 text-sm text-slate-600">{config?.note}</p>
            <div className="mt-6 flex flex-col items-center gap-4">
              {address ? (
                <>
                  <div className="keep-light rounded-2xl border border-slate-200 bg-white p-4">
                    <QRCodeSVG value={address} size={200} bgColor="#ffffff" fgColor="#0f172a" />
                  </div>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm break-all text-slate-900">
                    {address}
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyAddress()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy wallet address"}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">Loading wallet…</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Where to buy crypto</h2>
            <p className="mt-2 text-sm text-slate-600">
              You can purchase {asset} on any trusted exchange. These are popular options:
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {BUY_CRYPTO_PLATFORMS.map((p) => (
                <li key={p.name}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-oove-blue hover:underline"
                  >
                    {p.name}
                  </a>
                </li>
              ))}
            </ul>
            <h3 className="mt-6 text-sm font-semibold text-slate-900">How to buy and deposit (example: Changelly)</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
              {depositStepsForAsset(asset).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          {flowStep === "wallet" ? (
            <button
              type="button"
              onClick={() => setFlowStep("proof")}
              className="w-full rounded-xl bg-oove-blue py-3.5 text-lg font-semibold text-white shadow-md hover:brightness-105"
            >
              I&apos;ve made the payment
            </button>
          ) : null}

          {flowStep === "proof" ? (
            <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={submitProof}>
              <h2 className="text-lg font-semibold text-slate-900">4. Upload proof & submit</h2>
              <p className="text-sm text-slate-600">
                Declaring <span className="font-semibold tabular-nums">${declaredUsd}</span> USD · {asset}
              </p>
              <div>
                <label className="text-sm font-medium text-slate-800">Payment screenshot</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="mt-2 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Upload a screenshot of your payment confirmation, then submit for review.
                </p>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting || !token}
                className="w-full rounded-xl bg-oove-blue py-3 font-semibold text-white hover:brightness-105 disabled:opacity-50"
              >
                {!token ? "Sign in to submit" : submitting ? "Submitting…" : "Submit for review"}
              </button>
              <button
                type="button"
                className="w-full text-sm text-slate-600 underline"
                onClick={() => setFlowStep("wallet")}
              >
                Back to wallet
              </button>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
