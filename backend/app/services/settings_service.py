"""Глобальные настройки приложения.

Дефолты живут в коде: пустая таблица ведёт себя как «настройки выставлены
в дефолты». Запись в `app_settings` появляется только после явного PUT.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import AppSetting

DEFAULTS: dict[str, Any] = {
    # Показывать ли модалку согласия на ПДн перед прохождением теста.
    "consent_collection_enabled": True,
}


async def get_all_settings(db: AsyncSession) -> dict[str, Any]:
    rows = (await db.execute(select(AppSetting))).scalars().all()
    merged = dict(DEFAULTS)
    for r in rows:
        merged[r.key] = r.value_json
    return merged


async def set_setting(
    db: AsyncSession,
    key: str,
    value: Any,
    actor_label: str | None = None,
) -> AppSetting:
    row = (
        await db.execute(select(AppSetting).where(AppSetting.key == key))
    ).scalar_one_or_none()
    if row is None:
        row = AppSetting(key=key, value_json=value, actor_label=actor_label)
        db.add(row)
    else:
        row.value_json = value
        row.actor_label = actor_label
    await db.flush()
    return row
