import type { DashboardPayload } from "../types";

interface Action {
  priority: "high" | "med" | "low";
  title: string;
  detail: string;
  when: string;
}

/**
 * Эвристический «План на неделю» для замполита.
 * Не требует обращения к ИИ — собирается из текущего payload-а
 * дашборда. Сортирует по приоритету (high → low), показывает 4-5.
 */
export function WeeklyPlan({ data }: { data: DashboardPayload }) {
  const actions = computeActions(data);

  return (
    <section className="card">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <div className="label">План на неделю</div>
          <div className="text-sm text-slate-400 mt-0.5">
            Конкретные шаги — что сделать в ближайшие 7 дней.
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {actions.length} {pluralActions(actions.length)}
        </div>
      </div>

      <ol className="space-y-3">
        {actions.map((a, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-xl border border-white/5 bg-black/20 p-3 sm:p-4"
          >
            <div className="flex flex-col items-center shrink-0 min-w-[40px]">
              <div
                className={`w-8 h-8 rounded-full grid place-items-center font-semibold text-sm ${
                  a.priority === "high"
                    ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/40"
                    : a.priority === "med"
                    ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                    : "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30"
                }`}
              >
                {i + 1}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{a.when}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-100 leading-snug">
                {a.title}
              </div>
              <div className="text-sm text-slate-400 mt-1 leading-relaxed">
                {a.detail}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function pluralActions(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "пункт";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100))
    return "пункта";
  return "пунктов";
}

function computeActions(data: DashboardPayload): Action[] {
  const out: Action[] = [];
  const m = data.company_metrics;

  // 1. Anchor pretenders — личные 1:1.
  for (const a of data.anchor_pretenders.slice(0, 2)) {
    out.push({
      priority: "high",
      title: `1:1 с руководителем «${a.department || "—"}» (${a.site || "участок не указан"})`,
      detail:
        a.reasoning ||
        "Скрытый якорь под маской двигателя — проверить психологическую безопасность в команде.",
      when: "до пт",
    });
  }

  // 2. Критичная безопасность.
  if (m.safety_culture < 3.0) {
    out.push({
      priority: "high",
      title: `Брифинг по ОТ на каждом участке (safety: ${m.safety_culture.toFixed(1)}/5)`,
      detail:
        "Сотрудники не уверены, что сообщать о нарушениях безопасно. Реальный риск инцидента.",
      when: "пн–вт",
    });
  }

  // 3. Стресс.
  if (m.stress_index > 4.0) {
    out.push({
      priority: "med",
      title: `Ревизия графиков и ночных звонков (стресс ${m.stress_index.toFixed(1)}/5)`,
      detail:
        "Команда близка к перегреву. Проверь плечи между сменами, убери поздние звонки от руководителей.",
      when: "до ср",
    });
  }

  // 4. Доверие к руководству.
  if (m.leadership_trust < 3.0) {
    out.push({
      priority: "med",
      title: `Открытые встречи с прорабами и мастерами`,
      detail: `leadership_trust ${m.leadership_trust.toFixed(1)}/5. Снижает поток идей и информации снизу — нужно явно восстанавливать канал.`,
      when: "на этой неделе",
    });
  }

  // 5. Алерты по сигналам.
  const topAlert = (data.alerts_summary || [])[0];
  if (topAlert && out.length < 4) {
    const [code, count] = topAlert;
    out.push({
      priority: "med",
      title: `Разобрать частый сигнал: ${code.replace(/_/g, " ")} (${count}×)`,
      detail: "Самый частый риск-флаг в текущем цикле — собрать аналитику по затронутым отделам.",
      when: "до пт",
    });
  }

  // 6. Пройти новый цикл если давно не было.
  if (data.respondents < 10) {
    out.push({
      priority: "low",
      title: "Раздать ссылку «Пульс недели» по всем участкам",
      detail: `Сейчас всего ${data.respondents} ответов — мало для уверенных выводов. Цель: 30+ респондентов на цикл.`,
      when: "пн",
    });
  }

  // 7. Усилить сильную сторону.
  const top = Math.max(m.employer_brand || 0, m.team_cohesion || 0, m.loyalty_intent || 0);
  if (top >= 4.0 && out.length < 5) {
    out.push({
      priority: "low",
      title: "Подсветить сильную сторону в HR-коммуникациях",
      detail: `Лучшая метрика ${top.toFixed(1)}/5 — это конкурентное преимущество. Включить в пост в VK и в скрипт собеседований.`,
      when: "на этой неделе",
    });
  }

  // Если совсем тихо — два дефолтных пункта.
  if (out.length === 0) {
    out.push({
      priority: "low",
      title: "Запустить квартальный опрос «Образ компании»",
      detail: "Критичных сигналов нет. Подходящий момент для глубокого замера базовой линии.",
      when: "на этой неделе",
    });
    out.push({
      priority: "low",
      title: "Проверить тренды по отделам",
      detail: "Сравни текущие метрики с прошлым циклом — нет ли плоского плато 2+ замера подряд (признак стагнации).",
      when: "пт",
    });
  }

  return out.slice(0, 5);
}
