import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.test import QuestionType


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    display_text: str
    question_type: QuestionType
    options: dict[str, Any] | None = None
    order_index: int
    is_required: bool


class QuestionAdmin(QuestionRead):
    """Версия, видимая только админу/замполиту: со скрытыми метриками."""

    hidden_metrics: dict[str, float]
    reverse_scored: bool
    follow_up_trigger: dict[str, Any] | None = None


class TestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None = None
    cycle: str
    is_active: bool
    time_limit_seconds: int | None = None
    created_at: datetime
    questions: list[QuestionRead]


class AnswerSubmit(BaseModel):
    question_id: uuid.UUID
    code: str
    value: int | float | str | list[str] | None = None
    text: str | None = None
    # сколько миллисекунд респондент думал именно над этим вопросом.
    # До 1 часа на один вопрос — чтобы долгие раздумья не валили сабмит.
    time_spent_ms: int | None = Field(default=None, ge=0, le=3_600_000)
    # сколько раз менял ответ — индикатор сомнений.
    # Это служебная метрика: чтобы случайные «качели» по варианту ответа
    # не валили сабмит всего теста, верхняя граница широкая.
    revisions: int | None = Field(default=None, ge=0, le=10_000)


class TestSubmitRequest(BaseModel):
    cycle_tag: str = Field(min_length=1, max_length=32)
    answers: list[AnswerSubmit] = Field(min_length=1)
    total_time_ms: int | None = Field(default=None, ge=0, le=4 * 3600 * 1000)
    client_started_at: datetime | None = None
    client_finished_at: datetime | None = None


class TestSubmitResponse(BaseModel):
    response_id: uuid.UUID
    analysis_id: uuid.UUID | None = None
    queued: bool = False


class ShareLinkCreate(BaseModel):
    cycle_tag: str = Field(min_length=1, max_length=32)
    expires_in_days: int = Field(default=14, ge=1, le=365)
    note: str | None = Field(default=None, max_length=255)


class ShareLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    token: str
    cycle_tag: str
    expires_at: datetime | None
    uses: int
    note: str | None = None
    share_url: str
