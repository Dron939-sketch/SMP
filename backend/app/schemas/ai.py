"""Pydantic-схемы для ИИ-контракта.

`AIAnalysisResult` — то, что модель ОБЯЗАНА вернуть. Любое расхождение со
схемой считается hallucination и проходит через fallback.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AnchorEngine = Literal["engine", "neutral", "anchor", "anchor_pretender"]


class AIAnswerItem(BaseModel):
    question_id: str
    code: str
    value: int | float | str | list[str] | None = None
    text: str | None = None


class AIAnalyzeRequest(BaseModel):
    employee_id: str
    role: str
    department: str | None = None
    site: str | None = None
    cycle_tag: str
    answers: list[AIAnswerItem]
    prompt_version: str | None = None


class EmployerImage(BaseModel):
    """Краткий «образ компании в голове сотрудника»."""

    keywords: list[str] = Field(default_factory=list, max_length=10)
    one_sentence: str = ""
    sentiment: Literal["positive", "neutral", "mixed", "negative"] = "neutral"
    what_to_change: str | None = None


class ScoreMetrics(BaseModel):
    """Скрытые метрики 0..5. Все поля обязательны для сопоставимости.

    Низкая шкала = плохо (кроме `stress_index`, где наоборот).
    """

    model_config = ConfigDict(extra="allow")

    stress_index: float = Field(ge=0, le=5)
    burnout_risk: float = Field(ge=0, le=5)
    work_life_balance: float = Field(ge=0, le=5)
    employer_brand: float = Field(ge=0, le=5)
    leadership_trust: float = Field(ge=0, le=5)
    safety_culture: float = Field(ge=0, le=5)
    career_clarity: float = Field(ge=0, le=5)
    team_cohesion: float = Field(ge=0, le=5)
    loyalty_intent: float = Field(ge=0, le=5)
    psychological_safety: float = Field(ge=0, le=5)


class AIAnalysisResult(BaseModel):
    score_metrics: ScoreMetrics
    risk_flags: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list, max_length=8)
    summary_text: str = Field(min_length=1, max_length=2000)
    employer_image: EmployerImage
    anchor_engine: AnchorEngine
    anchor_engine_confidence: float = Field(ge=0, le=1)
    anchor_engine_reasoning: str = Field(max_length=1000)

    prompt_version: str
    ai_model: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("risk_flags")
    @classmethod
    def _normalize_flags(cls, v: list[str]) -> list[str]:
        return sorted({flag.strip().lower().replace(" ", "_") for flag in v if flag.strip()})
