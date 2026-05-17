import { Link, Outlet } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AiTradingBottomNav } from "@/components/ai-trading/AiTradingBottomNav";

export function AiTradingShell() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] font-sans text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="mx-auto min-h-screen max-w-lg pb-24">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#9CA3AF] hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Oove
          </Link>
          <span className="ml-auto text-xs font-semibold text-[#9CA3AF]">AI Agent Trading</span>
        </div>
        <Outlet />
      </div>
      <AiTradingBottomNav />
    </div>
  );
}
