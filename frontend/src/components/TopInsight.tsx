import type { DashboardPayload } from "../types";

/**
 * «Главный инсайт» — самая важная мысль дня, собранная из payload-а
 * дашборда. Логика приоритезации:
 *   1) Есть anchor_pretender с уверенностью >= 0.7 → главный сигнал.
 *   2) Иначе самый критичный alert (low_safety_culture, high_stress).
 *   3) Иначе позитив — лучшая метрика недели.
 */
export function TopInsight({ data }: { data: DashboardPayload }) {
  const insight = computeInsight(data);
  if (!insight) return null;

  const colorByLevel: Record<typeof insight.level, string> = {
    critical:
      "from-red-500/20 to-red-500/0 border-red-500/30 text-red-200",
    warn: "from-amber-500/20 to-amber-500/0 border-amber-500/30 text-amber-200",
    info: "from-cyan-500/15 to-cyan-500/0 border-cyan-500/30 text-cyan-200",
    ok: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30 text-emerald-200",
  };

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 bg-gradient-to-br ${colorByLevel[insight.level]}`}
    >
      <div className="label text-current/70 mb-1">Главный инсайт</div>
      <h2 className="text-xl sm:text-2xl font-semibold leading-tight">
        {insight.title}
      </h2>
      <p className="text-sm text-slate-300 mt-2 leading-relaxed">
        {insight.detail}
      </p>
      {insight.action && (
        <div className="mt-3 text-xs uppercase tracking-wider text-current/80">
          Что сделать: {insight.action}
        </div>
      )}
    </section>
  );
}

type Level = "ok" | "info" | "warn" | "critical";
interface Insight {
  level: Level;
  title: string;
  detail: string;
  action?: string;
}

function computeInsight(data: DashboardPayload): Insight | null {
  if (data.respondents === 0) {
    return {
      level: "info",
      title: "Пока нет данных",
      detail:
        "Раздайте сотрудникам ссылку на «Пульс недели» — после 5–10 ответов появится первый срез настроений.",
      action: "Создать ссылку в разделе «Тесты»",
    };
  }

  // 1. Якорь под маской двигателя — главный сигнал замполита.
  const topAnchor = (data.anchor_pretenders || [])
    .filter((a) => (a.confidence ?? 0) >= 0.7)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  if (topAnchor) {
    return {
      level: "critical",
      title: "Якорь под маской двигателя",
      detail:
        topAnchor.reasoning ||
        `Сотрудник из отдела «${topAnchor.department || "—"}» внешне лоялен, но проективные ответы выдают саботаж.`,
      action: "Провести 1:1 с непосредственным руководителем",
    };
  }

  // 2. Критичные метрики.
  const m = data.company_metrics;
  if (m.safety_culture < 3.0) {
    return {
      level: "critical",
      title: `Просадка по безопасности: ${m.safety_culture.toFixed(1)}/5`,
      detail:
        "Сотрудники сомневаются в готовности сообщать о нарушениях. Растёт риск инцидента на объекте.",
      action: "Внеочередной брифинг по ОТ на каждом участке",
    };
  }
  if (m.stress_index > 4.0) {
    return {
      level: "warn",
      title: `Высокий уровень стресса: ${m.stress_index.toFixed(1)}/5`,
      detail:
        "Команда перегружена. Через 2–3 недели жди роста выгорания и заявок на увольнение.",
      action: "Пересмотреть графики и ночные звонки от руководителей",
    };
  }
  if (m.leadership_trust < 3.0) {
    return {
      level: "warn",
      title: `Доверие к руководству: ${m.leadership_trust.toFixed(1)}/5`,
      detail:
        "Сотрудники реже идут с идеями и проблемами. Информация фильтруется наверх.",
      action: "Цикл «открытых дверей» на участках",
    };
  }

  // 3. Сильная сторона.
  const entries: [string, number, string][] = [
    [m.employer_brand?.toString() || "0", m.employer_brand, "Бренд работодателя"],
    [m.team_cohesion?.toString() || "0", m.team_cohesion, "Командная сплочённость"],
    [m.loyalty_intent?.toString() || "0", m.loyalty_intent, "Лояльность"],
  ];
  const best = entries.sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 4.0) {
    return {
      level: "ok",
      title: `${best[2]}: ${best[1].toFixed(1)}/5`,
      detail:
        "Эту сильную сторону стоит подсветить в HR-коммуникациях и при наборе новых сотрудников.",
    };
  }

  return {
    level: "info",
    title: "Метрики в пределах нормы",
    detail:
      "Критичных сигналов нет. Хороший момент для глубокого квартального опроса «Образ компании».",
  };
}
