import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { useAuth } from "@/state/AuthContext";
import { fetchIdentityStatus, type VerificationState } from "@/lib/identityApi";
import { BalanceVisibilityEyeToggle } from "@/components/BalanceVisibilityEyeToggle";
import { useToast } from "@/state/ToastContext";
import { useTheme } from "@/state/ThemeContext";
import { CurrencyPreferenceSelect, LanguagePreferenceSelect } from "@/components/PreferenceSelects";
import { usePreferences } from "@/state/PreferencesContext";
import { apiFetch } from "@/lib/apiBase";
import { changePassword, fetchProfile, patchProfile } from "@/lib/settingsApi";
import { resolveProfileFields } from "@/lib/profileDisplay";
import { clearRegisteredProfile, readRegisteredProfile } from "@/lib/registeredProfile";

type Tab = "account" | "prefs" | "security";

async function authFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers as object) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800", className)} />;
}

function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      {children}
    </section>
  );
}

function fieldClass() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-oove-blue focus:ring-2 focus:ring-oove-blue/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
}

function labelClass() {
  return "text-sm font-medium text-slate-800 dark:text-slate-200";
}

function identityStatusLabel(state: VerificationState): string {
  if (state === "approved") return "Approved";
  if (state === "pending") return "Pending review";
  if (state === "rejected") return "Rejected";
  return "Not submitted";
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={clsx(
        "relative inline-flex h-9 w-[4.25rem] shrink-0 items-center rounded-full border transition-colors duration-300 ease-out",
        isDark ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-slate-100",
      )}
    >
      <span
        className={clsx(
          "absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-300 ease-out dark:bg-slate-200",
          isDark ? "translate-x-[2.15rem]" : "translate-x-0",
        )}
      />
      <span className="pointer-events-none flex w-full justify-between px-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <span className={clsx(!isDark && "text-slate-700")}>☀</span>
        <span className={clsx(isDark && "text-slate-300")}>☾</span>
      </span>
    </button>
  );
}

