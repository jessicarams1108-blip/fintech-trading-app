export function AiTradingDisclaimer({ compact }: { compact?: boolean }) {
  return (
    <p
      className={
        compact
          ? "text-[10px] leading-snug text-[#9CA3AF]"
          : "rounded-xl border border-white/10 bg-[#1A1A1A] px-3 py-2 text-xs leading-relaxed text-[#9CA3AF]"
      }
    >
      Simulated trading. Results controlled by admin. Not financial advice. This is a simulated trading platform
      for educational purposes.
    </p>
  );
}
