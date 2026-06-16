"""Портреты: сотрудник и компания.

Использует уже сохранённые AnalysisResult'ы; новый AI-вызов не делаем
(это даёт быстрый отклик и предсказуемые данные). Если потребуется
сгенерировать «литературный» сводный портрет — можно отдельным
endpoint'ом подключить LLM по batch'у summary_text.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.services.portrait_service import (
    get_company_portrait,
    get_employee_portrait,
    list_employee_portraits,
)

router = APIRouter(prefix="/api/portraits", tags=["portraits"])


_PORTRAIT_ROLES = require_roles(
    UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.POLITICAL_OFFICER
)
# Manager — только своих, обычный employee — нет доступа.
_PORTRAIT_ROLES_WITH_MANAGER = require_roles(
    UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.POLITICAL_OFFICER, UserRole.MANAGER
)


@router.get("/employees")
async def list_employees_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_PORTRAIT_ROLES_WITH_MANAGER)],
    cycle_tag: str | None = Query(default=None),
):
    """Список сотрудников со сводными портретами.

    Manager видит подмножество без PII (анонимизировано).
    """
    rows = await list_employee_portraits(db, cycle_tag=cycle_tag)
    if user.role == UserRole.MANAGER:
        for r in rows:
            r["full_name"] = "(скрыто)"
            r["latest_summary"] = None
    return {"count": len(rows), "items": rows}


@router.get("/employee/{user_id}")
async def employee_portrait_endpoint(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_PORTRAIT_ROLES)],
):
    """Детальный портрет одного сотрудника. Только для admin/exec/политрука."""
    portrait = await get_employee_portrait(db, user_id=user_id)
    if not portrait:
        raise HTTPException(status_code=404, detail="employee not found")
    return portrait


@router.get("/company")
async def company_portrait_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_PORTRAIT_ROLES_WITH_MANAGER)],
    cycle_tag: str | None = Query(default=None),
):
    """Сводный портрет компании в глазах сотрудников.

    Топ-keywords с весами, цитаты из проективных ответов, тёмные/светлые
    сигналы по risk_flags, разрез по отделам.
    """
    return await get_company_portrait(db, cycle_tag=cycle_tag)
