import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function AiTradingTopBar({ title }: { title?: string }) {
  return (
    <header className="px-4 pt-2">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 rounded-lg py-2 text-sm font-medium text-[#8E8E93] transition hover:text-white"
        aria-label="Back to home"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        Home
      </Link>
      {title ? (
        <h1 className="mt-4 text-[2rem] font-semibold leading-tight tracking-tight text-white">{title}</h1>
      ) : null}
    </header>
  );
}
