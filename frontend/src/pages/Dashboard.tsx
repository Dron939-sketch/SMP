import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboard } from "../api/client";
import { GreetingPlayer } from "../components/GreetingPlayer";
import { MetricCard } from "../components/MetricCard";
import type { DashboardPayload, User } from "../types";

const ANCHOR_COLORS: Record<string, string> = {
  engine: "#10b981",
  neutral: "#64748b",
  anchor: "#ef4444",
  anchor_pretender: "#f59e0b",
  unknown: "#334155",
};

function CellMetric({ v, invert }: { v: number; invert?: boolean }) {
  const good = invert ? v <= 2.5 : v >= 3.5;
  const bad = invert ? v >= 4 : v <= 2.5;
  const color = good ? "text-smp-ok" : bad ? "text-smp-crit" : "text-smp-warn";
  return <td className={`py-2 px-2 font-mono ${color}`}>{v.toFixed(1)}</td>;
}

export default function Dashboard({ user }: { user: User }) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    dashboard.political().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err)
    return (
      <div className="card text-smp-crit">Не удалось загрузить дашборд: {err}</div>
    );
  if (!data) return <div className="text-slate-400">Загрузка дашборда…</div>;

  const cm = data.company_metrics;
  const deptRows = Object.entries(data.by_department).map(([dept, m]) => ({
    department: dept,
    stress: m.stress_index,
    trust: m.leadership_trust,
    safety: m.safety_culture,
    brand: m.employer_brand,
  }));
  const anchorRows = Object.entries(data.anchor_engine_distribution).map(
    ([name, value]) => ({ name, value })
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
      {/* Левая колонка: метрики + графики */}
      <div className="xl:col-span-8 space-y-4 sm:space-y-6">
        <header className="card card-accent relative overflow-hidden p-5 sm:p-7">
          <div
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              background:
                "radial-gradient(80% 100% at 0% 0%, rgba(56,189,248,0.18) 0%, transparent 60%), radial-gradient(60% 80% at 100% 0%, rgba(234,179,8,0.10) 0%, transparent 60%)",
            }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="label">Дашборд замполита</div>
              <h1 className="kpi-gradient text-3xl sm:text-4xl font-semibold tracking-tight mt-1">
                {data.company}
              </h1>
              <div className="text-sm text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Цикл: <span className="text-slate-200">{data.cycle_tag}</span>
                </span>
                <span>
                  Респондентов:{" "}
                  <span className="text-slate-200">{data.respondents}</span>
                </span>
                <span>
                  Уникальных ФИО:{" "}
                  <span className="text-slate-200">
                    {data.total_unique_respondents ?? "—"}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link to="/tests" className="btn-primary text-sm">
                Тесты и ссылки
              </Link>
            </div>
          </div>
        </header>

        {/* О системе — цели и возможности приложения */}
        <section className="card">
          <div className="label mb-2">О системе</div>
          <p className="text-sm text-slate-300 leading-relaxed">
            «Замполит» — внутренний инструмент диагностики людей и
            климата. Сотрудники проходят короткие тесты с
            <span className="text-smp-accent"> замаскированными вопросами</span>
            ; ИИ-модуль по совокупности ответов восстанавливает
            скрытые метрики — стресс, доверие к руководству, культуру
            безопасности, бренд работодателя, лояльность.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
            <div className="rounded-xl border border-white/5 p-3">
              <div className="text-smp-accent font-medium mb-1">Цель</div>
              Видеть истинное настроение коллектива — без эффекта
              «социально желательных» ответов.
            </div>
            <div className="rounded-xl border border-white/5 p-3">
              <div className="text-smp-accent font-medium mb-1">Что замеряем</div>
              10 шкал: стресс, выгорание, баланс, бренд, доверие,
              безопасность, карьера, сплочённость, лояльность,
              психобезопасность.
            </div>
            <div className="rounded-xl border border-white/5 p-3">
              <div className="text-smp-accent font-medium mb-1">Главный сигнал</div>
              «Якорь под маской двигателя» — внешне лояльный
              сотрудник, скрыто тормозящий команду.
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <MetricCard label="Стресс" value={cm.stress_index} invert hint="ниже — лучше" />
          <MetricCard label="Риск выгорания" value={cm.burnout_risk} invert hint="ниже — лучше" />
          <MetricCard label="Баланс работа/жизнь" value={cm.work_life_balance} />
          <MetricCard label="Бренд работодателя" value={cm.employer_brand} />
          <MetricCard label="Доверие к рук-ву" value={cm.leadership_trust} />
          <MetricCard label="Безопасность" value={cm.safety_culture} />
          <MetricCard label="Карьера" value={cm.career_clarity} />
          <MetricCard label="Командная сплочённость" value={cm.team_cohesion} />
          <MetricCard label="Лояльность" value={cm.loyalty_intent} />
          <MetricCard label="Психобезопасность" value={cm.psychological_safety} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="card">
            <div className="label mb-2">Срез по отделам</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptRows}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="department" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937" }} />
                  <Bar dataKey="stress" fill="#ef4444" name="стресс" />
                  <Bar dataKey="trust" fill="#22d3ee" name="доверие" />
                  <Bar dataKey="safety" fill="#10b981" name="безопасность" />
                  <Bar dataKey="brand" fill="#f59e0b" name="бренд" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="label mb-2">
              Двигатели и якоря (с подсветкой «pretender»)
            </div>
            <div className="h-64 grid grid-cols-1 sm:grid-cols-2 items-center gap-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={anchorRows} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {anchorRows.map((r) => (
                      <Cell key={r.name} fill={ANCHOR_COLORS[r.name] || "#334155"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937" }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="text-sm space-y-1.5">
                {anchorRows.map((r) => (
                  <li key={r.name} className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: ANCHOR_COLORS[r.name] || "#334155" }}
                    />
                    <span className="capitalize">
                      {r.name.replace("_", " ")}
                    </span>
                    <span className="text-slate-500">— {r.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Подробная таблица по отделам (все 10 метрик) */}
        <section className="card">
          <div className="label mb-3">Подробно по отделам</div>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-slate-500 text-left">
                  <th className="py-2 pr-3 font-medium">Отдел</th>
                  <th className="py-2 px-2 font-medium" title="Стресс">Стр.</th>
                  <th className="py-2 px-2 font-medium" title="Риск выгорания">Выг.</th>
                  <th className="py-2 px-2 font-medium" title="Баланс работа/жизнь">Бал.</th>
                  <th className="py-2 px-2 font-medium" title="Бренд работодателя">Бренд</th>
                  <th className="py-2 px-2 font-medium" title="Доверие к руководству">Дов.</th>
                  <th className="py-2 px-2 font-medium" title="Безопасность">Безоп.</th>
                  <th className="py-2 px-2 font-medium" title="Карьера">Кар.</th>
                  <th className="py-2 px-2 font-medium" title="Сплочённость">Спл.</th>
                  <th className="py-2 px-2 font-medium" title="Лояльность">Лоял.</th>
                  <th className="py-2 px-2 font-medium" title="Психобезопасность">Псих.</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.by_department).map(([dept, m]) => (
                  <tr key={dept} className="border-t border-white/5">
                    <td className="py-2 pr-3 font-medium">{dept}</td>
                    <CellMetric v={m.stress_index} invert />
                    <CellMetric v={m.burnout_risk} invert />
                    <CellMetric v={m.work_life_balance} />
                    <CellMetric v={m.employer_brand} />
                    <CellMetric v={m.leadership_trust} />
                    <CellMetric v={m.safety_culture} />
                    <CellMetric v={m.career_clarity} />
                    <CellMetric v={m.team_cohesion} />
                    <CellMetric v={m.loyalty_intent} />
                    <CellMetric v={m.psychological_safety} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Подробно по объектам */}
        {Object.keys(data.by_site).length > 0 && (
          <section className="card">
            <div className="label mb-3">Подробно по объектам/участкам</div>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-slate-500 text-left">
                    <th className="py-2 pr-3 font-medium">Объект</th>
                    <th className="py-2 px-2 font-medium">Стр.</th>
                    <th className="py-2 px-2 font-medium">Дов.</th>
                    <th className="py-2 px-2 font-medium">Безоп.</th>
                    <th className="py-2 px-2 font-medium">Спл.</th>
                    <th className="py-2 px-2 font-medium">Лоял.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.by_site).map(([s, m]) => (
                    <tr key={s} className="border-t border-white/5">
                      <td className="py-2 pr-3 font-medium">{s}</td>
                      <CellMetric v={m.stress_index} invert />
                      <CellMetric v={m.leadership_trust} />
                      <CellMetric v={m.safety_culture} />
                      <CellMetric v={m.team_cohesion} />
                      <CellMetric v={m.loyalty_intent} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Anchor pretenders */}
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="label">Якоря под маской двигателей</div>
              <div className="text-sm text-slate-400">
                Внешне лояльны, но проективные ответы выдают саботаж
              </div>
            </div>
            <span className="chip bg-amber-500/10 text-amber-300">
              {data.anchor_pretenders.length}
            </span>
          </div>
          {data.anchor_pretenders.length === 0 ? (
            <div className="text-sm text-slate-500">
              За цикл не обнаружено. Хорошие новости, командор.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {data.anchor_pretenders.map((a, i) => (
                <li key={i} className="py-3 flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <div className="text-xs text-slate-500 sm:w-40 shrink-0">
                    {a.department || "—"} · {a.site || "—"}
                    <br />
                    <span className="text-amber-300">
                      conf. {Math.round((a.confidence ?? 0) * 100)}%
                    </span>
                  </div>
                  <div className="text-sm">{a.reasoning}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Employer image */}
        <section className="card">
          <div className="label mb-2">Образ компании в голове сотрудников</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {data.employer_image.top_keywords.map((k) => (
              <span
                key={k.keyword}
                className="chip bg-white/5"
                style={{ fontSize: 12 + Math.min(k.weight * 2, 8) }}
              >
                {k.keyword}
              </span>
            ))}
          </div>
          <ul className="space-y-1.5 text-sm text-slate-300">
            {data.employer_image.sample_sentences.map((s, i) => (
              <li key={i} className="border-l-2 border-smp-accent/40 pl-3">
                {s}
              </li>
            ))}
          </ul>
        </section>

      </div>

      {/* Правая колонка: приветствие + прохождение тестов + алерты */}
      <aside className="xl:col-span-4 space-y-4 sm:space-y-6">
        <GreetingPlayer />

        <div className="card">
          <div className="label mb-2">Прохождение тестов</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-2xl font-semibold">
                {data.total_submissions}
              </div>
              <div className="text-xs text-slate-500">всего ответов</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">
                {data.total_unique_respondents}
              </div>
              <div className="text-xs text-slate-500">уникальных ФИО</div>
            </div>
          </div>
          {data.test_stats.length === 0 ? (
            <div className="text-sm text-slate-500">Тестов ещё нет.</div>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.test_stats.map((t) => (
                <li key={t.test_id} className="flex justify-between gap-2">
                  <span className="truncate">{t.title}</span>
                  <span className="text-slate-500 shrink-0">
                    {t.submissions} / {t.unique_respondents} чел.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="label mb-2">Алерты цикла</div>
          {data.alerts_summary.length === 0 ? (
            <div className="text-sm text-slate-500">Алертов нет.</div>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.alerts_summary.map(([code, count]) => (
                <li key={code} className="flex justify-between">
                  <span>{code.replace(/_/g, " ")}</span>
                  <span className="text-slate-500">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
