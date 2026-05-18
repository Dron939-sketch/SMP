import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class UsageEvent(Base):
    """Журнал пользовательской активности.

    Пишется middleware на каждый осмысленный API-вызов: путь, метод,
    User-Agent, IP, время, длительность, статус, и человекочитаемое
    название действия (для дашборда).
    """

    __tablename__ = "usage_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    user_label: Mapped[str | None] = mapped_column(String(255))
    method: Mapped[str] = mapped_column(String(8))
    path: Mapped[str] = mapped_column(String(255), index=True)
    action: Mapped[str | None] = mapped_column(String(120))
    status_code: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    browser: Mapped[str | None] = mapped_column(String(64))
    os: Mapped[str | None] = mapped_column(String(64))
    device: Mapped[str | None] = mapped_column(String(64))
