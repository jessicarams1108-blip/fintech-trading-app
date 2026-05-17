import { Link, NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/state/AuthContext";
import { useTheme } from "@/state/ThemeContext";
import { usePreferences, type DisplayCurrency, type DisplayLanguage } from "@/state/PreferencesContext";
import { DepositSocketBridge } from "@/components/DepositSocketBridge";

type NavDescriptor = {
  to: string;
  label: string;
  adminOnly?: true;
};

/** Main app routes — open from the hamburger sidebar. */
const sidebarMainNav: NavDescriptor[] = [
  { to: "/dashboard", label: "Home" },
  { to: "/borrow", label: "Borrow" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/fixed-plans", label: "Fixed savings" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/history", label: "History" },
];

const sidebarAdminNav: NavDescriptor[] = [
  { to: "/admin/console", label: "Admin · Console", adminOnly: true },
  { to: "/admin/deposits", label: "Admin · Deposits", adminOnly: true },
  { to: "/admin/identity", label: "Admin · Identity", adminOnly: true },
  { to: "/admin/fixed-savings", label: "Admin · Fixed savings", adminOnly: true },
];

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-slate-800 dark:text-slate-200" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <>
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function AppShell() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency, language, setLanguage } = usePreferences();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  );

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setSidebarOpen(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const adminItems = useMemo(
    () => sidebarAdminNav.filter((item) => (item.adminOnly ? isAdmin : true)),
    [isAdmin],
  );

  function closeSidebarMobile() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setSidebarOpen(false);
    }
  }

  useEffect(() => {
    if (!profileOpen) return;
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [profileOpen]);

  const menuShell = "border border-slate-200 bg-white text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const menuLabel = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
  const menuSelect =
    "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";
  const themeBtn = (active: boolean) =>
    clsx(
      "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition",
      active
        ? "bg-oove-blue text-white"
        : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
    );

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:flex-row">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-slate-900/25 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        id="app-sidebar-nav"
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white p-5 transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-auto lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none lg:pointer-events-auto lg:hidden",
        )}
      >
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900 no-underline dark:text-slate-50"
          onClick={closeSidebarMobile}
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-oove-blue text-xs font-black text-white">
            OO
          </span>
          Oove
        </Link>

        <nav className="flex flex-col gap-1 text-sm font-medium">
          {sidebarMainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                  isActive && "bg-slate-100 text-accent dark:bg-slate-800 dark:text-white",
                )
              }
              end={item.to === "/dashboard"}
              onClick={closeSidebarMobile}
            >
              {item.label}
            </NavLink>
          ))}

          {adminItems.length > 0 ? (
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Admin
              </p>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                      isActive && "bg-slate-100 text-accent dark:bg-slate-800 dark:text-white",
                    )
                  }
                  onClick={closeSidebarMobile}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ) : null}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-950">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-4">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar-nav"
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <HamburgerIcon open={sidebarOpen} />
          </button>

          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Oove</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              Menu: Home, Borrow, Portfolio, Watchlist, History
            </p>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none sm:flex-initial">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Notifications"
            >
              🔔
            </button>

            <div className="relative shrink-0" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                aria-label={user?.email ? `Open account menu, signed in as ${user.email}` : "Open account menu"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-purple-600 text-xs font-bold text-white">
                  {user?.email?.slice(0, 2).toUpperCase() ?? "--"}
                </div>
              </button>

              {profileOpen ? (
                <div
                  className={clsx("absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl py-2 text-sm", menuShell)}
                  role="menu"
                >
                  <div className="space-y-3 border-b border-slate-100 px-3 pb-3 dark:border-slate-800">
                    <div>
                      <span className={menuLabel}>Theme</span>
                      <div className="flex gap-1">
                        <button type="button" className={themeBtn(theme === "light")} onClick={() => setTheme("light")}>
                          Light
                        </button>
                        <button type="button" className={themeBtn(theme === "dark")} onClick={() => setTheme("dark")}>
                          Dark
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={menuLabel} htmlFor="pref-currency">
                        Currency
                      </label>
                      <select
                        id="pref-currency"
                        className={menuSelect}
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
                      >
                        <option value="USD">USD — US dollar</option>
                        <option value="EUR">EUR — Euro</option>
                        <option value="GBP">GBP — British pound</option>
                      </select>
                    </div>
                    <div>
                      <label className={menuLabel} htmlFor="pref-language">
                        Language
                      </label>
                      <select
                        id="pref-language"
                        className={menuSelect}
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as DisplayLanguage)}
                      >
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                      </select>
                    </div>
                  </div>

                  <div className="py-1">
                    <NavLink
                      to="/settings"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          "block px-3 py-2.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800",
                          isActive
                            ? "bg-slate-100 text-accent dark:bg-slate-800 dark:text-white"
                            : "text-slate-800 dark:text-slate-200",
                        )
                      }
                    >
                      Settings
                    </NavLink>
                  </div>

                  <div className="border-t border-slate-100 py-1 dark:border-slate-800">
                    {user ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                        }}
                      >
                        Log out
                      </button>
                    ) : (
                      <NavLink
                        to="/login"
                        role="menuitem"
                        className="block px-3 py-2.5 font-semibold text-oove-blue hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => setProfileOpen(false)}
                      >
                        Log in
                      </NavLink>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-white p-4 dark:bg-slate-950 md:p-8">
          <DepositSocketBridge />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
