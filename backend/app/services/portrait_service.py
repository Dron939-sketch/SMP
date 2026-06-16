"""Сводные портреты респондентов и портрет компании в их глазах.

ВАЖНО про идентификацию: в демо-режиме (shared-link сабмиты) все
TestResponse'ы привязаны к одному технологическому user_id (замполит),
а реальное имя сотрудника лежит в `TestResponse.respondent_name`.
Поэтому портреты группируются именно по `respondent_name`, иначе все
12 человек слипаются в одного Зорина.
"""

from __future__ import annotations

import hashlib
import logging
from collections import Counter
from statistics import mean
from typing import Any, Awaitable, Callable, Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.analysis import AnalysisResult
from app.models.portrait_cache import CachedPortrait
from app.models.response import TestResponse
from app.models.user import User

logger = logging.getLogger(__name__)


def _input_hash(items: List[tuple[str, str]]) -> str:
    """Хеш входных данных для инвалидации кеша.

    items — sorted список (analysis_id, submitted_at_isoformat).
    Если что-то поменялось — хеш не сойдётся, кеш пересоберём.
    """
    payload = "|".join(f"{a}:{b}" for a, b in items)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def _get_or_build_cache(
    db: AsyncSession,
    *,
    portrait_type: str,
    subject_key: str,
    cycle_tag: str | None,
    current_hash: str,
    build_fn: Callable[[], Awaitable[Dict[str, Any]]],
) -> Dict[str, Any]:
    """Универсальная обёртка cache-aside.

    1. Ищем CachedPortrait по (type, subject, cycle).
    2. Если есть и input_hash совпадает — возвращаем aggregated_data.
    3. Иначе строим через build_fn(), сохраняем, возвращаем.
    """
    q = select(CachedPortrait).where(
        CachedPortrait.portrait_type == portrait_type,
        CachedPortrait.subject_key == subject_key,
    )
    if cycle_tag is None:
        q = q.where(CachedPortrait.cycle_tag.is_(None))
    else:
        q = q.where(CachedPortrait.cycle_tag == cycle_tag)
    existing = (await db.execute(q)).scalar_one_or_none()

    if existing and existing.input_hash == current_hash:
        return dict(existing.aggregated_data)

    data = await build_fn()
    if existing:
        existing.input_hash = current_hash
        existing.aggregated_data = data
        # synthesized_text не трогаем — пусть пересоздаётся отдельно,
        # если пользователь жмёт «Сгенерировать литературный портрет».
        # При смене input_hash литературный синтез автоматически считается
        # устаревшим (фронт ориентируется на updated_at vs hash).
    else:
        db.add(
            CachedPortrait(
                portrait_type=portrait_type,
                subject_key=subject_key,
                cycle_tag=cycle_tag,
                input_hash=current_hash,
                aggregated_data=data,
            )
        )
    try:
        await db.flush()
    except Exception as e:
        # Если по какой-то причине не удалось закешировать — логируем и
        # возвращаем данные. На UX это не должно влиять.
        logger.warning("portrait cache save failed: %s", e)
    return data


def _respondent_key(r: TestResponse, users_by_id: Dict[str, User]) -> str:
    """Ключ группировки. Сначала — respondent_name (что сотрудник
    ввёл на старте теста), потом fallback на full_name юзера."""
    name = (r.respondent_name or "").strip()
    if name:
        return name
    u = users_by_id.get(str(r.user_id))
    if u and u.full_name:
        return u.full_name
    if u and u.email:
        return u.email
    return str(r.user_id)


async def list_employee_portraits(
    db: AsyncSession, *, cycle_tag: str | None = None
) -> List[Dict[str, Any]]:
    """Список респондентов со сводкой портретов.

    Кешируется в таблице cached_portraits (type='employee_list',
    subject='__all__', cycle=cycle_tag). При смене входных AnalysisResult
    хеш не сходится, пересоздаём.
    """
    # Сначала собираем минимальный набор для input_hash (без полного scan)
    hash_q = (
        select(AnalysisResult.id, TestResponse.submitted_at)
        .join(TestResponse, TestResponse.id == AnalysisResult.response_id)
    )
    if cycle_tag:
        hash_q = hash_q.where(TestResponse.cycle_tag == cycle_tag)
    hash_rows = (await db.execute(hash_q)).all()
    items = sorted(
        (str(r[0]), r[1].isoformat() if r[1] else "") for r in hash_rows
    )
    current_hash = _input_hash(items)

    async def _build() -> Dict[str, Any]:
        out = await _build_employee_list(db, cycle_tag=cycle_tag)
        return {"items": out}

    result = await _get_or_build_cache(
        db,
        portrait_type="employee_list",
        subject_key="__all__",
        cycle_tag=cycle_tag,
        current_hash=current_hash,
        build_fn=_build,
    )
    return list(result.get("items", []))


