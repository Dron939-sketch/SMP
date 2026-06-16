"""Кеш собранных портретов сотрудников и компании.

Зачем нужен:
- Чтобы не агрегировать AnalysisResult'ы при каждом открытии вкладки.
- Чтобы хранить LLM-сгенерированные литературные сводки (Stage 2 —
  дорогие, нельзя делать на каждый просмотр).

Инвалидация — по `input_hash`: если набор source-AnalysisResult'ов
изменился (новый тест прошёл/перегенерировался анализ), хеш не
сходится → кеш считается устаревшим, пересобираем.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class CachedPortrait(Base):
    __tablename__ = "cached_portraits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Тип портрета: 'employee' = по одному респонденту,
    # 'company' = глобальный портрет компании
    portrait_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    # Ключ субъекта:
    #   employee → respondent_name (ФИО)
    #   company  → "__all__" или cycle_tag
    subject_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Цикл; null = агрегация по всем циклам
    cycle_tag: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)

    # Хеш входных данных (sha256 от sorted(analysis_id) + max submitted_at).
    # Если хеш не совпадает с актуальным — кеш протух.
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Готовая агрегация — вся структура портрета (avg_metrics, risk_freq,
    # history, top_recommendations, anchor_engine и т.д.)
    aggregated_data: Mapped[dict] = mapped_column(JSON, nullable=False)

    # LLM-литературная сводка (Stage 2). null до тех пор пока не сгенерирована.
    synthesized_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index(
            "idx_cached_portrait_lookup",
            "portrait_type",
            "subject_key",
            "cycle_tag",
        ),
    )
