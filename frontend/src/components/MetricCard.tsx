export function MetricCard({
  label,
  value,
  hint,
  invert,
}: {
  label: string;
  value: number;
  hint?: string;
  invert?: boolean;
}) {
  const good = invert ? value <= 2.5 : value >= 3.5;
  const bad = invert ? value >= 4 : value <= 2.5;
  const color = good ? "text-smp-ok" : bad ? "text-smp-crit" : "text-smp-warn";
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${color}`}>
        {value.toFixed(1)}
        <span className="text-base text-slate-500 font-normal"> / 5</span>
      </div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
