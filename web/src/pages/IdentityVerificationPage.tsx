import { apiFetch } from "@/lib/apiBase";
import {
  fetchIdentityStatus,
  fileToBase64,
  submitIdentityVerification,
  type IdentityStatusDto,
  type VerificationState,
} from "@/lib/identityApi";
import {
  COUNTRIES,
  SOURCE_OF_FUNDS_OPTIONS,
  countryNameByCode,
  sourceOfFundsLabel,
  subdivisionsForCountry,
} from "@/lib/kycFormOptions";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { useToast } from "@/state/ToastContext";

const COUNTRY_CODES = [
  { code: "+1", label: "US +1" },
  { code: "+44", label: "UK +44" },
  { code: "+61", label: "AU +61" },
  { code: "+49", label: "DE +49" },
  { code: "+33", label: "FR +33" },
  { code: "+91", label: "IN +91" },
  { code: "+234", label: "NG +234" },
  { code: "+27", label: "ZA +27" },
];

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-oove-blue focus:ring-2 focus:ring-oove-blue/20";
const labelClass = "text-sm font-medium text-slate-800";

function stateLabel(state: VerificationState): string {
  if (state === "approved") return "Approved";
  if (state === "pending") return "Pending review";
  if (state === "rejected") return "Rejected";
  return "Not submitted";
}

