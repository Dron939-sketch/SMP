import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class AppSetting(Base):
    """Глобальная конфигурация приложения (key/value).

    Хранит публично-читаемые настройки, например `consent_collection_enabled`.
    Чтения публичны (фронт знает, показывать ли модалку), запись — только
    за X-Admin-Token.
    """

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value_json: Mapped[Any] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    # actor_id из юзеров не привязываем: на main логина больше нет, админ
    # знает только X-Admin-Token и анонимен с точки зрения БД.
    actor_label: Mapped[str | None] = mapped_column(String(64))