export function SettingsPage() {
  const { token, user, patchUser } = useAuth();
  const { showToast } = useToast();
  const { currency, setCurrency, language, setLanguage, t } = usePreferences();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("account");

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [profileSavedFlash, setProfileSavedFlash] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSavedFlash, setPwSavedFlash] = useState(false);

  const profileQ = useQuery({
    queryKey: ["settings", "profile", token],
    enabled: !!token,
    queryFn: () => fetchProfile(token!),
  });

  const identityQ = useQuery({
    queryKey: ["identity", "status", token],
    enabled: !!token && tab === "account",
    queryFn: () => fetchIdentityStatus(token!),
  });

  const registeredProfile = useMemo(() => readRegisteredProfile(user?.id), [profileQ.dataUpdatedAt, user?.id]);

  const resolvedProfile = useMemo(
    () => resolveProfileFields(profileQ.data, user, registeredProfile),
    [profileQ.data, user, registeredProfile],
  );

  useEffect(() => {
    setFullName(resolvedProfile.fullName);
    setUsername(resolvedProfile.username);
  }, [resolvedProfile.fullName, resolvedProfile.username]);

  const backfillAttempted = useRef(false);
  useEffect(() => {
    if (backfillAttempted.current || !token || !profileQ.isSuccess || !registeredProfile) return;
    const apiEmpty = !profileQ.data?.fullName?.trim() && !profileQ.data?.username?.trim();
    if (!apiEmpty) {
      clearRegisteredProfile(user?.id);
      return;
    }
    backfillAttempted.current = true;
    void patchProfile(token, {
      fullName: registeredProfile.fullName,
      username: registeredProfile.username,
    })
      .then((data) => {
        setFullName(data.fullName);
        setUsername(data.username ?? "");
        patchUser({
          fullName: data.fullName,
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
        });
        clearRegisteredProfile(user?.id);
        void qc.invalidateQueries({ queryKey: ["settings", "profile"] });
      })
      .catch(() => {
        backfillAttempted.current = false;
      });
  }, [token, profileQ.isSuccess, profileQ.data, registeredProfile, patchUser, qc, user?.id]);

  const sessions = useQuery({
    queryKey: ["settings", "sessions", token],
    enabled: !!token && tab === "security",
    queryFn: () =>
      authFetch<{ data: { id: string; user_agent: string | null; created_at: string; revoked_at: string | null }[] }>(
        "/api/settings/sessions",
        token!,
      ),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Sign in required");
      const trimmedUser = username.trim();
      if (trimmedUser.length > 0 && trimmedUser.length < 3) {
        throw new Error("Username must be at least 3 characters");
      }
      if (trimmedUser.length > 0 && !/^[a-zA-Z0-9_]+$/.test(trimmedUser)) {
        throw new Error("Username may only contain letters, numbers, and underscores");
      }
      return patchProfile(token, {
        fullName: fullName.trim(),
        ...(trimmedUser.length > 0 ? { username: trimmedUser } : {}),
      });
    },
    onSuccess: (data) => {
      setFullName(data.fullName);
      setUsername(data.username ?? "");
      patchUser({
        fullName: data.fullName,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      clearRegisteredProfile(user?.id);
      setEditingProfile(false);
      setProfileSavedFlash(true);
      window.setTimeout(() => setProfileSavedFlash(false), 2500);
      showToast("Profile saved. A confirmation email was sent if mail is configured.", "success");
      void qc.invalidateQueries({ queryKey: ["settings", "profile"] });
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const changePw = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Sign in required");
      if (newPw.length < 8) throw new Error("New password must be at least 8 characters");
      if (newPw !== confirmPw) throw new Error("New password and confirmation do not match");
      await changePassword(token, {
        currentPassword: curPw,
        newPassword: newPw,
        confirmPassword: confirmPw,
      });
    },
    onSuccess: () => {
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      setPwSavedFlash(true);
      window.setTimeout(() => setPwSavedFlash(false), 2500);
      showToast("Password updated. Check your email for a security notice.", "success");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const revoke = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!token) return;
      await authFetch("/api/settings/revoke-session", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    },
    onSuccess: () => {
      showToast("Session revoked", "success");
      void sessions.refetch();
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const displayEmail = profileQ.data?.email ?? user?.email ?? "—";
  const hasRegistration = Boolean(resolvedProfile.fullName || resolvedProfile.username);
  const readOnlyFieldClass =
    "mt-1.5 cursor-not-allowed bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-200";

  const tabs: { key: Tab; label: string }[] = [
    { key: "account", label: "Account" },
    { key: "prefs", label: "Preferences" },
    { key: "security", label: "Security" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Manage your account, password, and app preferences.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200",
              tab === key
                ? "bg-oove-blue text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "account" && (
        <div className="space-y-6">
          <SettingsCard>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Profile</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Your full name and username from signup appear below. Email cannot be changed here.
            </p>

            {profileQ.isLoading && !resolvedProfile.fullName && !resolvedProfile.username ? (
              <div className="mt-6 space-y-4">
                <SkeletonLine className="h-4 w-24" />
                <SkeletonLine className="h-10 w-full" />
                <SkeletonLine className="h-4 w-24" />
                <SkeletonLine className="h-10 w-full" />
                <SkeletonLine className="h-4 w-24" />
                <SkeletonLine className="h-10 w-full" />
              </div>
            ) : profileQ.isError ? (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{(profileQ.error as Error).message}</p>
            ) : (
              <div className="mt-6 space-y-4">
                <div>
                  <label className={labelClass()} htmlFor="settings-full-name">
                    Full name
                  </label>
                  <input
                    id="settings-full-name"
                    className={clsx(
                      fieldClass(),
                      !editingProfile && hasRegistration ? readOnlyFieldClass : "mt-1.5",
                    )}
                    value={fullName || resolvedProfile.fullName}
                    readOnly={!editingProfile && hasRegistration}
                    aria-readonly={!editingProfile && hasRegistration}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                  {!editingProfile && hasRegistration ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">From your registration</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass()} htmlFor="settings-username">
                    Username
                  </label>
                  <input
                    id="settings-username"
                    className={clsx(
                      fieldClass(),
                      !editingProfile && hasRegistration ? readOnlyFieldClass : "mt-1.5 font-mono",
                    )}
                    value={username || resolvedProfile.username}
                    readOnly={!editingProfile && hasRegistration}
                    aria-readonly={!editingProfile && hasRegistration}
                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                    placeholder="your_username"
                    autoComplete="username"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {!editingProfile && hasRegistration
                      ? "From your registration"
                      : "Letters, numbers, and underscores · 3–32 characters"}
                  </p>
                </div>
                {hasRegistration ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-oove-blue hover:underline"
                    onClick={() => {
                      if (editingProfile) {
                        setEditingProfile(false);
                        setFullName(resolvedProfile.fullName);
                        setUsername(resolvedProfile.username);
                      } else {
                        setFullName(resolvedProfile.fullName);
                        setUsername(resolvedProfile.username);
                        setEditingProfile(true);
                      }
                    }}
                  >
                    {editingProfile ? "Show registration details" : "Change full name or username"}
                  </button>
                ) : null}
                <div>
                  <label className={labelClass()} htmlFor="settings-email">
                    Email
                  </label>
                  <input
                    id="settings-email"
                    className={clsx(fieldClass(), "mt-1.5 cursor-not-allowed bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-400")}
                    value={displayEmail}
                    readOnly
                    aria-readonly
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Signed-in account email (read only)</p>
                </div>

                <div
                  id="identity-verification"
                  className="scroll-mt-24 border-t border-slate-200 pt-6 dark:border-slate-700"
                >
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Identity verification</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Required for borrowing. Submit your government ID and details for review.
                  </p>
                  {identityQ.isLoading ? (
                    <div className="mt-4 space-y-2">
                      <SkeletonLine className="h-4 w-32" />
                      <SkeletonLine className="h-10 w-full max-w-xs" />
                    </div>
                  ) : identityQ.isError ? (
                    <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                      {(identityQ.error as Error).message}
                    </p>
                  ) : identityQ.data ? (
                    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                        <dd className="font-medium capitalize text-slate-900 dark:text-slate-100">
                          {identityStatusLabel(identityQ.data.verificationState)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Tier</dt>
                        <dd className="font-medium text-slate-900 dark:text-slate-100">{identityQ.data.kycTier}</dd>
                      </div>
                    </dl>
                  ) : null}
                  <Link
                    to="/verify-identity"
                    className="mt-4 inline-flex rounded-full bg-oove-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105"
                  >
                    {identityQ.data?.verificationState === "approved"
                      ? "View verification"
                      : identityQ.data?.verificationState === "pending"
                        ? "View submission"
                        : "Verify identity"}
                  </Link>
                </div>

                {(editingProfile || !hasRegistration) && (
                  <button
                    type="button"
                    disabled={saveProfile.isPending || !token}
                    onClick={() => saveProfile.mutate()}
                    className={clsx(
                      "rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition",
                      saveProfile.isPending ? "bg-oove-blue/70" : "bg-oove-blue hover:brightness-105",
                      profileSavedFlash && !saveProfile.isPending && "ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-slate-900",
                    )}
                  >
                    {saveProfile.isPending ? "Saving…" : profileSavedFlash ? "Saved ✓" : "Save profile"}
                  </button>
                )}
              </div>
            )}
          </SettingsCard>
        </div>
      )}

      {tab === "prefs" && (
        <div className="space-y-6">
          <SettingsCard className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Appearance</h2>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Theme</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Light or dark interface</p>
              </div>
              <ThemeToggle />
            </div>
          </SettingsCard>

          <SettingsCard className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Regional</h2>
            <div>
              <label className={labelClass()} htmlFor="settings-currency">
                Currency
              </label>
              <CurrencyPreferenceSelect
                id="settings-currency"
                className={clsx(fieldClass(), "mt-1.5")}
                value={currency}
                onChange={(code) => {
                  setCurrency(code);
                  showToast(t("settings.currencySet", { currency: code }), "success");
                }}
              />
            </div>
            <div>
              <label className={labelClass()} htmlFor="settings-language">
                Language
              </label>
              <LanguagePreferenceSelect
                id="settings-language"
                className={clsx(fieldClass(), "mt-1.5")}
                value={language}
                onChange={(code) => {
                  setLanguage(code);
                  showToast(t("settings.languageSet"), "success");
                }}
              />
            </div>
          </SettingsCard>

          <SettingsCard>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Privacy</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Hide portfolio totals and charts on shared screens.
            </p>
            <div className="mt-4 flex max-w-md items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/50">
              <BalanceVisibilityEyeToggle className="mt-0.5" />
              <div>
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Portfolio balance visibility
                </span>
                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                  Synced with the eye control on Dashboard and Portfolio.
                </span>
              </div>
            </div>
          </SettingsCard>
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-6">
          <SettingsCard>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Change password</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Minimum 8 characters for your new password.</p>
            <div className="mt-6 space-y-4">
              <div>
                <label className={labelClass()} htmlFor="settings-cur-pw">
                  Current password
                </label>
                <input
                  id="settings-cur-pw"
                  type="password"
                  autoComplete="current-password"
                  className={clsx(fieldClass(), "mt-1.5")}
                  value={curPw}
                  onChange={(e) => setCurPw(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass()} htmlFor="settings-new-pw">
                  New password
                </label>
                <input
                  id="settings-new-pw"
                  type="password"
                  autoComplete="new-password"
                  className={clsx(fieldClass(), "mt-1.5")}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  minLength={8}
                />
              </div>
              <div>
                <label className={labelClass()} htmlFor="settings-confirm-pw">
                  Confirm new password
                </label>
                <input
                  id="settings-confirm-pw"
                  type="password"
                  autoComplete="new-password"
                  className={clsx(
                    fieldClass(),
                    "mt-1.5",
                    confirmPw.length > 0 && newPw !== confirmPw && "border-red-300 focus:border-red-500 focus:ring-red-200",
                  )}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  minLength={8}
                />
                {confirmPw.length > 0 && newPw !== confirmPw ? (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">Passwords do not match</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={
                  changePw.isPending ||
                  !token ||
                  curPw.length === 0 ||
                  newPw.length < 8 ||
                  confirmPw.length < 8 ||
                  newPw !== confirmPw
                }
                onClick={() => changePw.mutate()}
                className={clsx(
                  "rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition",
                  changePw.isPending ? "bg-slate-600/70" : "bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
                  pwSavedFlash && !changePw.isPending && "ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-slate-900",
                )}
              >
                {changePw.isPending ? "Updating…" : pwSavedFlash ? "Updated ✓" : "Update password"}
              </button>
            </div>
          </SettingsCard>

          <SettingsCard>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Sessions</h2>
          {sessions.isLoading ? (
            <div className="mt-4 space-y-3">
              <SkeletonLine className="h-14 w-full" />
              <SkeletonLine className="h-14 w-full" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(sessions.data?.data ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 dark:border-slate-800"
                >
                  <div>
                    <p className="font-mono text-xs text-slate-500">{s.id.slice(0, 8)}…</p>
                    <p className="text-slate-700 dark:text-slate-300">{s.user_agent ?? "Unknown device"}</p>
                    <p className="text-xs text-slate-400">{new Date(s.created_at).toLocaleString()}</p>
                  </div>
                  {s.revoked_at ? (
                    <span className="text-xs text-slate-400">Revoked</span>
                  ) : (
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline dark:text-red-400"
                      onClick={() => revoke.mutate(s.id)}
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          </SettingsCard>
        </div>
      )}
    </div>
  );
}
