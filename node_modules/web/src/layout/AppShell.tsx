import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/state/AuthContext";
import { DepositSocketBridge } from "@/components/DepositSocketBridge";

type NavDescriptor = {
  to: string;
  label: string;
  adminOnly?: true;
};

const primaryNav: NavDescriptor[] = [
  { to: "/dashboard", label: "Home" },
  { to: "/admin/console", label: "Admin · Console", adminOnly: true },
  { to: "/admin/deposits", label: "Admin · Deposits", adminOnly: true },
];

const profileNav: NavDescriptor[] = [
  { to: "/borrow", label: "Borrow" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/transfers", label: "Transfers" },
  { to: "/deposit", label: "Supply" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/history", label: "History" },
  { to: "/verify-identity", label: "Identity" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  const { user, logout, isAdmin } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const primaryItems = useMemo(
    () => primaryNav.filter((item) => (item.adminOnly ? isAdmin : true)),
    [isAdmin],
  );

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

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 lg:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white p-5 lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-oove-blue text-xs font-black text-white">
            OO
          </span>
          Oove
        </div>
        <nav className="flex flex-col gap-1 text-sm font-medium">
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100",
                  isActive && "bg-slate-100 text-accent",
                )
              }
              end={item.to === "/dashboard"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold lg:hidden">
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                clsx(
                  "rounded-full px-3 py-1 whitespace-nowrap",
                  isActive ? "bg-accent text-white" : "bg-slate-100 text-slate-700",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-1 items-center gap-2">
            <input
              placeholder="Search tickers..."
              className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-accent focus:border-accent focus:ring-2"
            />
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
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
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-2 transition hover:bg-slate-50 sm:pr-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-purple-600 text-xs font-bold text-white">
                {user?.email?.slice(0, 2).toUpperCase() ?? "--"}
              </div>
              <div className="hidden min-w-0 max-w-[10rem] flex-col items-start text-left sm:flex">
                <span className="truncate text-xs font-semibold text-slate-900">
                  {user?.email?.split("@")[0] ?? "Profile"}
                </span>
                <span className="truncate text-[10px] text-slate-500">Account menu</span>
              </div>
              <span className="hidden text-slate-400 sm:inline" aria-hidden>
                ▾
              </span>
            </button>

            {profileOpen ? (
              <div
                className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg"
                role="menu"
              >
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-xs font-medium text-slate-500">Signed in as</p>
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.email ?? "—"}</p>
                </div>
                <div className="py-1">
                  {profileNav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          "block px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-50",
                          isActive && "bg-slate-100 text-accent",
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
                <div className="border-t border-slate-100 py-1">
                  {user ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
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
                      className="block px-3 py-2.5 font-semibold text-oove-blue hover:bg-slate-50"
                      onClick={() => setProfileOpen(false)}
                    >
                      Log in
                    </NavLink>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-white p-4 md:p-8">
          <DepositSocketBridge />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
