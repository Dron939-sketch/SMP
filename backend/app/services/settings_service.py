"""Доступ к глобальным настройкам приложения.

Дефолты живут здесь, а не в БД: пустая БД ведёт себя так, словно настройки
выставлены в дефолтные значения. Запись в `app_settings` появляется только
после явного UPDATE из админ-UI.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import AppSetting

DEFAULTS: dict[str, Any] = {
    # По умолчанию собираем согласие на ПДн. Админ может выключить из дашборда.
    "consent_collection_enabled": True,
}


async def get_setting(db: AsyncSession, key: str) -> Any:
    row = (
        await db.execute(select(AppSetting).where(AppSetting.key == key))
    ).scalar_one_or_none()
    if row is not None:
        return row.value_json
    return DEFAULTS.get(key)


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
    actor_id: uuid.UUID | None = None,
) -> AppSetting:
    row = (
        await db.execute(select(AppSetting).where(AppSetting.key == key))
    ).scalar_one_or_none()
    if row is None:
        row = AppSetting(key=key, value_json=value, updated_by=actor_id)
        db.add(row)
    else:
        row.value_json = value
        row.updated_by = actor_id
    await db.flush()
    return row
