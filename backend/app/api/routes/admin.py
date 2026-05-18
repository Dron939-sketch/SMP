"""Эндпоинты для разовых служебных операций. Защищены ADMIN_TOKEN."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.analysis import AnalysisResult
from app.models.audit import TestShareLink
from app.models.response import TestResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _check_admin(token: str | None) -> None:
    settings = get_settings()
    if not settings.admin_token:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "ADMIN_TOKEN не задан в окружении — операция запрещена",
        )
    if token != settings.admin_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid admin token")


@router.post("/wipe-responses")
async def wipe_responses(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_admin_token: Annotated[str | None, Header()] = None,
):
    """Удалить ВСЕ ответы респондентов и связанные ИИ-анализы.
    Тесты, пользователи и share-ссылки остаются. Идемпотентно.

    Использование:
        curl -X POST -H "X-Admin-Token: <ADMIN_TOKEN>" \\
          https://buildpulse-backend.onrender.com/api/admin/wipe-responses
    """
    _check_admin(x_admin_token)

    before_responses = (
        await db.execute(select(func.count(TestResponse.id)))
    ).scalar() or 0
    before_analyses = (
        await db.execute(select(func.count(AnalysisResult.id)))
    ).scalar() or 0

    # AnalysisResult.response_id с ondelete="CASCADE" — удалится автоматически.
    await db.execute(delete(TestResponse))
    await db.commit()

    return {
        "deleted_responses": int(before_responses),
        "deleted_analyses": int(before_analyses),
        "status": "ok",
    }


@router.post("/wipe-share-links")
async def wipe_share_links(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_admin_token: Annotated[str | None, Header()] = None,
):
    """Удалить все share-ссылки. Тесты не трогаются."""
    _check_admin(x_admin_token)
    before = (
        await db.execute(select(func.count(TestShareLink.id)))
    ).scalar() or 0
    await db.execute(delete(TestShareLink))
    await db.commit()
    return {"deleted_share_links": int(before), "status": "ok"}
