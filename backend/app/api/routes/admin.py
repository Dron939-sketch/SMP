"""Эндпоинты для разовых служебных операций. Защищены ADMIN_TOKEN.

GET /settings — публичный (фронт должен знать, показывать ли модалку
согласия). PUT /settings/{key} и wipe-* — за X-Admin-Token.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.analysis import AnalysisResult
from app.models.audit import TestShareLink
from app.models.response import TestResponse
from app.services.settings_service import (
    DEFAULTS,
    get_all_settings,
    set_setting,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AppSettingUpdate(BaseModel):
    value: Any


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


@router.get("/settings")
async def get_settings_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Публично-читаемые настройки. Без токена: фронту нужно знать,
    надо ли показывать модалку согласия на ПДн перед тестом.
    Сами значения секретов сюда не попадают (см. DEFAULTS)."""
    return await get_all_settings(db)


@router.put("/settings/{key}")
async def update_setting_endpoint(
    key: str,
    payload: AppSettingUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_admin_token: Annotated[str | None, Header()] = None,
):
    """Обновить настройку. Только за X-Admin-Token. Ключи из белого списка
    (DEFAULTS) — чтобы через эту дверь не подсунули мусорный ключ."""
    _check_admin(x_admin_token)
    if key not in DEFAULTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"unknown setting: {key}")
    await set_setting(db, key, payload.value, actor_label="admin_token")
    await db.commit()
    return await get_all_settings(db)
