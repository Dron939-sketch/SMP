"""Список и детальный отчёт по пройденным тестам."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_roles
from app.database import get_db
from app.models.analysis import AnalysisResult
from app.models.response import TestResponse
from app.models.test import Test
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/reports", tags=["reports"])

_ROLES = require_roles(
    UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.POLITICAL_OFFICER, UserRole.MANAGER
)


@router.get("/responses")
async def list_responses(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_ROLES)],
    test_id: uuid.UUID | None = Query(default=None),
    cycle_tag: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    """Список пройденных тестов с краткой выжимкой."""
    stmt = (
        select(TestResponse, Test, AnalysisResult)
        .join(Test, TestResponse.test_id == Test.id)
        .outerjoin(AnalysisResult, AnalysisResult.response_id == TestResponse.id)
        .order_by(TestResponse.submitted_at.desc())
        .limit(limit)
    )
    if test_id:
        stmt = stmt.where(TestResponse.test_id == test_id)
    if cycle_tag:
        stmt = stmt.where(TestResponse.cycle_tag == cycle_tag)

    rows = (await db.execute(stmt)).all()
    out: list[dict[str, Any]] = []
    for resp, test, analysis in rows:
        out.append(
            {
                "response_id": str(resp.id),
                "test_id": str(test.id),
                "test_title": test.title,
                "respondent_name": resp.respondent_name,
                "cycle_tag": resp.cycle_tag,
                "submitted_at": resp.submitted_at.isoformat(),
                "total_time_ms": resp.total_time_ms,
                "validity_flag": resp.validity_flag,
                "anchor_engine": analysis.anchor_engine if analysis else None,
                "anchor_confidence": (
                    analysis.anchor_engine_confidence if analysis else None
                ),
                "summary_text": analysis.summary_text if analysis else None,
                "risk_flags": list(analysis.risk_flags or []) if analysis else [],
                "score_metrics": dict(analysis.score_metrics or {}) if analysis else {},
            }
        )
    return {"total": len(out), "items": out}


@router.get("/responses/{response_id}")
async def get_response_detail(
    response_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_ROLES)],
):
    """Полный отчёт по конкретному прохождению теста."""
    stmt = (
        select(TestResponse, Test, AnalysisResult)
        .join(Test, TestResponse.test_id == Test.id)
        .outerjoin(AnalysisResult, AnalysisResult.response_id == TestResponse.id)
        .where(TestResponse.id == response_id)
        .options(selectinload(Test.questions))
    )
    row = (await db.execute(stmt)).one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "response not found")
    resp, test, analysis = row

    questions_by_id = {str(q.id): q for q in test.questions}
    answers = []
    for a in resp.answers or []:
        q = questions_by_id.get(str(a.get("question_id")))
        answers.append(
            {
                "code": a.get("code"),
                "display_text": q.display_text if q else None,
                "value": a.get("value"),
                "text": a.get("text"),
                "time_spent_ms": a.get("time_spent_ms"),
                "revisions": a.get("revisions"),
            }
        )

    return {
        "response_id": str(resp.id),
        "test": {
            "id": str(test.id),
            "title": test.title,
            "description": test.description,
            "real_focus": test.real_focus,
            "cycle": test.cycle,
        },
        "respondent_name": resp.respondent_name,
        "cycle_tag": resp.cycle_tag,
        "submitted_at": resp.submitted_at.isoformat(),
        "total_time_ms": resp.total_time_ms,
        "median_time_per_question_ms": resp.median_time_per_question_ms,
        "rushed_share": resp.rushed_share,
        "validity_flag": resp.validity_flag,
        "answers": answers,
        "analysis": (
            {
                "score_metrics": dict(analysis.score_metrics or {}),
                "risk_flags": list(analysis.risk_flags or []),
                "recommendations": list(analysis.recommendations or []),
                "summary_text": analysis.summary_text,
                "employer_image": analysis.employer_image,
                "anchor_engine": analysis.anchor_engine,
                "anchor_engine_confidence": analysis.anchor_engine_confidence,
                "anchor_engine_reasoning": analysis.anchor_engine_reasoning,
                "prompt_version": analysis.prompt_version,
                "ai_model": analysis.ai_model,
            }
            if analysis
            else None
        ),
    }
