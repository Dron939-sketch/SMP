// Единый русский словарь для имён шкал, риск-флагов и маркеров валидности.
// Используется на дашборде, в отчётах, в плане недели — везде, где
// бэкенд/LLM может вернуть машинный код, а пользователю нужно слово.

export const METRIC_LABELS: Record<string, string> = {
  stress_index: "Стресс",
  burnout_risk: "Риск выгорания",
  work_life_balance: "Баланс работа/жизнь",
  employer_brand: "Бренд работодателя",
  leadership_trust: "Доверие к руководству",
  safety_culture: "Культура безопасности",
  career_clarity: "Понятность карьеры",
  team_cohesion: "Сплочённость команды",
  loyalty_intent: "Лояльность",
  psychological_safety: "Психологическая безопасность",
  conscientiousness: "Добросовестность",
  openness: "Открытость новому",
  learning_agility: "Обучаемость",
};

export function metricLabel(key: string): string {
  return METRIC_LABELS[key] || key;
}

export const FLAG_LABELS: Record<string, string> = {
  high_stress: "Высокий стресс",
  low_safety_culture: "Низкая безопасность",
  anchor_pretender: "Якорь под маской двигателя",
  burnout_risk: "Риск выгорания",
  high_burnout_risk: "Высокий риск выгорания",
  low_loyalty: "Низкая лояльность",
  low_loyalty_intent: "Низкая лояльность",
  low_trust: "Низкое доверие",
  low_leadership_trust: "Низкое доверие к руководству",
  low_psychological_safety: "Низкая психологическая безопасность",
  low_employer_brand: "Слабый бренд работодателя",
  low_career_clarity: "Непонятная карьера",
  low_team_cohesion: "Низкая сплочённость команды",
  low_work_life_balance: "Перекос работа/жизнь",
  low_engagement: "Низкая вовлечённость",
  low_effort: "Прокликал, не вчитываясь",
  passive_safety_behavior: "Пассивное отношение к безопасности",
  insufficient_data: "Недостаточно данных",
  distracted: "Отвлекался при заполнении",
  mixed_signals: "Смешанные сигналы",
};

export function flagLabel(code: string): string {
  if (FLAG_LABELS[code]) return FLAG_LABELS[code];
  const pretty = code.replace(/_/g, " ").trim();
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export function validityLabel(flag: string | null): string {
  switch (flag) {
    case "ok":
      return "ок";
    case "mixed":
      return "смешано";
    case "low_effort":
      return "прокликал";
    case "distracted":
      return "отвлекался";
    default:
      return "—";
  }
}
