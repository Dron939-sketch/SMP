"""Анализ времени ответа.

Задача: определить, реально ли респондент думал, или просто «прокликал»
шкалу. Эвристика:

  - на закрытом вопросе (likert/single/multiple) < 1500мс — «rushed»;
  - на открытом вопросе < 5000мс — «rushed»;
  - доля rushed > 60% → validity_flag = "low_effort";
  - доля rushed > 30% и < 60% → "mixed";
  - иначе → "ok";
  - если total_time_ms > 4x ожидаемого → "distracted" (отвлекался).

Эти флаги пробрасываются в дашборд (виджет «качество ответов») и в
системный промт LLM как контекст «учти, что респондент торопился».
"""

from __future__ import annotations

import statistics
from typing import Any

# Ожидаемое минимальное время «осмысленного» ответа, мс.
_MIN_THINK_MS = {
    "likert_5": 1500,
    "single_choice": 1500,
    "multiple_choice": 2500,
    "ranking": 4000,
    "scenario": 4000,
    "open_text": 5000,
}

# Среднее ожидаемое время — для оценки distracted.
_AVG_THINK_MS = {
    "likert_5": 4000,
    "single_choice": 5000,
    "multiple_choice": 8000,
    "ranking": 12000,
    "scenario": 15000,
    "open_text": 25000,
}


def analyze(
    answers: list[dict[str, Any]],
    *,
    question_types: dict[str, str] | None = None,
    total_time_ms: int | None = None,
) -> dict[str, Any]:
    """Возвращает {median_time_per_question_ms, rushed_share, validity_flag}."""
    times = [a.get("time_spent_ms") for a in answers if a.get("time_spent_ms")]
    median = int(statistics.median(times)) if times else None

    rushed_count = 0
    counted = 0
    for a in answers:
        ms = a.get("time_spent_ms")
        if not ms:
            continue
        counted += 1
        qtype = (question_types or {}).get(str(a.get("question_id")), "likert_5")
        if ms < _MIN_THINK_MS.get(qtype, 1500):
            rushed_count += 1
    rushed_share = round(rushed_count / counted, 2) if counted else None

    flag: str | None = None
    if rushed_share is not None:
        if rushed_share >= 0.6:
            flag = "low_effort"
        elif rushed_share >= 0.3:
            flag = "mixed"
        else:
            flag = "ok"

    if total_time_ms is not None and question_types:
        expected = sum(
            _AVG_THINK_MS.get(qt, 5000) for qt in question_types.values()
        )
        if expected and total_time_ms > expected * 4:
            flag = "distracted"

    return {
        "median_time_per_question_ms": median,
        "rushed_share": rushed_share,
        "validity_flag": flag,
    }
