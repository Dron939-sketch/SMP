import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class TestResponse(Base):
    """Сырые ответы сотрудника на тест.

    `answers` — массив объектов вида:
        {"question_id": "...", "code": "Q_BREAK_HABITS", "value": 4, "text": null}
    PII в этом объекте не хранится — только `user_id` (UUID, без email).
    """

    __tablename__ = "test_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cycle_tag: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    answers: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
    answers_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Тайминги — для оценки валидности («думал» vs «тыкал»).
    total_time_ms: Mapped[int | None] = mapped_column(Integer)
    median_time_per_question_ms: Mapped[int | None] = mapped_column(Integer)
    rushed_share: Mapped[float | None] = mapped_column(Float)
    validity_flag: Mapped[str | None] = mapped_column(String(32), index=True)
    client_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    client_finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    analysis: Mapped["AnalysisResult | None"] = relationship(  # noqa: F821
        back_populates="response", uselist=False, cascade="all, delete-orphan"
    )
