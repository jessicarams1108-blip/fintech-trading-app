import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { Bot, Briefcase, LineChart, Search, Inbox } from "lucide-react";

const items = [
  { to: "/ai-trading", label: "Portfolio", icon: Briefcase, end: true },
  { to: "/ai-trading/markets", label: "Markets", icon: LineChart, end: false },
  { to: "/ai-trading/markets", label: "Search", icon: Search, end: false },
  { to: "/ai-trading", label: "Inbox", icon: Inbox, end: true },
  { to: "/ai-trading", label: "Agents", icon: Bot, end: true },
];

export function AiTradingBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0D0D0D] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto flex max-w-lg justify-between">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium",
                isActive ? "text-white" : "text-[#9CA3AF]",
              )
            }
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
