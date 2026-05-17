import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { Atom, BarChart3, Briefcase, Inbox, Search } from "lucide-react";

const items = [
  { to: "/ai-trading", label: "Portfolio", icon: Briefcase },
  { to: "/ai-trading/markets", label: "Markets", icon: BarChart3 },
  { to: "/ai-trading/markets", label: "Search", icon: Search },
  { to: "/ai-trading", label: "Inbox", icon: Inbox },
  { to: "/ai-trading", label: "Agents", icon: Atom },
];

export function AiTradingBottomNav() {
  const loc = useLocation();

  function isActive(label: string): boolean {
    if (label === "Markets" || label === "Search") return loc.pathname.startsWith("/ai-trading/markets");
    if (label === "Portfolio" || label === "Agents")
      return loc.pathname === "/ai-trading" || loc.pathname.startsWith("/ai-trading/trade");
    return false;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
      <div className="mx-auto flex max-w-2xl justify-between px-2">
        {items.map(({ to, label, icon: Icon }) => {
          const active = isActive(label);
          return (
            <NavLink
              key={label}
              to={to}
              className={clsx(
                "relative flex min-w-[4rem] flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium",
                active ? "text-white" : "text-[#8E8E93]",
                label === "Agents" && active && "text-oove-blue",
              )}
            >
              {active ? <span className="absolute -top-1 h-0.5 w-8 rounded-full bg-white" /> : null}
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.6} />
              {label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