export function IdentityVerificationPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [status, setStatus] = useState<IdentityStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [idDocType, setIdDocType] = useState<"passport" | "drivers_license" | "national_id">("passport");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [ssnLast4, setSsnLast4] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationalityCode, setNationalityCode] = useState("");
  const [occupation, setOccupation] = useState("");
  const [sourceOfFundsKey, setSourceOfFundsKey] = useState("");
  const [sourceOfFundsOther, setSourceOfFundsOther] = useState("");

  const addressSubdivisions = useMemo(
    () => (countryCode ? subdivisionsForCountry(countryCode) : []),
    [countryCode],
  );
  const hasStateList = addressSubdivisions.length > 0;

  useEffect(() => {
    setStateProvince("");
  }, [countryCode]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchIdentityStatus(token);
      setStatus(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function demoVerify(tier: number) {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/kyc/demo-verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        showToast(body.error ?? "Verification failed");
        return;
      }
      showToast(body.message ?? "Verified");
      await load();
    } catch {
      showToast("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!idFile) {
      showToast("Upload a government-issued ID");
      return;
    }
    if (!/^\d{4}$/.test(ssnLast4)) {
      showToast("Enter the last 4 digits of your SSN");
      return;
    }
    const countryName = countryNameByCode(countryCode);
    if (!countryName) {
      showToast("Select your country");
      return;
    }
    if (!stateProvince.trim()) {
      showToast(hasStateList ? "Select your state or province" : "Enter your state or province");
      return;
    }
    const nationalityName = countryNameByCode(nationalityCode);
    if (!nationalityName) {
      showToast("Select your nationality");
      return;
    }
    if (!sourceOfFundsKey) {
      showToast("Select your source of funds");
      return;
    }
    if (sourceOfFundsKey === "other" && sourceOfFundsOther.trim().length < 3) {
      showToast("Describe your source of funds (min 3 characters)");
      return;
    }
    const sourceOfFunds =
      sourceOfFundsKey === "other"
        ? `Other: ${sourceOfFundsOther.trim()}`
        : sourceOfFundsLabel(sourceOfFundsKey);

    setSubmitting(true);
    try {
      const idFileBase64 = await fileToBase64(idFile);
      const result = await submitIdentityVerification(token, {
        idDocType,
        idFileName: idFile.name,
        idContentType: idFile.type || "application/octet-stream",
        idFileBase64,
        ssnLast4,
        phoneCountryCode,
        phoneNumber: phoneNumber.trim(),
        street: street.trim(),
        city: city.trim(),
        stateProvince: stateProvince.trim(),
        postalCode: postalCode.trim(),
        country: countryName,
        ...(dateOfBirth.trim() ? { dateOfBirth: dateOfBirth.trim() } : {}),
        nationality: nationalityName,
        ...(occupation.trim() ? { occupation: occupation.trim() } : {}),
        sourceOfFunds,
      });
      showToast(result.message, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Submit failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const verificationState = status?.verificationState ?? "unverified";
  const showForm = verificationState === "unverified" || verificationState === "rejected";
  const registeredEmail = status?.email ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Identity verification</h1>
        <p className="mt-3 text-slate-600">
          Complete verification to unlock borrowing tiers. Submit a government ID and required details for review.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Status</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : status ? (
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 py-2">
              <dt className="text-slate-500">Verification state</dt>
              <dd className="font-medium text-slate-900">{stateLabel(verificationState)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-slate-500">Tier</dt>
              <dd className="font-medium text-slate-900">{status.kycTier}</dd>
            </div>
          </dl>
        ) : null}

        {verificationState === "pending" ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Verification submitted. We&apos;ll notify you once it&apos;s complete.
          </p>
        ) : null}

        {verificationState === "approved" ? (
          <p className="mt-4 text-sm text-emerald-700">
            You are verified. Borrow caps follow your tier and supplied collateral.
          </p>
        ) : null}

        {verificationState === "rejected" && status?.latestSubmission?.rejectionReason ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <strong>Rejection reason:</strong> {status.latestSubmission.rejectionReason}
          </p>
        ) : null}
      </div>

      {showForm ? (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Verification form</h2>

          <div>
            <label className={labelClass} htmlFor="id-doc-type">
              Government-issued ID
            </label>
            <select
              id="id-doc-type"
              className={`${fieldClass} mt-1.5`}
              value={idDocType}
              onChange={(e) => setIdDocType(e.target.value as typeof idDocType)}
            >
              <option value="passport">Passport</option>
              <option value="drivers_license">Driver&apos;s license</option>
              <option value="national_id">National ID</option>
            </select>
            <input
              id="id-file"
              type="file"
              accept="image/*,.pdf"
              className="mt-2 block w-full text-sm text-slate-600"
              onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-slate-500">JPEG, PNG, or PDF · max 6 MB</p>
          </div>

          <div>
            <label className={labelClass} htmlFor="ssn-last4">
              Last 4 digits of SSN
            </label>
            <input
              id="ssn-last4"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              className={`${fieldClass} mt-1.5 font-mono`}
              value={ssnLast4}
              onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <div>
              <label className={labelClass} htmlFor="phone-code">
                Country code
              </label>
              <select
                id="phone-code"
                className={`${fieldClass} mt-1.5`}
                value={phoneCountryCode}
                onChange={(e) => setPhoneCountryCode(e.target.value)}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="phone-number">
                Phone number
              </label>
              <input
                id="phone-number"
                type="tel"
                className={`${fieldClass} mt-1.5`}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoComplete="tel"
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="verify-email">
              Email
            </label>
            <input
              id="verify-email"
              type="email"
              readOnly
              value={registeredEmail}
              className={`${fieldClass} mt-1.5 cursor-not-allowed bg-slate-50 text-slate-600`}
            />
            <p className="mt-1 text-xs text-slate-500">Registered account email (read only)</p>
          </div>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-slate-900">Full address</legend>
            <div>
              <label className={labelClass} htmlFor="street">
                Street
              </label>
              <input
                id="street"
                className={`${fieldClass} mt-1.5`}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="country">
                Country
              </label>
              <select
                id="country"
                className={`${fieldClass} mt-1.5`}
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  className={`${fieldClass} mt-1.5`}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="state-province">
                  State / province
                </label>
                {hasStateList ? (
                  <select
                    id="state-province"
                    className={`${fieldClass} mt-1.5`}
                    value={stateProvince}
                    onChange={(e) => setStateProvince(e.target.value)}
                    disabled={!countryCode}
                    required
                  >
                    <option value="">
                      {countryCode ? "Select state / province" : "Select country first"}
                    </option>
                    {addressSubdivisions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="state-province"
                    className={`${fieldClass} mt-1.5`}
                    value={stateProvince}
                    onChange={(e) => setStateProvince(e.target.value)}
                    placeholder={countryCode ? "Enter state or province" : "Select country first"}
                    disabled={!countryCode}
                    required
                  />
                )}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="postal-code">
                Postal code
              </label>
              <input
                id="postal-code"
                className={`${fieldClass} mt-1.5`}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                required
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Additional KYC information</legend>
            <div>
              <label className={labelClass} htmlFor="dob">
                Date of birth
              </label>
              <input
                id="dob"
                type="date"
                className={`${fieldClass} mt-1.5`}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="nationality">
                Nationality
              </label>
              <select
                id="nationality"
                className={`${fieldClass} mt-1.5`}
                value={nationalityCode}
                onChange={(e) => setNationalityCode(e.target.value)}
                required
              >
                <option value="">Select nationality</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="occupation">
                Occupation
              </label>
              <input
                id="occupation"
                className={`${fieldClass} mt-1.5`}
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="source-of-funds">
                Source of funds
              </label>
              <select
                id="source-of-funds"
                className={`${fieldClass} mt-1.5`}
                value={sourceOfFundsKey}
                onChange={(e) => setSourceOfFundsKey(e.target.value)}
                required
              >
                <option value="">Select source of funds</option>
                {SOURCE_OF_FUNDS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {sourceOfFundsKey === "other" ? (
                <input
                  id="source-of-funds-other"
                  className={`${fieldClass} mt-2`}
                  value={sourceOfFundsOther}
                  onChange={(e) => setSourceOfFundsOther(e.target.value)}
                  placeholder="Please describe your source of funds"
                  required
                />
              ) : null}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-oove-blue px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Submitting…" : "Submit verification"}
          </button>
        </form>
      ) : null}

      {import.meta.env.DEV ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Developer</p>
          <p className="mt-2 text-sm text-slate-600">Quick-verify tiers when test KYC mode is enabled on the API.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[1, 2, 3].map((tier) => (
              <button
                key={tier}
                type="button"
                disabled={submitting}
                onClick={() => void demoVerify(tier)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-40"
              >
                Quick verify · Tier {tier}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-center text-sm">
        <Link to="/settings" className="font-semibold text-oove-blue hover:underline">
          ← Back to account settings
        </Link>
      </p>
    </div>
  );
}
