"""Дашборд замполита (политрука) компании СпецМонтажПроект.

Под Зорина Илью: сводные метрики компании, тепловые срезы по отделам,
«образ компании» из проективных ответов, и главный сигнальный виджет —
"якоря под маской двигателей" (anchor_pretender) — внешне лояльные
сотрудники, поведенчески тормозящие команду.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.database import get_db
from app.models.user import User, UserRole
from app.services.advisor_service import AdvisorService
from app.services.report_service import (
    build_dashboard_payload,
    export_excel,
    export_pdf,
)
from app.services.vk_service import fetch_group_snapshot

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


_DASH_ROLES = require_roles(
    UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.POLITICAL_OFFICER, UserRole.MANAGER
)


@router.get("/political-officer")
async def political_officer_dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_DASH_ROLES)],
    cycle_tag: str | None = Query(default=None),
    include_vk: bool = Query(default=True),
    include_advice: bool = Query(default=True),
):
    """Главный экран замполита. Линейный менеджер видит подмножество без PII."""
    data = await build_dashboard_payload(db, cycle_tag=cycle_tag)
    if user.role == UserRole.MANAGER:
        for row in data["anchor_pretenders"]:
            row["user_id"] = "anonymized"
            row["position"] = None

    vk = await fetch_group_snapshot() if include_vk else {"enabled": False}
    advisor = (
        (await AdvisorService().recommend(data, vk)).model_dump()
        if include_advice
        else None
    )

    return {
        "viewer": {
            "id": str(user.id),
            "role": user.role.value,
            "full_name": user.full_name,
        },
        "company": "СпецМонтажПроект",
        **data,
        "vk": vk,
        "advisor": advisor,
    }


@router.get("/vk")
async def vk_snapshot(user: Annotated[User, Depends(_DASH_ROLES)]):
    return await fetch_group_snapshot()


@router.post("/advisor/refresh")
async def advisor_refresh(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_DASH_ROLES)],
    cycle_tag: str | None = Query(default=None),
):
    data = await build_dashboard_payload(db, cycle_tag=cycle_tag)
    vk = await fetch_group_snapshot()
    return (await AdvisorService().recommend(data, vk)).model_dump()


@router.get("/export/xlsx")
async def export_dashboard_xlsx(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_DASH_ROLES)],
    cycle_tag: str | None = Query(default=None),
):
    data = await build_dashboard_payload(db, cycle_tag=cycle_tag)
    payload = export_excel(data)
    return StreamingResponse(
        iter([payload]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=buildpulse_{cycle_tag or 'all'}.xlsx"
        },
    )


@router.get("/export/pdf")
async def export_dashboard_pdf(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_DASH_ROLES)],
    cycle_tag: str | None = Query(default=None),
):
    data = await build_dashboard_payload(db, cycle_tag=cycle_tag)
    payload = export_pdf(data)
    return StreamingResponse(
        iter([payload]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=buildpulse_{cycle_tag or 'all'}.pdf"
        },
    )
