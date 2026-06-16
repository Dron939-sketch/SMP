"""Сводные портреты сотрудников и портрет компании в их глазах.

Использует уже сохранённые AnalysisResult'ы (summary_text, score_metrics,
employer_image, anchor_engine) — то есть AI-анализ генерируется на этапе
обработки прохождения теста, а здесь мы просто красиво агрегируем то,
что уже лежит в БД.
"""

from __future__ import annotations

from collections import Counter
from statistics import mean
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.analysis import AnalysisResult
from app.models.response import TestResponse
from app.models.user import User, UserRole


async def list_employee_portraits(
    db: AsyncSession, *, cycle_tag: str | None = None
) -> List[Dict[str, Any]]:
    """Возвращает список сотрудников со сводкой их портретов.

    Каждая запись:
      - user_id, full_name, department, site, position
      - tests_passed (сколько тестов прошёл)
      - last_cycle_tag
      - avg_metrics (усреднённые score_metrics по всем его анализам)
      - latest_anchor_engine + confidence (последний)
      - all_risk_flags (объединение тегов)
      - latest_summary (последний summary_text)
    """
    q = (
        select(TestResponse)
        .join(AnalysisResult, AnalysisResult.response_id == TestResponse.id)
        .options(selectinload(TestResponse.analysis))
    )
    if cycle_tag:
        q = q.where(TestResponse.cycle_tag == cycle_tag)
    rows = (await db.execute(q)).scalars().all()

    # Group by user_id
    by_user: Dict[str, List[TestResponse]] = {}
    for r in rows:
        by_user.setdefault(str(r.user_id), []).append(r)

    # Подгружаем user'ов одним запросом
    user_ids = list(by_user.keys())
    if not user_ids:
        return []
    users = (
        await db.execute(select(User).where(User.id.in_(user_ids)))
    ).scalars().all()
    users_by_id = {str(u.id): u for u in users}

    out: List[Dict[str, Any]] = []
    for uid, responses in by_user.items():
        u = users_by_id.get(uid)
        if not u or u.role == UserRole.ADMIN:
            # admin/test-аккаунты не показываем в портретах
            continue
        responses_sorted = sorted(responses, key=lambda x: x.submitted_at, reverse=True)
        latest = responses_sorted[0]
        latest_an = latest.analysis

        # Aggregate metrics
        metric_buckets: Dict[str, List[float]] = {}
        all_flags: List[str] = []
        for r in responses_sorted:
            an = r.analysis
            if not an:
                continue
            for k, v in (an.score_metrics or {}).items():
                metric_buckets.setdefault(k, []).append(float(v))
            all_flags.extend(an.risk_flags or [])

        avg_metrics = {k: round(mean(vs), 2) for k, vs in metric_buckets.items()}
        risk_counter = Counter(all_flags)
        risk_flags_sorted = [t for t, _ in risk_counter.most_common()]

        out.append(
            {
                "user_id": uid,
                "full_name": u.full_name or u.email,
                "department": u.department,
                "site": u.site,
                "position": u.position,
                "tests_passed": len(responses_sorted),
                "last_cycle_tag": latest.cycle_tag,
                "last_submitted_at": latest.submitted_at.isoformat() if latest.submitted_at else None,
                "avg_metrics": avg_metrics,
                "anchor_engine": (latest_an.anchor_engine if latest_an else None),
                "anchor_engine_confidence": (
                    latest_an.anchor_engine_confidence if latest_an else None
                ),
                "risk_flags": risk_flags_sorted,
                "latest_summary": latest_an.summary_text if latest_an else None,
            }
        )

    # Сортируем по риску — кто с большим числом флагов или anchor_pretender → вверх
    def _risk_score(row: Dict[str, Any]) -> float:
        score = len(row["risk_flags"])
        if row["anchor_engine"] == "anchor_pretender":
            score += 10
        elif row["anchor_engine"] == "anchor":
            score += 5
        return score

    out.sort(key=_risk_score, reverse=True)
    return out


