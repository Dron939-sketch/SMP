"""Статистика использования."""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.database import get_db
from app.models.usage import UsageEvent
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/usage", tags=["usage"])

_ROLES = require_roles(UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.POLITICAL_OFFICER)


@router.get("/events")
async def list_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_ROLES)],
    limit: int = Query(default=200, ge=1, le=2000),
    since_hours: int = Query(default=72, ge=1, le=24 * 30),
):
    """Список событий + сводные показатели за последние N часов."""
    since = datetime.now(timezone.utc) - timedelta(hours=since_hours)

    stmt = (
        select(UsageEvent)
        .where(UsageEvent.created_at >= since)
        .order_by(UsageEvent.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()

    items = [
        {
            "id": str(r.id),
            "created_at": r.created_at.isoformat(),
            "user_label": r.user_label,
            "method": r.method,
            "path": r.path,
            "action": r.action,
            "status_code": r.status_code,
            "duration_ms": r.duration_ms,
            "ip": r.ip,
            "browser": r.browser,
            "os": r.os,
            "device": r.device,
        }
        for r in rows
    ]

    # Сводка.
    total = (
        await db.execute(
            select(func.count(UsageEvent.id)).where(UsageEvent.created_at >= since)
        )
    ).scalar() or 0

    # По устройствам.
    dev_rows = (
        await db.execute(
            select(UsageEvent.device, func.count(UsageEvent.id))
            .where(UsageEvent.created_at >= since)
            .group_by(UsageEvent.device)
        )
    ).all()
    devices = {d or "—": int(c) for d, c in dev_rows}

    # По браузерам.
    br_rows = (
        await db.execute(
            select(UsageEvent.browser, func.count(UsageEvent.id))
            .where(UsageEvent.created_at >= since)
            .group_by(UsageEvent.browser)
        )
    ).all()
    browsers = {b or "—": int(c) for b, c in br_rows}

    # Топ-действия.
    act_rows = (
        await db.execute(
            select(UsageEvent.action, func.count(UsageEvent.id))
            .where(UsageEvent.created_at >= since, UsageEvent.action.is_not(None))
            .group_by(UsageEvent.action)
            .order_by(func.count(UsageEvent.id).desc())
            .limit(20)
        )
    ).all()
    top_actions = [{"action": a, "count": int(c)} for a, c in act_rows]

    # Уникальные IP / пользователи.
    unique_ips = (
        await db.execute(
            select(func.count(func.distinct(UsageEvent.ip)))
            .where(UsageEvent.created_at >= since, UsageEvent.ip.is_not(None))
        )
    ).scalar() or 0

    return {
        "since": since.isoformat(),
        "since_hours": since_hours,
        "total_events": int(total),
        "unique_ips": int(unique_ips),
        "devices": devices,
        "browsers": browsers,
        "top_actions": top_actions,
        "items": items,
    }


@router.get("/summary")
async def summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_ROLES)],
) -> dict[str, Any]:
    """Краткая сводка для виджета на дашборде."""
    last = (
        await db.execute(
            select(UsageEvent).order_by(UsageEvent.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    return {
        "last_event_at": last.created_at.isoformat() if last else None,
        "last_action": (last.action if last else None),
        "last_device": (last.device if last else None),
    }
