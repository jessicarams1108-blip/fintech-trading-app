import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { AiTradingBottomNav } from "@/components/ai-trading/AiTradingBottomNav";

/** AI trading always uses a light shell, independent of global dark mode. */
export function AiTradingShell() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    const prevBodyBg = body.style.backgroundColor;
    const prevBodyColor = body.style.color;
    body.style.backgroundColor = "#ffffff";
    body.style.color = "#0f172a";

    return () => {
      if (hadDark) root.classList.add("dark");
      root.style.colorScheme = "";
      body.style.backgroundColor = prevBodyBg;
      body.style.color = prevBodyColor;
    };
  }, []);

  return (
    <div
      className="ai-trading-light fixed inset-0 z-40 flex min-h-[100dvh] w-full flex-col overflow-y-auto bg-white font-sans text-slate-900"
      style={{ fontFamily: "Inter, system-ui, sans-serif", backgroundColor: "#ffffff" }}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col bg-white pb-28">
        <Link
          to="/dashboard"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-oove-blue focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Back to Oove dashboard
        </Link>
        <Outlet />
      </div>
      <AiTradingBottomNav />
    </div>
  );
}
