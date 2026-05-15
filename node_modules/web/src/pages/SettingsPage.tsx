import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/state/AuthContext";
import { BalanceVisibilityEyeToggle } from "@/components/BalanceVisibilityEyeToggle";
import { useToast } from "@/state/ToastContext";
import { useTheme } from "@/state/ThemeContext";
import clsx from "clsx";

type Tab = "profile" | "security" | "prefs";

async function authFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers as object) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

export function SettingsPage() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("profile");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const sessions = useQuery({
    queryKey: ["settings", "sessions", token],
    enabled: !!token && tab === "security",
    queryFn: () => authFetch<{ data: { id: string; user_agent: string | null; created_at: string; revoked_at: string | null }[] }>("/api/settings/sessions", token!),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!token) return;
      await authFetch("/api/settings/profile", token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
    },
    onSuccess: () => {
      showToast("Profile saved");
      void qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => showToast(e.message),
  });

  const changePw = useMutation({
    mutationFn: async () => {
      if (!token) return;
      await authFetch("/api/settings/change-password", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
    },
    onSuccess: () => {
      showToast("Password updated");
      setCurPw("");
      setNewPw("");
    },
    onError: (e: Error) => showToast(e.message),
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
    onSuccess: () => void sessions.refetch(),
    onError: (e: Error) => showToast(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
      <p className="text-slate-600">Signed in as {user?.email}</p>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            ["profile", "Profile"],
            ["security", "Security"],
            ["prefs", "Preferences"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              tab === k
                ? "rounded-full bg-oove-blue px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold">Profile</h2>
          <input className="w-full rounded-xl border px-3 py-2" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input className="w-full rounded-xl border px-3 py-2" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <button type="button" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()} className="rounded-xl bg-oove-blue px-4 py-2 font-semibold text-white">
            Save
          </button>
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold">Change password</h2>
            <input type="password" className="w-full rounded-xl border px-3 py-2" placeholder="Current" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
            <input type="password" className="w-full rounded-xl border px-3 py-2" placeholder="New (min 8 chars)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <button type="button" disabled={changePw.isPending} onClick={() => changePw.mutate()} className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white">
              Update password
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sessions</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(sessions.data?.data ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{s.id.slice(0, 8)}…</p>
                    <p className="text-slate-600">{s.user_agent ?? "Unknown device"}</p>
                    <p className="text-xs text-slate-400">{new Date(s.created_at).toLocaleString()}</p>
                  </div>
                  {s.revoked_at ? (
                    <span className="text-xs text-slate-400">Revoked</span>
                  ) : (
                    <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => revoke.mutate(s.id)}>
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "prefs" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Privacy</h2>
            <p className="text-sm text-slate-600">
              When off, portfolio totals (USD and BTC), allocation figures, holdings, and the value chart are hidden
              on Dashboard and Portfolio — useful on shared screens.
            </p>
            <div className="flex max-w-md items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <BalanceVisibilityEyeToggle className="mt-0.5" />
              <div>
                <span className="block text-sm font-semibold text-slate-900">Portfolio balance visibility</span>
                <span className="mt-1 block text-xs text-slate-600">
                  Use the eye control next to Total value on Dashboard and Portfolio, or here — all stay in sync via
                  your browser.
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Appearance</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={clsx(
                "rounded-full border px-5 py-2.5 text-sm font-semibold transition",
                theme === "light" ? "border-accent bg-accent text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={clsx(
                "rounded-full border px-5 py-2.5 text-sm font-semibold transition",
                theme === "dark" ? "border-accent bg-accent text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              Dark
            </button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
