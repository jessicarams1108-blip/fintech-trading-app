import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

function seedSeries(len: number, base: number): { t: number; v: number }[] {
  let v = base;
  return Array.from({ length: len }, (_, i) => {
    v += (Math.random() - 0.48) * (base * 0.008);
    return { t: i, v: Math.max(base * 0.92, v) };
  });
}

export function FakeLiveChart({
  height = 200,
  baseValue = 1000,
  accent = "#22c55e",
}: {
  height?: number;
  baseValue?: number;
  accent?: string;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const data = useMemo(() => seedSeries(40, baseValue), [baseValue, tick]);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="aiChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={["auto", "auto"]} hide />
          <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2} fill="url(#aiChartFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
