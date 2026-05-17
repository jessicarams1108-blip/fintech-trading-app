import { Calendar, Menu } from "lucide-react";
import { ai } from "@/lib/aiTradingTheme";

export function AiTradingTopBar({ title }: { title?: string }) {
  return (
    <header className="px-4 pt-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: ai.card }}
        >
          <Menu className="h-4 w-4" strokeWidth={2} />
          Brokerage
        </button>
        <button
          type="button"
          className="rounded-lg p-2.5"
          style={{ backgroundColor: ai.card }}
          aria-label="Calendar"
        >
          <Calendar className="h-5 w-5 text-white" strokeWidth={1.75} />
        </button>
      </div>
      {title ? <h1 className="mt-5 text-[2rem] font-semibold leading-tight tracking-tight text-white">{title}</h1> : null}
    </header>
  );
}
