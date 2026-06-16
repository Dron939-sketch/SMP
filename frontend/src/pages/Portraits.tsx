import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { portraits } from "../api/client";
import type {
  PortraitCompany,
  PortraitEmployeeDetail,
  PortraitEmployeesResponse,
} from "../types";

type Tab = "employees" | "company";

const PORTRAITS_PASSWORD = "1004";
const PORTRAITS_AUTH_KEY = "smp_portraits_unlocked";

// === Локализация ===

const METRIC_LABEL: Record<string, string> = {
  // Основные 10 шкал замполита
  stress_index: "Стресс",
  burnout_risk: "Риск выгорания",
  work_life_balance: "Баланс работа/жизнь",
  employer_brand: "Бренд работодателя",
  leadership_trust: "Доверие к руководству",
  safety_culture: "Культура безопасности",
  career_clarity: "Ясность карьеры",
  team_cohesion: "Сплочённость команды",
  loyalty_intent: "Лояльность",
  psychological_safety: "Психобезопасность",
  // Кадровый резерв / Big Five
  conscientiousness: "Добросовестность",
  openness: "Открытость к новому",
  extraversion: "Экстраверсия",
  agreeableness: "Согласие",
  neuroticism: "Тревожность",
  emotional_stability: "Эмоциональная устойчивость",
  learning_agility: "Обучаемость",
  // Прочее
  engagement: "Вовлечённость",
  meaning: "Осмысленность",
  autonomy: "Самостоятельность",
  proactivity: "Проактивность",
  initiative: "Инициативность",
  resilience: "Резильентность",
  optimism: "Оптимизм",
  self_efficacy: "Уверенность в себе",
  hope: "Надежда на будущее",
  org_politics: "Внутренняя политика",
  lmx: "Связь с руководителем",
  perceived_org_support: "Чувство поддержки",
  collaboration: "Сотрудничество",
  communication: "Коммуникация",
  initiative_taking: "Инициатива",
  decision_making: "Решительность",
  problem_solving: "Решение проблем",
};

// Метрики где низкое значение = хорошо
const INVERTED_METRICS = new Set(["stress_index", "burnout_risk"]);

const RISK_FLAG_LABEL: Record<string, string> = {
  high_stress: "Высокий стресс",
  low_stress: "Низкий стресс (хорошо)",
  moderate_stress: "Умеренный стресс",
  high_burnout_risk: "Высокий риск выгорания",
  low_leadership_trust: "Низкое доверие к руководству",
  low_safety_culture: "Низкая культура безопасности",
  low_psychological_safety: "Низкая психобезопасность",
  low_team_cohesion: "Низкая сплочённость команды",
  low_career_clarity: "Размытая карьерная траектория",
  low_loyalty: "Низкая лояльность",
  high_loyalty: "Высокая лояльность",
  high_loyalty_intent: "Сильная привязанность",
  anchor_pretender: "Якорь под маской двигателя",
  potential_anchor_pretender: "Возможный якорь-притворщик",
  work_life_imbalance: "Перекос работа/жизнь",
  tenure_risk: "Риск ухода по стажу",
  low_tenure_risk: "Стажный риск низкий",
  salary_concern: "Озабоченность зарплатой",
  unclear_career_path: "Непонятная карьера",
  high_employer_brand: "Высокий бренд работодателя",
  high_employer_brand_but_conditional_loyalty:
    "Высокий бренд, но условная лояльность",
  high_employer_brand_loyalty_gap: "Разрыв «бренд–лояльность»",
  low_risk: "Низкий риск",
};

