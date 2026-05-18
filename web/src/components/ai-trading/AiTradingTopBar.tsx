import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function AiTradingTopBar({ title }: { title?: string }) {
  return (
    <header className="flex items-center gap-3 px-4 pb-2 pt-3">
      <Link
        to="/dashboard"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
        aria-label="Back to home"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2} />
      </Link>
      {title ? (
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
      ) : null}
    </header>
  );
}
