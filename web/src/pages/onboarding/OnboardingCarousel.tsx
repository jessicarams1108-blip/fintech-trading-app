import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const slides = [
  {
    key: "earn",
    title: "Earn competitive yields on your deposits",
    subtitle: "Secure your savings and grow your wealth every day.",
    graphic: "coin" as const,
  },
  {
    key: "secure",
    title: "Your funds. Protected.",
    subtitle: "Industry-leading security and up to $1M in balance protection.",
    graphic: "lock" as const,
  },
];

function CoinGraphic() {
  return (
    <div className="relative mx-auto flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 via-oove-blue to-indigo-600 opacity-90 shadow-[0_20px_60px_-10px_rgba(42,91,219,0.55)]" />
      <div className="absolute inset-3 rounded-full bg-gradient-to-br from-white/25 to-transparent" />
      <div className="absolute inset-0 rounded-full ring-4 ring-white/30 ring-offset-0" />
      <span className="relative text-5xl font-black tracking-tight text-white drop-shadow-md sm:text-6xl">$</span>
      <div className="absolute -bottom-1 left-1/2 h-3 w-24 -translate-x-1/2 rounded-full bg-black/20 blur-md" />
    </div>
  );
}

function PadlockGraphic() {
  return (
    <div className="relative mx-auto flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
      <div className="absolute inset-2 rounded-3xl bg-gradient-to-br from-violet-500 via-oove-blue to-indigo-600 opacity-95 shadow-[0_20px_60px_-10px_rgba(42,91,219,0.5)]" />
      <svg
        viewBox="0 0 120 120"
        className="relative z-10 h-32 w-32 text-white drop-shadow-md"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Unlocked shackle */}
        <path d="M38 52 V38 C38 22 52 10 60 10 C72 10 82 24 82 38 V48" />
        {/* Body */}
        <rect x="28" y="52" width="64" height="52" rx="10" fill="rgba(255,255,255,0.12)" stroke="currentColor" />
        <circle cx="60" cy="78" r="8" fill="currentColor" />
      </svg>
    </div>
  );
}

export function OnboardingCarousel() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const dragStartX = useRef<number | null>(null);

  const goSignup = useCallback(() => {
    navigate("/signup");
  }, [navigate]);

  const swipeFromDelta = (dx: number) => {
    if (dx < -50) setIndex((i) => Math.min(slides.length - 1, i + 1));
    if (dx > 50) setIndex((i) => Math.max(0, i - 1));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    dragStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = dragStartX.current;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    swipeFromDelta(end - start);
    dragStartX.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartX.current = e.clientX;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = dragStartX.current;
    if (start == null) return;
    swipeFromDelta(e.clientX - start);
    dragStartX.current = null;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4fb] text-slate-900">
      <div
        className="relative flex min-h-0 flex-1 cursor-grab touch-manipulation flex-col overflow-hidden active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragStartX.current = null;
        }}
      >
        <div
          className="flex h-full min-h-[50vh] flex-1 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((s) => (
            <div
              key={s.key}
              className="flex min-w-full shrink-0 flex-col items-center px-6 pb-28 pt-12 text-center sm:px-10 sm:pt-16"
            >
              {s.graphic === "coin" ? <CoinGraphic /> : <PadlockGraphic />}
              <h1 className="mt-10 max-w-md text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                {s.title}
              </h1>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-600 sm:text-lg">{s.subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar: dots + Get Started */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/80 bg-white/95 px-6 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-5">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-oove-blue" : "w-2.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={goSignup}
            className="w-full max-w-sm rounded-full bg-oove-blue py-3.5 text-base font-semibold text-white shadow-lg shadow-oove-blue/25 transition hover:brightness-105"
          >
            Get Started
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Back to Oove.com
          </button>
        </div>
      </div>
    </div>
  );
}
