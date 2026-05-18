import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_optional_user, require_roles
from app.config import get_settings
from app.database import get_db
from app.models.analysis import AnalysisResult
from app.models.audit import TestShareLink
from app.models.response import TestResponse
from app.models.test import Test
from app.models.user import User, UserRole
from app.schemas.ai import AIAnalyzeRequest, AIAnswerItem
from app.schemas.test import (
    ShareLinkCreate,
    ShareLinkRead,
    TestRead,
    TestSubmitRequest,
    TestSubmitResponse,
)
from app.services.ai_service import AIService
from app.services.alert_service import dispatch_alerts, evaluate
from app.services.timing_service import analyze as analyze_timing

router = APIRouter(prefix="/api/tests", tags=["tests"])


@router.get("", response_model=list[TestRead])
async def list_tests(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Test)
        .where(Test.is_active.is_(True))
        .options(selectinload(Test.questions))
        .order_by(Test.created_at.desc())
    )
    return (await db.execute(stmt)).scalars().all()


@router.get("/{test_id}", response_model=TestRead)
async def get_test(
    test_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    test = (
        await db.execute(
            select(Test).where(Test.id == test_id).options(selectinload(Test.questions))
        )
    ).scalar_one_or_none()
    if not test:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "test not found")
    return test


# ---- Запуск теста по shared-токену (без авторизации, по ссылке) -------------


@router.get("/shared/{token}", response_model=TestRead)
async def get_shared_test(
    token: str, db: Annotated[AsyncSession, Depends(get_db)]
):
    link = (
        await db.execute(select(TestShareLink).where(TestShareLink.token == token))
    ).scalar_one_or_none()
    if not link:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "share link not found")
    if link.expires_at and link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_410_GONE, "share link expired")

    test = (
        await db.execute(
            select(Test)
            .where(Test.id == link.test_id)
            .options(selectinload(Test.questions))
        )
    ).scalar_one_or_none()
    if not test or not test.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "test inactive")
    return test


# ---- Создание share-ссылки (только замполит/админ/руководитель) -------------


@router.post(
    "/{test_id}/share",
    response_model=ShareLinkRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_share_link(
    test_id: uuid.UUID,
    payload: ShareLinkCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[
        User,
        Depends(
            require_roles(
                UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.POLITICAL_OFFICER
            )
        ),
    ],
):
    test = (
        await db.execute(select(Test).where(Test.id == test_id))
    ).scalar_one_or_none()
    if not test:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "test not found")

    token = secrets.token_urlsafe(24)
    link = TestShareLink(
        test_id=test_id,
        token=token,
        created_by=user.id,
        cycle_tag=payload.cycle_tag,
        note=payload.note,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=payload.expires_in_days),
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    settings = get_settings()
    origin = (
        settings.cors_origins_list[0]
        if settings.cors_origins_list
        else "http://localhost:5173"
    )
    return ShareLinkRead(
        id=link.id,
        token=token,
        cycle_tag=link.cycle_tag,
        expires_at=link.expires_at,
        uses=link.uses,
        note=link.note,
        share_url=f"{origin}/t/{token}",
    )


@router.get("/{test_id}/share", response_model=list[ShareLinkRead])
async def list_share_links(
    test_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[
        User,
        Depends(
            require_roles(
                UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.POLITICAL_OFFICER
            )
        ),
    ],
):
    settings = get_settings()
    origin = (
        settings.cors_origins_list[0]
        if settings.cors_origins_list
        else "http://localhost:5173"
    )
    rows = (
        await db.execute(
            select(TestShareLink)
            .where(TestShareLink.test_id == test_id)
            .order_by(TestShareLink.created_at.desc())
        )
    ).scalars().all()
    return [
        ShareLinkRead(
            id=r.id,
            token=r.token,
            cycle_tag=r.cycle_tag,
            expires_at=r.expires_at,
            uses=r.uses,
            note=r.note,
            share_url=f"{origin}/t/{r.token}",
        )
        for r in rows
    ]


