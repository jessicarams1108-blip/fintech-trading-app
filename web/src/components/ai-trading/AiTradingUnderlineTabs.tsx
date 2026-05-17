import clsx from "clsx";
import { SlidersHorizontal } from "lucide-react";

export function AiTradingUnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  showFilter,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (t: T) => void;
  showFilter?: boolean;
}) {
  return (
    <div className="mt-4 flex items-center gap-1 overflow-x-auto border-b border-white/10 px-4 pb-0 scrollbar-none">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={clsx(
            "relative shrink-0 px-3 pb-3 text-sm font-medium transition-colors",
            active === t ? "text-white" : "text-[#8E8E93]",
          )}
        >
          {t}
          {active === t ? (
            <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-white" />
          ) : null}
        </button>
      ))}
      {showFilter ? (
        <button type="button" className="ml-auto shrink-0 pb-3 pl-2 text-[#8E8E93]" aria-label="Filter">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
