import { Link, Outlet } from "react-router-dom";
import { AiTradingBottomNav } from "@/components/ai-trading/AiTradingBottomNav";

export function AiTradingShell() {
  return (
    <div
      className="min-h-screen w-full bg-black font-sans text-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="mx-auto min-h-screen w-full max-w-2xl pb-28">
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
