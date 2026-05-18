export function MetricCard({
  label,
  value,
  hint,
  invert,
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  invert?: boolean;
  icon?: React.ReactNode;
}) {
  const good = invert ? value <= 2.5 : value >= 3.5;
  const bad = invert ? value >= 4 : value <= 2.5;
  const ringColor = good
    ? "rgba(16,185,129,0.6)"
    : bad
    ? "rgba(239,68,68,0.6)"
    : "rgba(245,158,11,0.6)";
  const valueClass = good
    ? "text-smp-ok"
    : bad
    ? "text-smp-crit"
    : "text-smp-warn";
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));

  return (
    <div className="card relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(120% 60% at 0% 0%, ${ringColor} 0%, transparent 60%)`,
        }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="label truncate">{label}</div>
          {icon && <div className="text-slate-500 text-sm">{icon}</div>}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`kpi-value text-3xl sm:text-4xl font-semibold ${valueClass}`}>
            {value.toFixed(1)}
          </span>
          <span className="text-slate-500 text-sm">/ 5</span>
        </div>
        <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${ringColor} 0%, rgba(255,255,255,0.15) 100%)`,
            }}
          />
        </div>
        {hint && <div className="text-[11px] text-slate-500 mt-2">{hint}</div>}
      </div>
    </div>
  );
}
