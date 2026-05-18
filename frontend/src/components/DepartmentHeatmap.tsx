import type { CompanyMetrics } from "../types";

interface Row {
  dept: string;
  metrics: CompanyMetrics;
}

interface MetricSpec {
  key: keyof CompanyMetrics;
  label: string;
  invert?: boolean;
}

const METRICS: MetricSpec[] = [
  { key: "stress_index", label: "Стресс", invert: true },
  { key: "burnout_risk", label: "Выгорание", invert: true },
  { key: "work_life_balance", label: "Баланс" },
  { key: "employer_brand", label: "Бренд" },
  { key: "leadership_trust", label: "Доверие" },
  { key: "safety_culture", label: "Безопасн." },
  { key: "career_clarity", label: "Карьера" },
  { key: "team_cohesion", label: "Сплочён." },
  { key: "loyalty_intent", label: "Лояльн." },
  { key: "psychological_safety", label: "Псих." },
];

/**
 * Тепловая карта отделов × метрик. Без библиотек, на CSS-grid.
 * Зелёный → жёлтый → красный градиент по «насколько плохо», с учётом
 * invert у негативных метрик. Premium-вид за счёт мягких теней и
 * inset-glow.
 */
export function DepartmentHeatmap({
  byDepartment,
}: {
  byDepartment: Record<string, CompanyMetrics>;
}) {
  const rows: Row[] = Object.entries(byDepartment).map(([dept, metrics]) => ({
    dept,
    metrics,
  }));

  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="label mb-2">Тепловая карта по отделам</div>
        <div className="text-sm text-slate-500">
          Данных по отделам пока нет.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-end justify-between mb-3 gap-3">
        <div>
          <div className="label">Тепловая карта</div>
          <div className="text-sm text-slate-400 mt-0.5">
            10 метрик × {rows.length} {rows.length === 1 ? "отдел" : "отдела/-ов"}.
            Зелёный — норма, красный — проблема.
          </div>
        </div>
        <Legend />
      </div>
      <div className="overflow-x-auto -mx-2 px-2">
        <div
          className="grid gap-1 min-w-[640px]"
          style={{
            gridTemplateColumns: `minmax(120px, 1fr) repeat(${METRICS.length}, minmax(56px, 1fr))`,
          }}
        >
          <div />
          {METRICS.map((m) => (
            <div
              key={m.key}
              className="text-[10px] uppercase tracking-wider text-slate-500 text-center py-1"
              title={m.label}
            >
              {m.label}
            </div>
          ))}
          {rows.map((r) => (
            <FullRow key={r.dept} row={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FullRow({ row }: { row: Row }) {
  return (
    <>
      <div className="flex items-center text-sm font-medium pl-1 text-slate-200 truncate">
        {row.dept}
      </div>
      {METRICS.map((m) => {
        const v = Number(row.metrics[m.key] || 0);
        const norm = m.invert ? 5 - v : v;
        const { bg, text } = cellColor(norm);
        return (
          <div
            key={m.key}
            className={`rounded-lg ${bg} ${text} text-center text-sm py-2 font-mono`}
            style={{
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
            title={`${m.label}: ${v.toFixed(1)}/5`}
          >
            {v.toFixed(1)}
          </div>
        );
      })}
    </>
  );
}

function cellColor(norm: number): { bg: string; text: string } {
  if (norm >= 4) return { bg: "bg-emerald-500/25", text: "text-emerald-200" };
  if (norm >= 3.5) return { bg: "bg-emerald-500/15", text: "text-emerald-200" };
  if (norm >= 3) return { bg: "bg-amber-500/15", text: "text-amber-200" };
  if (norm >= 2.5) return { bg: "bg-amber-500/25", text: "text-amber-200" };
  if (norm >= 1.5) return { bg: "bg-red-500/20", text: "text-red-200" };
  return { bg: "bg-red-500/30", text: "text-red-200" };
}

function Legend() {
  return (
    <div className="flex items-center gap-1 text-[10px] text-slate-500">
      <span>0</span>
      <span className="inline-block w-3 h-3 rounded bg-red-500/30" />
      <span className="inline-block w-3 h-3 rounded bg-amber-500/25" />
      <span className="inline-block w-3 h-3 rounded bg-amber-500/15" />
      <span className="inline-block w-3 h-3 rounded bg-emerald-500/15" />
      <span className="inline-block w-3 h-3 rounded bg-emerald-500/25" />
      <span>5</span>
    </div>
  );
}
