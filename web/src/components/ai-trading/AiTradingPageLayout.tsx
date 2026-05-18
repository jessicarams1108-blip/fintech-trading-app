import type { ReactNode } from "react";
import { AiTradingSubNav } from "@/components/ai-trading/AiTradingSubNav";

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function AiTradingPageLayout({ title, description, children }: Props) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          {title ?? "AI Agent Trading"}
        </h1>
        {description ? <p className="mt-2 text-slate-600 dark:text-slate-400">{description}</p> : null}
      </header>
      <AiTradingSubNav />
      {children}
    </div>
  );
}
