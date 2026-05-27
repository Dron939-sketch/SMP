interface Props {
  distribution: Record<string, number>;
}

const ORDER = ["engine", "neutral", "anchor_pretender", "anchor"];
const COLOR: Record<string, string> = {
  engine: "#10b981",
  neutral: "#64748b",
  anchor_pretender: "#f59e0b",
  anchor: "#ef4444",
  unknown: "#334155",
};
const LABEL: Record<string, string> = {
  engine: "двигатели",
  neutral: "нейтральны",
  anchor_pretender: "якори под маской",
  anchor: "якори",
  unknown: "не классифиц.",
};

/**
 * Премиум-донат на чистом SVG: толстое кольцо с градиентами, в
 * центре крупный KPI (% двигателей), под ним подпись.
 * Никаких легенд-стандартных от Recharts — своя сетка чипов справа.
 */
export function EngineDonut({ distribution }: Props) {
  const entries = ORDER.map((k) => ({
    name: k,
    value: distribution[k] || 0,
  })).filter((e) => e.value > 0);
  if (entries.length === 0 && distribution.unknown) {
    entries.push({ name: "unknown", value: distribution.unknown });
  }
  const total = entries.reduce((s, e) => s + e.value, 0);
  const engines = distribution.engine || 0;
  const enginesPct = total ? Math.round((engines / total) * 100) : 0;

  // SVG-доли
  const radius = 78;
  const strokeWidth = 22;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = entries.map((e) => {
    const portion = total ? e.value / total : 0;
    const len = portion * circ;
    const arc = (
      <circle
        key={e.name}
        r={radius}
        cx={100}
        cy={100}
        fill="transparent"
        stroke={COLOR[e.name] || COLOR.unknown}
        strokeWidth={strokeWidth}
        strokeDasharray={`${len} ${circ - len}`}
        strokeDashoffset={-offset}
        transform="rotate(-90 100 100)"
        style={{
          filter: `drop-shadow(0 0 6px ${COLOR[e.name] || COLOR.unknown}55)`,
          transition: "stroke-dasharray 0.6s ease",
        }}
      />
    );
    offset += len;
    return arc;
  });

  return (
    <div className="card">
      <div className="label mb-3">Двигатели и якоря</div>
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-5 items-center">
        <div className="relative grid place-items-center">
          <svg viewBox="0 0 200 200" className="w-44 h-44">
            <circle
              r={radius}
              cx={100}
              cy={100}
              fill="transparent"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={strokeWidth}
            />
            {arcs}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                Двигателей
              </div>
              <div className="text-4xl font-semibold kpi-gradient kpi-value">
                {enginesPct}%
              </div>
              <div className="text-[11px] text-slate-500">
                из {total} классифиц.
              </div>
            </div>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {entries.map((e) => {
            const pct = total ? Math.round((e.value / total) * 100) : 0;
            return (
              <li key={e.name} className="flex items-center gap-3">
                <span
                  className="inline-block w-3 h-3 rounded-full shrink-0"
                  style={{
                    background: COLOR[e.name] || COLOR.unknown,
                    boxShadow: `0 0 8px ${COLOR[e.name] || COLOR.unknown}66`,
                  }}
                />
                <span className="flex-1 text-slate-300 truncate">
                  {LABEL[e.name] || e.name}
                </span>
                <span className="font-mono text-slate-200">{e.value}</span>
                <span className="text-xs text-slate-500 w-10 text-right">
                  {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