async def _build_employee_list(
    db: AsyncSession, *, cycle_tag: str | None
) -> List[Dict[str, Any]]:
    """Реальная агрегация (бывшее тело list_employee_portraits)."""
    q = (
        select(TestResponse)
        .join(AnalysisResult, AnalysisResult.response_id == TestResponse.id)
        .options(selectinload(TestResponse.analysis))
    )
    if cycle_tag:
        q = q.where(TestResponse.cycle_tag == cycle_tag)
    rows = (await db.execute(q)).scalars().all()

    # Подгружаем юзеров одним запросом
    user_ids = list({str(r.user_id) for r in rows})
    users: List[User] = []
    if user_ids:
        users = (
            await db.execute(select(User).where(User.id.in_(user_ids)))
        ).scalars().all()
    users_by_id = {str(u.id): u for u in users}

    # Group by respondent_name
    by_resp: Dict[str, List[TestResponse]] = {}
    for r in rows:
        key = _respondent_key(r, users_by_id)
        by_resp.setdefault(key, []).append(r)

    out: List[Dict[str, Any]] = []
    for name, responses in by_resp.items():
        responses_sorted = sorted(responses, key=lambda x: x.submitted_at, reverse=True)
        latest = responses_sorted[0]
        latest_an = latest.analysis
        u = users_by_id.get(str(latest.user_id))

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
                "user_id": name,  # ключ для роутинга /portraits/<key>
                "full_name": name,
                "department": (u.department if u else None),
                "site": (u.site if u else None),
                "position": (u.position if u else None),
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
    """Детальный портрет одного респондента (с кешем).

    `user_id` тут — это `respondent_name`.
    """
    # Хеш-запрос — только id и submitted_at, минимум данных
    hash_q = (
        select(AnalysisResult.id, TestResponse.submitted_at)
        .join(TestResponse, TestResponse.id == AnalysisResult.response_id)
        .where(TestResponse.respondent_name == user_id)
    )
    hash_rows = (await db.execute(hash_q)).all()
    if not hash_rows:
        return None
    items = sorted(
        (str(r[0]), r[1].isoformat() if r[1] else "") for r in hash_rows
    )
    current_hash = _input_hash(items)

    async def _build() -> Dict[str, Any]:
        out = await _build_employee_detail(db, user_id=user_id)
        return out or {}

    cached = await _get_or_build_cache(
        db,
        portrait_type="employee_detail",
        subject_key=user_id,
        cycle_tag=None,
        current_hash=current_hash,
        build_fn=_build,
    )
    return cached if cached else None


async def _build_employee_detail(
    db: AsyncSession, *, user_id: str
) -> Dict[str, Any] | None:
    """Реальная сборка детального портрета (бывшее тело get_employee_portrait)."""
    q = (
        select(TestResponse)
        .where(TestResponse.respondent_name == user_id)
        .options(selectinload(TestResponse.analysis))
        .order_by(TestResponse.submitted_at.asc())
    )
    responses = (await db.execute(q)).scalars().all()
    if not responses:
        return None

    user_meta: User | None = None
    if responses:
        u_id = str(responses[0].user_id)
        user_meta = await db.get(User, u_id)

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
    rec_counter = Counter(all_recommendations)
    top_recs = [{"text": t, "count": c} for t, c in rec_counter.most_common(15)]

    return {
        "user": {
            "id": user_id,
            "full_name": user_id,
            "email": (user_meta.email if user_meta else None),
            "role": (user_meta.role.value if user_meta else "respondent"),
            "department": (user_meta.department if user_meta else None),
            "site": (user_meta.site if user_meta else None),
            "position": (user_meta.position if user_meta else None),
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
    """Расширенный портрет компании в глазах сотрудников (с кешем)."""
    hash_q = (
        select(AnalysisResult.id, TestResponse.submitted_at)
        .join(TestResponse, TestResponse.id == AnalysisResult.response_id)
    )
    if cycle_tag:
        hash_q = hash_q.where(TestResponse.cycle_tag == cycle_tag)
    hash_rows = (await db.execute(hash_q)).all()
    items = sorted(
        (str(r[0]), r[1].isoformat() if r[1] else "") for r in hash_rows
    )
    current_hash = _input_hash(items + [f"top_k:{top_k_keywords}"])

    async def _build() -> Dict[str, Any]:
        return await _build_company_portrait(
            db, cycle_tag=cycle_tag, top_k_keywords=top_k_keywords
        )

    return await _get_or_build_cache(
        db,
        portrait_type="company",
        subject_key="__all__",
        cycle_tag=cycle_tag,
        current_hash=current_hash,
        build_fn=_build,
    )


async def _build_company_portrait(
    db: AsyncSession, *, cycle_tag: str | None, top_k_keywords: int
) -> Dict[str, Any]:
    """Реальная сборка (бывшее тело get_company_portrait)."""
    q = select(TestResponse).options(selectinload(TestResponse.analysis))
    if cycle_tag:
        q = q.where(TestResponse.cycle_tag == cycle_tag)
    rows = (await db.execute(q)).scalars().all()

    keyword_weights: Dict[str, float] = {}
    keyword_mentions: Dict[str, int] = {}
    all_sentences: List[Dict[str, Any]] = []
    flag_freq: Counter[str] = Counter()
    by_dept_keywords: Dict[str, Counter] = {}

    user_ids = list({str(r.user_id) for r in rows})
    users: List[User] = []
    if user_ids:
        users = (
            await db.execute(select(User).where(User.id.in_(user_ids)))
        ).scalars().all()
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
            u = users_by_id.get(str(r.user_id))
            if u and u.department:
                by_dept_keywords.setdefault(u.department, Counter())[word] += 1
        for s in (emp.get("sample_sentences") or [])[:3]:
            all_sentences.append({"text": s, "cycle_tag": r.cycle_tag})
        for f in (an.risk_flags or []):
            flag_freq[f] += 1

    top_keywords = sorted(
        (
            {"keyword": w, "weight": round(weight, 2), "mentions": keyword_mentions.get(w, 0)}
            for w, weight in keyword_weights.items()
        ),
        key=lambda x: (-x["weight"], -x["mentions"]),
    )[:top_k_keywords]

    sample_sentences = all_sentences[:30]

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
