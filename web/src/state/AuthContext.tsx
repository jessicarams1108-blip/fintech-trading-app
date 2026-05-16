import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { API_ORIGIN, apiFetch } from "@/lib/apiBase";
import { profileFromAuthUser, saveRegisteredProfile } from "@/lib/registeredProfile";

export type AuthUser = {
  id: string;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  applySession: (token: string, user: AuthUser) => void;
  patchUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
  isAdmin: boolean;
};

const STORAGE_KEY = "tradeone_auth_token";

const ADMIN_EMAIL_PRIMARY = (
  import.meta.env.VITE_ADMIN_PRIMARY_EMAIL ?? "Hardewusi@gmail.com"
).toLowerCase();

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(token));

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error("me_request_failed");
        }
        const body = (await res.json()) as { user: AuthUser };
        if (!cancelled) {
          setUser(body.user);
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    let res: Response;
    try {
      res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch {
      throw new Error(
        "Cannot reach the server. Start the backend (npm run dev:server) or use “Browse without signing in” on the login page.",
      );
    }
    if (!res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          API_ORIGIN
            ? `Sign-in failed (${res.status}). The API may be waking up — wait a minute and try again.`
            : "This site is not connected to the API. In Vercel, set VITE_API_URL to https://fintech-trading-app.onrender.com and redeploy.",
        );
      }
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload?.error ?? "Login failed");
    }
    const body = (await res.json()) as { token: string; user: AuthUser };
    localStorage.setItem(STORAGE_KEY, body.token);
    setToken(body.token);
    setUser(body.user);
    const reg = profileFromAuthUser(body.user);
    if (reg) saveRegisteredProfile(body.user.id, reg);
  }, []);

  const applySession = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(STORAGE_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
    const reg = profileFromAuthUser(nextUser);
    if (reg) saveRegisteredProfile(nextUser.id, reg);
  }, []);

  const patchUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    void apiFetch("/api/auth/logout", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }, [token]);

  const isAdmin = useMemo(() => user?.email.toLowerCase() === ADMIN_EMAIL_PRIMARY, [user]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      applySession,
      patchUser,
      logout,
      isAdmin,
    }),
    [user, token, loading, login, applySession, patchUser, logout, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