async def get_employee_portrait(
    db: AsyncSession, *, user_id: str
) -> Dict[str, Any] | None:
    """Детальный портрет одного сотрудника: история всех его тестов,
    динамика метрик, все summary_text по циклам."""
    user = await db.get(User, user_id)
    if not user:
        return None
    if user.role == UserRole.ADMIN:
        return None

    q = (
        select(TestResponse)
        .where(TestResponse.user_id == user_id)
        .options(selectinload(TestResponse.analysis))
        .order_by(TestResponse.submitted_at.asc())
    )
    responses = (await db.execute(q)).scalars().all()

    history = []
    metric_timeline: Dict[str, List[Dict[str, Any]]] = {}
    all_flags: List[str] = []
    all_recommendations: List[str] = []

    for r in responses:
        an = r.analysis
        if not an:
            continue
        history.append(
            {
                "cycle_tag": r.cycle_tag,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                "validity_flag": r.validity_flag,
                "summary": an.summary_text,
                "score_metrics": an.score_metrics,
                "risk_flags": an.risk_flags,
                "recommendations": an.recommendations,
                "anchor_engine": an.anchor_engine,
                "anchor_engine_confidence": an.anchor_engine_confidence,
                "anchor_engine_reasoning": an.anchor_engine_reasoning,
            }
        )
        for k, v in (an.score_metrics or {}).items():
            metric_timeline.setdefault(k, []).append(
                {
                    "cycle_tag": r.cycle_tag,
                    "value": round(float(v), 2),
                    "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                }
            )
        all_flags.extend(an.risk_flags or [])
        all_recommendations.extend(an.recommendations or [])

    avg_metrics = {
        k: round(mean(point["value"] for point in points), 2)
        for k, points in metric_timeline.items()
    }
    risk_freq = dict(Counter(all_flags).most_common())
    # уникальные рекомендации с подсчётом
    rec_counter = Counter(all_recommendations)
    top_recs = [{"text": t, "count": c} for t, c in rec_counter.most_common(15)]

    return {
        "user": {
            "id": str(user.id),
            "full_name": user.full_name or user.email,
            "email": user.email,
            "role": user.role.value,
            "department": user.department,
            "site": user.site,
            "position": user.position,
        },
        "tests_passed": len(history),
        "avg_metrics": avg_metrics,
        "metric_timeline": metric_timeline,
        "risk_freq": risk_freq,
        "top_recommendations": top_recs,
        "history": history,
    }


async def get_company_portrait(
    db: AsyncSession, *, cycle_tag: str | None = None, top_k_keywords: int = 50
) -> Dict[str, Any]:
    """Расширенный портрет компании в глазах сотрудников.

    Агрегирует все employer_image из AnalysisResult — собирает все
    keywords с весами, все цитаты-предложения, и группирует по
    тональности через risk_flags.
    """
    q = select(TestResponse).options(selectinload(TestResponse.analysis))
    if cycle_tag:
        q = q.where(TestResponse.cycle_tag == cycle_tag)
    rows = (await db.execute(q)).scalars().all()

    keyword_weights: Dict[str, float] = {}
    keyword_mentions: Dict[str, int] = {}
    all_sentences: List[Dict[str, Any]] = []
    flag_freq: Counter[str] = Counter()
    by_dept_keywords: Dict[str, Counter] = {}

    # Подгружаем юзеров для разрезов по отделу
    user_ids = list({str(r.user_id) for r in rows})
    users = (
        await db.execute(select(User).where(User.id.in_(user_ids)))
    ).scalars().all() if user_ids else []
    users_by_id = {str(u.id): u for u in users}

    total_responses = 0
    for r in rows:
        an = r.analysis
        if not an:
            continue
        total_responses += 1
        emp = an.employer_image or {}
        for kw in (emp.get("top_keywords") or []):
            word = (kw.get("keyword") or "").strip().lower()
            weight = float(kw.get("weight") or 0)
            if not word:
                continue
            keyword_weights[word] = keyword_weights.get(word, 0) + weight
            keyword_mentions[word] = keyword_mentions.get(word, 0) + 1
            # per-department
            u = users_by_id.get(str(r.user_id))
            if u and u.department:
                by_dept_keywords.setdefault(u.department, Counter())[word] += 1
        for s in (emp.get("sample_sentences") or [])[:3]:
            all_sentences.append({"text": s, "cycle_tag": r.cycle_tag})
        for f in (an.risk_flags or []):
            flag_freq[f] += 1

    # Топ слов: сортируем по весу, ограничиваем
    top_keywords = sorted(
        (
            {"keyword": w, "weight": round(weight, 2), "mentions": keyword_mentions.get(w, 0)}
            for w, weight in keyword_weights.items()
        ),
        key=lambda x: (-x["weight"], -x["mentions"]),
    )[:top_k_keywords]

    # Семплируем 30 интересных цитат (разные циклы)
    sample_sentences = all_sentences[:30]

    # Топ "тёмных" флагов (что портит образ)
    dark_flags = [
        f
        for f, c in flag_freq.most_common()
        if any(p in f for p in ("low_", "high_stress", "burnout", "unsafe", "pretender", "fear"))
    ][:10]
    light_flags = [
        f
        for f, c in flag_freq.most_common()
        if any(p in f for p in ("high_loyalty", "strong_", "trust", "engagement"))
    ][:10]

    dept_top = {
        dept: [w for w, _ in c.most_common(8)]
        for dept, c in by_dept_keywords.items()
    }

    return {
        "respondents": total_responses,
        "cycle_tag": cycle_tag,
        "top_keywords": top_keywords,
        "sample_sentences": sample_sentences,
        "flag_freq": dict(flag_freq.most_common()),
        "dark_signals": dark_flags,
        "light_signals": light_flags,
        "by_department_top_keywords": dept_top,
    }
