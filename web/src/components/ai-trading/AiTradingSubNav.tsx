import { NavLink } from "react-router-dom";
import clsx from "clsx";

const links = [
  { to: "/ai-trading", label: "Portfolio", end: true },
  { to: "/ai-trading/markets", label: "Markets" },
  { to: "/ai-trading/inbox", label: "Inbox" },
  { to: "/ai-trading/agent", label: "Agents" },
] as const;

export function AiTradingSubNav() {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={"end" in link ? link.end : false}
          className={({ isActive }) =>
            clsx(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              isActive ? "bg-oove-blue text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
