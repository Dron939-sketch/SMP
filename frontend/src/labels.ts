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
  // Стресс / выгорание
  high_stress: "Высокий стресс",
  moderate_stress: "Умеренный стресс",
  low_stress: "Низкий стресс — хорошо",
  burnout_risk: "Риск выгорания",
  high_burnout_risk: "Высокий риск выгорания",
  low_burnout_risk: "Низкий риск выгорания — хорошо",

  // Безопасность
  low_safety_culture: "Низкая культура безопасности",
  high_safety_culture: "Сильная культура безопасности",
  passive_safety_behavior: "Пассивное отношение к безопасности",

  // Лояльность / привязанность
  low_loyalty: "Низкая лояльность",
  low_loyalty_intent: "Низкая лояльность",
  high_loyalty: "Высокая лояльность",
  high_loyalty_intent: "Сильная привязанность",
  high_loyalty_with_reservations: "Лояльность с оговорками",
  conditional_loyalty: "Условная лояльность",

  // Доверие / психобезопасность
  low_trust: "Низкое доверие",
  low_leadership_trust: "Низкое доверие к руководству",
  high_leadership_trust: "Высокое доверие к руководству",
  low_psychological_safety: "Низкая психобезопасность",
  high_psychological_safety: "Высокая психобезопасность",
  low_psychological_safety_indicators: "Низкие индикаторы психобезопасности",

  // Бренд работодателя
  low_employer_brand: "Слабый бренд работодателя",
  high_employer_brand: "Сильный бренд работодателя",
  high_employer_brand_but_conditional_loyalty:
    "Сильный бренд, но условная лояльность",
  high_employer_brand_loyalty_gap: "Разрыв «бренд–лояльность»",

  // Карьера / стаж / деньги
  low_career_clarity: "Размытая карьерная траектория",
  unclear_career_path: "Непонятная карьерная траектория",
  career_concern: "Тревога о карьере",
  salary_concern: "Озабоченность зарплатой",
  tenure_risk: "Риск ухода по стажу",
  low_tenure_risk: "Стажный риск низкий — хорошо",
  high_tenure_risk: "Высокий риск ухода по стажу",

  // Команда / коммуникация
  low_team_cohesion: "Низкая сплочённость команды",
  high_team_cohesion: "Сильная сплочённость команды",
  low_engagement: "Низкая вовлечённость",
  low_communication: "Слабая коммуникация",

  // Якорь / двигатель
  anchor_pretender: "Якорь под маской двигателя",
  potential_anchor_pretender: "Возможный якорь-притворщик",
  is_engine: "Двигатель",
  is_anchor: "Якорь",

  // Баланс / общий риск
  low_work_life_balance: "Перекос работа/жизнь",
  work_life_balance_concern: "Перекос работа/жизнь",
  work_life_imbalance: "Перекос работа/жизнь",

  // Уровень риска
  low_risk: "Низкий риск — хорошо",
  moderate_risk: "Средний риск",
  high_risk: "Высокий риск",

  // Валидность ответа
  low_effort: "Прокликал, не вчитываясь",
  insufficient_data: "Недостаточно данных",
  distracted: "Отвлекался при заполнении",
  mixed_signals: "Смешанные сигналы",
  rushed: "Заполнял слишком быстро",
  inconsistent: "Противоречивые ответы",
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
