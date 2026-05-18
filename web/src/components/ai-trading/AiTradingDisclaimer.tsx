export function AiTradingDisclaimer({ compact }: { compact?: boolean }) {
  return (
    <p
      className={
        compact
          ? "text-[10px] leading-snug text-slate-500"
          : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600"
      }
    >
      Simulated trading. Results controlled by admin. Not financial advice. This is a simulated trading platform
      for educational purposes.
    </p>
  );
}
