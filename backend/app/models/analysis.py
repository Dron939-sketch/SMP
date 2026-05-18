import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class AnalysisResult(Base):
    """Результат ИИ-анализа сырых ответов.

    `score_metrics` — JSON с числовыми оценками скрытых метрик (0..5).
    `risk_flags` — массив тегов: ["high_stress", "low_safety_culture",
    "anchor_pretender", ...].
    `anchor_engine` — тип сотрудника: "engine" | "neutral" | "anchor" |
    "anchor_pretender" (внешне двигатель, по факту якорь).
    """

    __tablename__ = "analysis_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("test_responses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    ai_model: Mapped[str] = mapped_column(String(64), nullable=False)

    score_metrics: Mapped[dict[str, float]] = mapped_column(JSON, nullable=False)
    risk_flags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    recommendations: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)

    employer_image: Mapped[dict | None] = mapped_column(JSON)
    anchor_engine: Mapped[str | None] = mapped_column(String(32), index=True)
    anchor_engine_confidence: Mapped[float | None] = mapped_column(Float)
    anchor_engine_reasoning: Mapped[str | None] = mapped_column(Text)

    raw_llm_response: Mapped[dict | None] = mapped_column(JSON)
    latency_ms: Mapped[int | None] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    response: Mapped["TestResponse"] = relationship(back_populates="analysis")  # noqa: F821
