import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class QuestionType(str, enum.Enum):
    LIKERT_5 = "likert_5"
    MULTIPLE_CHOICE = "multiple_choice"
    SINGLE_CHOICE = "single_choice"
    OPEN_TEXT = "open_text"
    RANKING = "ranking"
    SCENARIO = "scenario"


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # description = легенда для сотрудников ("обложка"), real_focus = что
    # реально замеряет тест (видит только замполит/админ).
    description: Mapped[str | None] = mapped_column(Text)
    real_focus: Mapped[str | None] = mapped_column(Text)

    cycle: Mapped[str] = mapped_column(String(32), default="monthly")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    questions: Mapped[list["Question"]] = relationship(
        back_populates="test", cascade="all, delete-orphan", order_by="Question.order_index"
    )


class Question(Base):
    """Замаскированный вопрос.

    `display_text` — то, что видит сотрудник (нейтральная формулировка).
    `hidden_metrics` — какие скрытые метрики этот вопрос измеряет и с каким весом
    (например {"stress_index": 0.7, "burnout": 0.3}).
    `reverse_scored` — нужно ли инвертировать шкалу при подсчёте.
    """

    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tests.id", ondelete="CASCADE"), nullable=False
    )

    code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    display_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    options: Mapped[dict | None] = mapped_column(JSON)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    hidden_metrics: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    reverse_scored: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    follow_up_trigger: Mapped[dict | None] = mapped_column(JSON)

    test: Mapped[Test] = relationship(back_populates="questions")