const ANCHOR_COLOR: Record<string, string> = {
  engine: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  neutral: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  anchor: "bg-red-500/15 text-red-300 border-red-500/30",
  anchor_pretender: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const ANCHOR_LABEL: Record<string, string> = {
  engine: "Двигатель",
  neutral: "Нейтрал",
  anchor: "Якорь",
  anchor_pretender: "Якорь под маской",
};

const ANCHOR_HR_ACTION: Record<string, { title: string; text: string }> = {
  engine: {
    title: "Поддерживать и развивать",
    text:
      "Двигатель — даёт темп команде. Поддержать большой ответственностью, видимым признанием, чётким путём к росту. " +
      "Риск потерять при отсутствии челленджа: уйдёт туда, где быстрее растёт.",
  },
  neutral: {
    title: "Выяснить барьер",
    text:
      "Нейтрал — часто бывший двигатель после демотивации (несправедливость, потолок, конфликт). " +
      "Провести 1:1 с открытыми вопросами: «что мешает?», «что бы изменил?». " +
      "Чаще всего возвращается в режим двигателя одним конкретным действием.",
  },
  anchor: {
    title: "Открытый разговор о ролях",
    text:
      "Якорь — расхождение ценностей и/или интересов с компанией. " +
      "Держать на ключевых позициях нельзя: задаёт минусовой темп. " +
      "Либо честный разговор о переходе на другую роль, либо план выхода.",
  },
  anchor_pretender: {
    title: "HR-беседа в течение 2 недель",
    text:
      "Внешне лоялен, в проективных ответах — ментально уже ушёл. " +
      "Не «удерживать», а провести честный разговор о его перспективе. " +
      "Чаще всего фактический уход случится в ближайшие 6–9 месяцев.",
  },
};

// === Категоризация метрик ===

function classifyMetric(
  key: string,
  value: number,
): "strength" | "risk" | "neutral" {
  const inverted = INVERTED_METRICS.has(key);
  if (inverted) {
    if (value <= 2.0) return "strength";
    if (value >= 3.5) return "risk";
    return "neutral";
  }
  if (value >= 3.8) return "strength";
  if (value <= 2.2) return "risk";
  return "neutral";
}

function ruLabel(key: string): string {
  return METRIC_LABEL[key] || key.replace(/_/g, " ");
}

function ruRiskFlag(key: string): string {
  return RISK_FLAG_LABEL[key] || key.replace(/_/g, " ");
}

// === Password gate ===

function PortraitsPasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(false);

  const tryUnlock = () => {
    if (pwd === PORTRAITS_PASSWORD) {
      try {
        sessionStorage.setItem(PORTRAITS_AUTH_KEY, "1");
      } catch {}
      onUnlock();
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 1200);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="card text-center space-y-4 p-6">
        <div className="text-4xl">🔒</div>
        <h2 className="text-xl font-semibold">Раздел с PII</h2>
        <p className="text-sm text-slate-400">
          Портреты содержат ФИО сотрудников и индивидуальные оценки.
          Доступ — по паролю.
        </p>
        <input
          type="password"
          value={pwd}
          onChange={(e) => {
            setPwd(e.target.value);
            setErr(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") tryUnlock();
          }}
          autoFocus
          placeholder="Пароль"
          className={`w-full bg-white/5 border rounded-lg px-3 py-2.5 text-center text-lg tracking-widest outline-none transition ${
            err
              ? "border-red-500/60 animate-pulse"
              : "border-white/10 focus:border-smp-accent"
          }`}
        />
        {err && <div className="text-sm text-red-400">Неверный пароль</div>}
        <button onClick={tryUnlock} className="btn-primary w-full">
          Войти
        </button>
        <Link
          to="/"
          className="block text-xs text-slate-500 hover:text-slate-300"
        >
          ← Назад на дашборд
        </Link>
      </div>
    </div>
  );
}

// === Main ===

export default function Portraits() {
  const [tab, setTab] = useState<Tab>("employees");
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(PORTRAITS_AUTH_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!unlocked)
    return <PortraitsPasswordGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label">Портреты</div>
          <h1 className="text-2xl sm:text-3xl font-semibold">
            Сотрудники и компания
          </h1>
          <div className="text-sm text-slate-400">
            Сводные психопортреты по сумме всех пройденных тестов
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/" className="btn-ghost text-sm">
            ← Дашборд
          </Link>
        </div>
      </header>

      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setTab("employees")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "employees"
              ? "border-smp-accent text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🧑‍🔧 Сотрудники
        </button>
        <button
          onClick={() => setTab("company")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "company"
              ? "border-smp-accent text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🏢 Компания глазами сотрудников
        </button>
      </div>

      {tab === "employees" ? <EmployeesTab /> : <CompanyTab />}
    </div>
  );
}

// === Employees tab ===

function EmployeesTab() {
  const [data, setData] = useState<PortraitEmployeesResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    portraits.employees().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err)
    return <div className="card text-smp-crit">Не удалось загрузить: {err}</div>;
  if (!data) return <div className="text-slate-400">Загрузка…</div>;

  const filtered = data.items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.full_name.toLowerCase().includes(q) ||
      (it.department || "").toLowerCase().includes(q) ||
      (it.position || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Список: на мобильном скрывается когда выбран сотрудник,
          на десктопе (lg+) всегда виден сбоку */}
      <div
        className={
          selected
            ? "hidden lg:block lg:col-span-4"
            : "lg:col-span-12"
        }
      >
        <div className="flex items-center gap-3 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ФИО, отделу, должности…"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-smp-accent"
          />
          <span className="text-xs text-slate-500">
            {filtered.length} / {data.count}
          </span>
        </div>
        <ul className="space-y-2">
          {filtered.map((it) => (
            <li key={it.user_id}>
              <button
                onClick={() => {
                  setSelected(it.user_id);
                  // На мобильном — после клика прокрутить наверх
                  if (typeof window !== "undefined" && window.innerWidth < 1024) {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className={`w-full text-left card hover:border-smp-accent/40 transition cursor-pointer ${
                  selected === it.user_id ? "border-smp-accent/60" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.full_name}</div>
                    {(it.position || it.department) && (
                      <div className="text-xs text-slate-500 truncate">
                        {it.position || "—"} · {it.department || "—"}
                      </div>
                    )}
                  </div>
                  {it.anchor_engine && (
                    <span
                      className={`chip border whitespace-nowrap ${
                        ANCHOR_COLOR[it.anchor_engine] ||
                        "bg-white/5 border-white/10"
                      }`}
                    >
                      {ANCHOR_LABEL[it.anchor_engine] || it.anchor_engine}
                      {it.anchor_engine_confidence != null && (
                        <span className="ml-1 opacity-70">
                          {Math.round(it.anchor_engine_confidence * 100)}%
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="text-slate-500">
                    тестов: {it.tests_passed}
                  </span>
                  {it.risk_flags.slice(0, 3).map((f) => (
                    <span
                      key={f}
                      className="chip bg-red-500/10 text-red-300 border border-red-500/20"
                    >
                      {ruRiskFlag(f)}
                    </span>
                  ))}
                  {it.risk_flags.length > 3 && (
                    <span className="text-slate-500">
                      +{it.risk_flags.length - 3}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="text-slate-500 text-sm">
              Никого не нашли по фильтру.
            </li>
          )}
        </ul>
      </div>

      {selected && (
        <div className="lg:col-span-8">
          <EmployeePortrait
            userId={selected}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}

// === Сводный портрет сотрудника ===

function EmployeePortrait({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [d, setD] = useState<PortraitEmployeeDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState(false);

  useEffect(() => {
    setD(null);
    portraits
      .employee(userId)
      .then(setD)
      .catch((e) => setErr(e.message));
  }, [userId]);

  if (err) return <div className="card text-smp-crit">{err}</div>;
  if (!d) return <div className="text-slate-400">Загрузка портрета…</div>;

  const latest = d.history[d.history.length - 1];
  const anchor = latest?.anchor_engine || null;
  const action = anchor ? ANCHOR_HR_ACTION[anchor] : null;

  // Radar data
  const radarData = Object.entries(d.avg_metrics).map(([k, v]) => ({
    metric: ruLabel(k),
    raw_key: k,
    // Инвертируем стресс/выгорание чтобы на радаре «больше = лучше» всегда
    value: INVERTED_METRICS.has(k) ? Math.max(0, 5 - v) : v,
    actual: v,
  }));

  // Strengths / risks
  const strengths: { label: string; value: number; raw: number }[] = [];
  const risks: { label: string; value: number; raw: number }[] = [];
  Object.entries(d.avg_metrics).forEach(([k, v]) => {
    const cls = classifyMetric(k, v);
    if (cls === "strength")
      strengths.push({ label: ruLabel(k), value: v, raw: v });
    else if (cls === "risk")
      risks.push({ label: ruLabel(k), value: v, raw: v });
  });

  // Top 3 metrics for timeline
  const timelineKeys = Object.entries(d.metric_timeline)
    .filter(([, points]) => points.length >= 2)
    .map(([k]) => k)
    .slice(0, 5);

  const timelineData = useMemo(() => {
    if (!timelineKeys.length) return [];
    // build cycle → metrics map (значения смешанные — cycle_tag строка, метрики числа)
    const map: Record<string, Record<string, string | number>> = {};
    for (const k of timelineKeys) {
      for (const p of d.metric_timeline[k] || []) {
        if (!map[p.cycle_tag]) {
          map[p.cycle_tag] = { cycle_tag: p.cycle_tag };
        }
        map[p.cycle_tag][k] = p.value;
      }
    }
    return Object.values(map);
  }, [d, timelineKeys]);

  return (
    <div className="space-y-4 sticky top-4">
      {/* Кнопка «К списку» — только на мобильном (на десктопе список рядом) */}
      <button
        onClick={onClose}
        className="lg:hidden btn-ghost text-sm w-full text-left flex items-center gap-2"
      >
        ← К списку сотрудников
      </button>

      {/* 1. ID card */}
      <div className="card">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-semibold">{d.user.full_name}</h2>
            {(d.user.position || d.user.department || d.user.site) && (
              <div className="text-sm text-slate-400">
                {d.user.position || "—"} · {d.user.department || "—"} ·{" "}
                {d.user.site || "—"}
              </div>
            )}
            <div className="text-xs text-slate-500 mt-1">
              Тестов пройдено: <span className="text-slate-300">{d.tests_passed}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost text-xs hidden lg:inline-flex"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {anchor && action && (
          <div
            className={`border rounded-lg p-3 ${
              ANCHOR_COLOR[anchor] || "bg-white/5 border-white/10"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="font-semibold">
                {ANCHOR_LABEL[anchor] || anchor}
              </div>
              {latest.anchor_engine_confidence != null && (
                <span className="text-xs opacity-80">
                  уверенность {Math.round(latest.anchor_engine_confidence * 100)}%
                </span>
              )}
            </div>
            {latest.anchor_engine_reasoning && (
              <div className="text-sm opacity-90 italic">
                {latest.anchor_engine_reasoning}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Краткое описание (latest summary) */}
      {latest?.summary && (
        <div className="card">
          <div className="label mb-2">Краткое описание</div>
          <p className="text-sm leading-relaxed text-slate-200">
            {latest.summary}
          </p>
        </div>
      )}

      {/* 3. Радар метрик */}
      {radarData.length >= 3 && (
        <div className="card">
          <div className="label mb-2">
            Профиль метрик (сумма по всем тестам)
          </div>
          <div className="text-xs text-slate-500 mb-2">
            Шкала 0–5. Стресс и выгорание инвертированы — «больше = лучше».
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1f2937" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <PolarRadiusAxis
                  domain={[0, 5]}
                  tick={{ fontSize: 10, fill: "#475569" }}
                />
                <Radar
                  dataKey="value"
                  stroke="#22d3ee"
                  fill="#22d3ee"
                  fillOpacity={0.3}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #1f2937",
                    fontSize: 12,
                  }}
                  formatter={(value: unknown, _name: unknown, item: unknown) => {
                    // Показываем реальное (не инвертированное) значение метрики
                    const actual = (item as { payload?: { actual?: number } })?.payload?.actual;
                    return [
                      typeof actual === "number" ? actual.toFixed(2) : String(value),
                      "значение",
                    ];
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Сильные стороны / Зоны риска */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card">
          <div className="label mb-2 text-emerald-300">✅ Сильные стороны</div>
          {strengths.length === 0 ? (
            <div className="text-sm text-slate-500">
              Явных сильных сторон нет — все метрики средние.
            </div>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {strengths.map((s) => (
                <li key={s.label} className="flex items-center justify-between">
                  <span>{s.label}</span>
                  <span className="font-mono text-emerald-300">
                    {s.raw.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="label mb-2 text-red-300">⚠️ Зоны риска</div>
          {risks.length === 0 ? (
            <div className="text-sm text-slate-500">
              Серьёзных рисков по метрикам не выявлено.
            </div>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {risks.map((r) => (
                <li key={r.label} className="flex items-center justify-between">
                  <span>{r.label}</span>
                  <span className="font-mono text-red-300">
                    {r.raw.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 5. Динамика (если есть >=2 циклов) */}
      {timelineKeys.length > 0 && timelineData.length >= 2 && (
        <div className="card">
          <div className="label mb-2">Динамика метрик по циклам</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="cycle_tag"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #1f2937",
                    fontSize: 12,
                  }}
                />
                {timelineKeys.map((k, i) => {
                  const colors = [
                    "#22d3ee",
                    "#f59e0b",
                    "#10b981",
                    "#ef4444",
                    "#a78bfa",
                  ];
                  return (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={colors[i % colors.length]}
                      strokeWidth={2}
                      name={ruLabel(k)}
                      dot={{ r: 3 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 6. Риск-флаги с пояснениями */}
      {Object.keys(d.risk_freq).length > 0 && (
        <div className="card">
          <div className="label mb-2">Все риск-флаги</div>
          <ul className="space-y-1.5 text-sm">
            {Object.entries(d.risk_freq).map(([f, c]) => (
              <li
                key={f}
                className="flex items-center justify-between gap-2 border-l-2 border-red-500/30 pl-3"
              >
                <span>{ruRiskFlag(f)}</span>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  встречалось {c}× из {d.tests_passed}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 7. HR-действие на основе якоря */}
      {anchor && action && (
        <div className="card">
          <div className="label mb-2">Что делать (HR-действие)</div>
          <div className="border border-white/10 rounded-lg p-3 bg-white/[0.02]">
            <div className="font-semibold mb-1">{action.title}</div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {action.text}
            </p>
          </div>
          {d.top_recommendations.length > 0 && (
            <div className="mt-3">
              <div className="text-xs uppercase text-slate-500 tracking-wide mb-1">
                Конкретные рекомендации (по частоте)
              </div>
              <ul className="space-y-1 text-sm text-slate-300">
                {d.top_recommendations.slice(0, 8).map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-500">→</span>
                    <span>
                      {r.text}
                      {r.count > 1 && (
                        <span className="text-xs text-slate-500 ml-2">
                          ×{r.count}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 8. История по циклам — раскрывающаяся */}
      <div className="card">
        <button
          onClick={() => setOpenHistory((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="label">
            История по циклам ({d.history.length})
          </span>
          <span className="text-slate-500 text-sm">
            {openHistory ? "скрыть ▲" : "развернуть ▼"}
          </span>
        </button>
        {openHistory && (
          <ul className="space-y-3 mt-3">
            {d.history
              .slice()
              .reverse()
              .map((h, i) => (
                <li
                  key={i}
                  className="border border-white/5 rounded-lg p-3 bg-white/[0.02]"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span>
                      {h.cycle_tag}
                      {h.submitted_at &&
                        " · " +
                          new Date(h.submitted_at).toLocaleDateString("ru-RU")}
                    </span>
                    {h.anchor_engine && (
                      <span
                        className={`chip border ${
                          ANCHOR_COLOR[h.anchor_engine] ||
                          "bg-white/5 border-white/10"
                        }`}
                      >
                        {ANCHOR_LABEL[h.anchor_engine] || h.anchor_engine}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed mb-2">
                    {h.summary}
                  </p>
                  {h.anchor_engine_reasoning && (
                    <div className="text-xs text-slate-500 italic mb-2">
                      Обоснование: {h.anchor_engine_reasoning}
                    </div>
                  )}
                  {h.recommendations.length > 0 && (
                    <ul className="text-xs text-slate-400 space-y-1 mt-2">
                      {h.recommendations.slice(0, 3).map((r, j) => (
                        <li key={j}>→ {r}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// === Company tab (без изменений по структуре, только локализация) ===

function CompanyTab() {
  const [d, setD] = useState<PortraitCompany | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    portraits.company().then(setD).catch((e) => setErr(e.message));
  }, []);

  if (err)
    return <div className="card text-smp-crit">Не удалось загрузить: {err}</div>;
  if (!d) return <div className="text-slate-400">Загрузка портрета компании…</div>;

  const maxWeight = Math.max(...d.top_keywords.map((k) => k.weight), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      <div className="lg:col-span-7 space-y-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <div className="label">Облако слов — образ компании</div>
            <span className="text-xs text-slate-500">
              {d.respondents} ответов
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.top_keywords.map((k) => {
              const scale = 0.7 + (k.weight / maxWeight) * 1.1;
              return (
                <span
                  key={k.keyword}
                  className="inline-block px-2.5 py-1 rounded-full bg-white/5 border border-white/10"
                  style={{ fontSize: `${scale}rem` }}
                  title={`вес ${k.weight} · упомянуто ${k.mentions}×`}
                >
                  {k.keyword}
                </span>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="label mb-2 text-red-300">
            🚩 Тёмные сигналы (что портит образ)
          </div>
          {d.dark_signals.length === 0 ? (
            <div className="text-sm text-slate-500">
              Явных проблемных сигналов нет.
            </div>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {d.dark_signals.map((s) => (
                <li
                  key={s}
                  className="chip bg-red-500/10 text-red-300 border border-red-500/20"
                >
                  {ruRiskFlag(s)} ({d.flag_freq[s] || 0})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="label mb-2 text-emerald-300">
            🌿 Светлые сигналы
          </div>
          {d.light_signals.length === 0 ? (
            <div className="text-sm text-slate-500">Нет.</div>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {d.light_signals.map((s) => (
                <li
                  key={s}
                  className="chip bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                >
                  {ruRiskFlag(s)} ({d.flag_freq[s] || 0})
                </li>
              ))}
            </ul>
          )}
        </div>

        {Object.keys(d.by_department_top_keywords).length > 0 && (
          <div className="card">
            <div className="label mb-2">Топ-слова по отделам</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {Object.entries(d.by_department_top_keywords).map(
                ([dept, words]) => (
                  <div
                    key={dept}
                    className="border border-white/5 rounded-lg p-3"
                  >
                    <div className="text-xs uppercase text-slate-500 tracking-wide mb-1">
                      {dept}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {words.map((w) => (
                        <span
                          key={w}
                          className="text-xs px-1.5 py-0.5 rounded bg-white/5"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-5">
        <div className="card">
          <div className="label mb-2">Цитаты сотрудников</div>
          <ul className="space-y-2 text-sm max-h-[600px] overflow-y-auto pr-1">
            {d.sample_sentences.map((s, i) => (
              <li
                key={i}
                className="border-l-2 border-smp-accent/40 pl-3 text-slate-300"
              >
                <p>«{s.text}»</p>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  цикл {s.cycle_tag}
                </div>
              </li>
            ))}
            {d.sample_sentences.length === 0 && (
              <li className="text-slate-500">
                Цитат за этот цикл не собрано.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
