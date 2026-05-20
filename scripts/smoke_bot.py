"""Smoke-бот: прогоняет все тесты с разными ФИО и проверяет, что
конвейер «фронт → бэк → ИИ → БД» работает без накладок.

Использование:
    python scripts/smoke_bot.py --url https://buildpulse-backend.onrender.com
    python scripts/smoke_bot.py --url http://localhost:8000 --runs 3

Создаст 5–30 прохождений всех активных тестов с реалистичными
ФИО и слегка варьированными ответами. По итогу выведет сводку:
сколько submit-ов прошло, какие anchor_engine результаты,
какие алерты выскочили.

Можно безопасно дёргать сколько угодно — все операции пишут
новые записи, существующие данные не трогает. После прогона
не забудь зачистить тесты через /api/admin/wipe-responses.
"""

from __future__ import annotations

import argparse
import random
import sys
import time
from collections import Counter
from datetime import datetime, timezone

import httpx

NAMES = [
    "Иванов Иван Иванович",
    "Петров Сергей Алексеевич",
    "Сидоров Дмитрий Олегович",
    "Кузнецов Артём Викторович",
    "Орлов Михаил Андреевич",
    "Соколова Анна Юрьевна",
    "Морозова Екатерина Игоревна",
    "Васильев Игорь Петрович",
    "Никитин Алексей Сергеевич",
    "Лебедев Павел Николаевич",
    "Семёнов Виктор Геннадьевич",
    "Гусев Андрей Романович",
    "Виноградов Никита Олегович",
    "Тарасов Денис Викторович",
]


def random_answer(q: dict) -> dict:
    qt = q["question_type"]
    out = {
        "question_id": q["id"],
        "code": q["code"],
        "value": None,
        "text": None,
        "time_spent_ms": random.randint(1800, 12000),
        "revisions": random.randint(0, 2),
    }
    if qt == "likert_5":
        out["value"] = random.randint(1, 5)
    elif qt == "single_choice":
        choices = (q.get("options") or {}).get("choices") or []
        out["value"] = random.choice(choices) if choices else None
    elif qt == "multiple_choice":
        choices = (q.get("options") or {}).get("choices") or []
        n = max(1, min(3, len(choices)))
        out["value"] = random.sample(choices, k=n)
    elif qt == "open_text":
        out["text"] = random.choice(
            [
                "Стабильная компания, платят вовремя.",
                "Бывает напряжённо, но команда поддерживает.",
                "Хотел бы больше понимания в карьерных шагах.",
                "СИЗ проверяем, наряд-допуск всегда в порядке.",
                "Раздражает, когда сроки двигают молча.",
            ]
        )
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--runs", type=int, default=2,
                    help="Сколько прохождений на каждый тест")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--cycle", default=None,
                    help="Произвольная метка цикла; по умолчанию YYYY-WW")
    args = ap.parse_args()
    if args.seed is not None:
        random.seed(args.seed)

    base = args.url.rstrip("/")
    cycle = args.cycle or datetime.now(timezone.utc).strftime("%Y-W%V")

    print(f"→ {base}, цикл {cycle}, прогонов на тест: {args.runs}")
    with httpx.Client(timeout=60) as c:
        r = c.get(f"{base}/api/tests")
        if r.status_code != 200:
            print(f"✘ GET /api/tests → {r.status_code} {r.text[:200]}")
            return 1
        tests = r.json()
        print(f"  тестов в БД: {len(tests)}")

        ok = 0
        fail = 0
        anchors: Counter[str] = Counter()
        for t in tests:
            for run in range(args.runs):
                name = random.choice(NAMES)
                started = datetime.now(timezone.utc)
                answers = [random_answer(q) for q in t["questions"]]
                total_time = sum(a["time_spent_ms"] for a in answers)

                payload = {
                    "cycle_tag": cycle,
                    "respondent_name": name,
                    "answers": answers,
                    "total_time_ms": total_time,
                    "client_started_at": started.isoformat(),
                    "client_finished_at": datetime.now(timezone.utc).isoformat(),
                }
                resp = c.post(
                    f"{base}/api/tests/{t['id']}/submit", json=payload
                )
                if resp.status_code != 200:
                    fail += 1
                    print(
                        f"  ✘ {t['title']:30s} run {run + 1}: "
                        f"{resp.status_code} {resp.text[:150]}"
                    )
                    continue
                data = resp.json()
                ok += 1
                # Дёргаем подробный отчёт чтобы убедиться что ИИ-анализ создан
                rr = c.get(f"{base}/api/reports/responses/{data['response_id']}")
                if rr.status_code == 200:
                    a = (rr.json() or {}).get("analysis") or {}
                    anchors[a.get("anchor_engine", "none")] += 1
                print(f"  ✔ {t['title']:30s} run {run + 1}  {name}")
                time.sleep(0.2)

        # Финальная проверка дашборда
        d = c.get(f"{base}/api/dashboard/political-officer").json()
        print("\n— Сводка —")
        print(f"  прохождений ok: {ok}, fail: {fail}")
        print(f"  anchor_engine: {dict(anchors)}")
        print(f"  респондентов на дашборде: {d.get('respondents')}")
        phase = d.get("company_phase") or {}
        print(f"  фаза компании: {phase.get('phase')} — {phase.get('reason')}")

    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