# ---- Отправка ответов (по логину или по share-токену) ----------------------


async def _submit(
    *,
    db: AsyncSession,
    test: Test,
    user: User,
    payload: TestSubmitRequest,
) -> TestSubmitResponse:
    answers_payload = [a.model_dump(mode="json") for a in payload.answers]
    answers_hash = hashlib.sha256(
        json.dumps(answers_payload, sort_keys=True).encode()
    ).hexdigest()

    question_types: dict[str, str] = {
        str(q.id): q.question_type.value for q in test.questions
    } if test.questions else {}

    timing = analyze_timing(
        answers_payload,
        question_types=question_types,
        total_time_ms=payload.total_time_ms,
    )

    response = TestResponse(
        test_id=test.id,
        user_id=user.id,
        cycle_tag=payload.cycle_tag,
        answers=answers_payload,
        answers_hash=answers_hash,
        respondent_name=payload.respondent_name.strip(),
        total_time_ms=payload.total_time_ms,
        median_time_per_question_ms=timing["median_time_per_question_ms"],
        rushed_share=timing["rushed_share"],
        validity_flag=timing["validity_flag"],
        client_started_at=payload.client_started_at,
        client_finished_at=payload.client_finished_at,
    )
    db.add(response)
    await db.flush()

    ai = AIService()
    ai_request = AIAnalyzeRequest(
        employee_id=str(user.id),
        role=user.role.value,
        department=user.department,
        site=user.site,
        cycle_tag=payload.cycle_tag,
        answers=[AIAnswerItem(**a) for a in answers_payload],
    )
    result = await ai.analyze(ai_request)

    analysis = AnalysisResult(
        response_id=response.id,
        prompt_version=result.prompt_version,
        ai_model=result.ai_model,
        score_metrics=result.score_metrics.model_dump(),
        risk_flags=result.risk_flags,
        recommendations=result.recommendations,
        summary_text=result.summary_text,
        employer_image=result.employer_image.model_dump(),
        anchor_engine=result.anchor_engine,
        anchor_engine_confidence=result.anchor_engine_confidence,
        anchor_engine_reasoning=result.anchor_engine_reasoning,
        raw_llm_response=result.model_dump(mode="json"),
    )
    db.add(analysis)
    await db.commit()

    await dispatch_alerts(evaluate(result))
    return TestSubmitResponse(response_id=response.id, analysis_id=analysis.id)


@router.post("/{test_id}/submit", response_model=TestSubmitResponse)
async def submit_test(
    test_id: uuid.UUID,
    payload: TestSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_optional_user)],
):
    # Согласие проверяем только для реальных учёток (демо-юзер всегда true).
    if user.id and not user.consent_given:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "consent required")
    test = (
        await db.execute(
            select(Test)
            .where(Test.id == test_id)
            .options(selectinload(Test.questions))
        )
    ).scalar_one_or_none()
    if not test:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "test not found")
    return await _submit(db=db, test=test, user=user, payload=payload)


@router.post("/shared/{token}/submit", response_model=TestSubmitResponse)
async def submit_shared(
    token: str,
    payload: TestSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Сабмит по shared-ссылке. Пользователь всё равно должен быть авторизован
    (иначе нечем «привязать» ответы к траектории), но передаёт `token`, что
    инкрементит счётчик использований ссылки."""
    link = (
        await db.execute(select(TestShareLink).where(TestShareLink.token == token))
    ).scalar_one_or_none()
    if not link:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "share link not found")
    if link.expires_at and link.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_410_GONE, "share link expired")

    test = (
        await db.execute(
            select(Test)
            .where(Test.id == link.test_id)
            .options(selectinload(Test.questions))
        )
    ).scalar_one_or_none()
    if not test:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "test inactive")

    link.uses += 1
    await db.flush()
    return await _submit(db=db, test=test, user=user, payload=payload)
