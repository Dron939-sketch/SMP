"""Админ-эндпоинты: глобальные настройки и полный сброс БД.

GET /api/admin/settings — доступен любому авторизованному (фронт читает,
чтобы понимать, нужно ли показывать модалку согласия). PUT/RESET — только
ADMIN.
"""

from __future__ import annotations

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.database import get_db
from app.models.analysis import AnalysisResult
from app.models.audit import AuditLog, TestShareLink
from app.models.response import TestResponse
from app.models.test import Question, Test
from app.models.user import User, UserRole
from app.schemas.admin import AppSettingUpdate, ResetReport
from app.services.settings_service import (
    DEFAULTS,
    get_all_settings,
    set_setting,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/settings", response_model=dict[str, Any])
async def list_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Все настройки (с подмешиванием дефолтов). Доступно любому, кто залогинен,
    чтобы фронт мог понять, надо ли показывать модалку согласия."""
    return await get_all_settings(db)


@router.put("/settings/{key}", response_model=dict[str, Any])
async def update_setting(
    key: str,
    payload: AppSettingUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    if key not in DEFAULTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"unknown setting: {key}")
    await set_setting(db, key, payload.value, actor_id=user.id)
    db.add(
        AuditLog(
            actor_id=user.id,
            action="settings_update",
            target_type="app_setting",
            target_id=key,
            payload={"value": payload.value},
        )
    )
    await db.commit()
    return await get_all_settings(db)


async def _count(db: AsyncSession, model) -> int:
    return (await db.execute(select(func.count()).select_from(model))).scalar_one()


@router.post("/reset", response_model=ResetReport)
async def reset_all(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
):
    """Полный wipe бизнес-данных: ответы, анализы, тесты, share-ссылки,
    аудит и все пользователи кроме текущего админа. AppSettings сохраняются
    (тумблер согласия пережил сброс), и за самим сбросом записывается
    финальная audit-запись.
    """
    counts: dict[str, int] = {}

    # Порядок важен: сначала зависимые таблицы, потом базовые.
    # Внутри Test → Question стоит ondelete=CASCADE, поэтому Question
    # можно было бы и не чистить отдельно, но явный delete даёт чистый счёт.
    for model, label in (
        (AnalysisResult, "analyses"),
        (TestResponse, "responses"),
        (AuditLog, "audit_logs"),
        (TestShareLink, "share_links"),
        (Question, "questions"),
        (Test, "tests"),
    ):
        counts[label] = await _count(db, model)
        await db.execute(delete(model))

    users_total = await _count(db, User)
    await db.execute(delete(User).where(User.id != user.id))
    counts["users"] = max(users_total - 1, 0)

    db.add(
        AuditLog(
            actor_id=user.id,
            action="db_reset",
            payload=counts,
        )
    )
    await db.commit()
    logger.warning("admin.reset", actor=str(user.id), counts=counts)
    return ResetReport(deleted=counts)
