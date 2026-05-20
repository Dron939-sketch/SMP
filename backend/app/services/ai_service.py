"""Сервис ИИ-анализа.

Цепочка:
  1) собираем user-prompt из шаблона + ответов сотрудника;
  2) запрашиваем LLM (через провайдер) с retry/timeout;
  3) валидируем JSON через pydantic;
  4) при провале — fallback на эвристику (анкета как Likert-агрегатор);
  5) кэшируем по хешу payload на N часов.
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any

import structlog
from pydantic import ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.schemas.ai import AIAnalysisResult, AIAnalyzeRequest
from app.services.ai_providers import LLMProvider, MockProvider, build_provider
from app.services.prompt_loader import PromptLoader, get_prompt_loader

logger = structlog.get_logger(__name__)

_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _hash_payload(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _hash_pii(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:16]


# Известные синонимы, которые LLM выдаёт вместо канонических имён шкал.
_METRIC_ALIASES: dict[str, str] = {
    "loyalty": "loyalty_intent",
    "loyalty_index": "loyalty_intent",
    "team_spirit": "team_cohesion",
    "team": "team_cohesion",
    "cohesion": "team_cohesion",
    "career": "career_clarity",
    "career_growth": "career_clarity",
    "career_path": "career_clarity",
    "safety": "safety_culture",
    "stress": "stress_index",
    "burnout": "burnout_risk",
    "wlb": "work_life_balance",
    "balance": "work_life_balance",
    "brand": "employer_brand",
    "leadership": "leadership_trust",
    "trust": "leadership_trust",
    "psy_safety": "psychological_safety",
    "psafety": "psychological_safety",
}

_REQUIRED_METRICS = (
    "stress_index",
    "burnout_risk",
    "work_life_balance",
    "employer_brand",
    "leadership_trust",
    "safety_culture",
    "career_clarity",
    "team_cohesion",
    "loyalty_intent",
    "psychological_safety",
)

# Замена технических кодов на русские слова в свободном тексте
# (summary_text / reasoning / recommendations). Порядок важен:
# длинные имена раньше — иначе "stress" заменится в "stress_index".
_TEXT_RU: tuple[tuple[str, str], ...] = (
    ("psychological_safety", "психологическая безопасность"),
    ("work_life_balance", "баланс работа/жизнь"),
    ("leadership_trust", "доверие к руководству"),
    ("safety_culture", "культура безопасности"),
    ("employer_brand", "бренд работодателя"),
    ("career_clarity", "понятность карьеры"),
    ("team_cohesion", "сплочённость команды"),
    ("loyalty_intent", "лояльность"),
    ("burnout_risk", "риск выгорания"),
    ("stress_index", "уровень стресса"),
    ("anchor_pretender", "якорь под маской двигателя"),
    ("learning_agility", "обучаемость"),
    ("conscientiousness", "добросовестность"),
    ("openness", "открытость новому"),
)


def _ru_codes(text: str) -> str:
    """Заменяет технические имена шкал на русские в свободном тексте."""
    if not text:
        return text
    for code, ru in _TEXT_RU:
        text = text.replace(code, ru)
    return text


def _normalize_llm_response(raw: dict[str, Any]) -> dict[str, Any]:
    """Приводит ответ LLM к каноничной схеме AIAnalysisResult.

    Реальные LLM (DeepSeek, OpenAI) иногда возвращают свои варианты
    имён — например ``loyalty`` вместо ``loyalty_intent`` или
    ``team_spirit`` вместо ``team_cohesion``. Маппим известные
    синонимы, выкидываем неизвестные ключи, добиваем недостающие
    метрики значением 3.0 (нейтральное «нет данных»). Plus:
    - ``summary_text`` собирается из reasoning, если пустой;
    - ``anchor_engine_confidence`` ставится 0.6 если не задан;
    - ``employer_image`` гарантированно непустой.
    """
    out = dict(raw)

    # score_metrics: алиасы → каноны, добиваем недостающие.
    metrics_in = dict(raw.get("score_metrics") or {})
    metrics_out: dict[str, float] = {}
    for key, val in metrics_in.items():
        canon = _METRIC_ALIASES.get(key, key)
        if canon in _REQUIRED_METRICS or canon in (
            "conscientiousness",
            "openness",
            "learning_agility",
        ):
            try:
                metrics_out[canon] = float(val)
            except (TypeError, ValueError):
                continue
    for k in _REQUIRED_METRICS:
        metrics_out.setdefault(k, 3.0)
    out["score_metrics"] = metrics_out

    # summary_text — обязательное непустое.
    summary = (raw.get("summary_text") or "").strip()
    if not summary:
        # Соберём из reasoning + первой рекомендации, если есть.
        parts = []
        if reasoning := raw.get("anchor_engine_reasoning"):
            parts.append(str(reasoning))
        recs = raw.get("recommendations")
        if isinstance(recs, list) and recs:
            parts.append(f"Рекомендация: {recs[0]}")
        summary = " ".join(parts) or "Краткое резюме недоступно: модель не предоставила описание."
    out["summary_text"] = _ru_codes(summary[:1900])

    # anchor_engine_confidence — обязательное.
    if "anchor_engine_confidence" not in out or out.get("anchor_engine_confidence") is None:
        out["anchor_engine_confidence"] = 0.6
    else:
        try:
            c = float(out["anchor_engine_confidence"])
            out["anchor_engine_confidence"] = max(0.0, min(1.0, c))
        except (TypeError, ValueError):
            out["anchor_engine_confidence"] = 0.6

    # anchor_engine — допустимое значение.
    valid_anchors = {"engine", "neutral", "anchor", "anchor_pretender"}
    if out.get("anchor_engine") not in valid_anchors:
        out["anchor_engine"] = "neutral"
    reasoning_text = (out.get("anchor_engine_reasoning") or "").strip()
    if not reasoning_text:
        reasoning_text = "Недостаточно данных для уверенного вывода."
    out["anchor_engine_reasoning"] = _ru_codes(reasoning_text)

    # employer_image — гарантированно есть и не пустой, тексты — на русском.
    ei = raw.get("employer_image") or {}
    if not isinstance(ei, dict):
        ei = {}
    ei.setdefault("keywords", [])
    ei.setdefault("one_sentence", "")
    ei.setdefault("sentiment", "neutral")
    ei["one_sentence"] = _ru_codes(ei.get("one_sentence") or "")
    if ei.get("what_to_change"):
        ei["what_to_change"] = _ru_codes(ei["what_to_change"])
    out["employer_image"] = ei

    # risk_flags — массив; recommendations — массив, текст по-русски.
    out["risk_flags"] = list(raw.get("risk_flags") or [])
    out["recommendations"] = [
        _ru_codes(str(r)) for r in list(raw.get("recommendations") or [])[:8]
    ]

    return out


class AIService:
    def __init__(
        self,
        provider: LLMProvider | None = None,
        prompt_loader: PromptLoader | None = None,
    ) -> None:
        self.settings = get_settings()
        self.prompts = prompt_loader or get_prompt_loader()
        self.provider = provider or build_provider(
            self.settings.ai_provider,
            openai_key=self.settings.openai_api_key,
            anthropic_key=self.settings.anthropic_api_key,
            deepseek_key=self.settings.deepseek_api_key,
            deepseek_url=self.settings.deepseek_base_url,
            ollama_url=self.settings.ollama_base_url,
        )

    def _build_user_prompt(
        self, request: AIAnalyzeRequest, template: str
    ) -> str:
        answers_block = "\n".join(
            f"- [{a.code}] type={type(a.value).__name__} value={a.value!r}"
            f"{' text=' + repr(a.text) if a.text else ''}"
            for a in request.answers
        )
        return (
            template.replace("{{role}}", request.role)
            .replace("{{department}}", request.department or "—")
            .replace("{{site}}", request.site or "—")
            .replace("{{cycle_tag}}", request.cycle_tag)
            .replace("{{answers}}", answers_block)
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        reraise=True,
    )
    async def _call_provider(self, system: str, user: str) -> dict[str, Any]:
        return await self.provider.complete_json(
            system,
            user,
            model=self.settings.ai_model,
            timeout=self.settings.ai_timeout_seconds,
        )

    async def analyze(self, request: AIAnalyzeRequest) -> AIAnalysisResult:
        version = request.prompt_version or self.prompts.active_version
        cache_key = _hash_payload(
            {
                "v": version,
                "model": self.settings.ai_model,
                "answers": [a.model_dump() for a in request.answers],
            }
        )
        ttl = self.settings.ai_cache_ttl_hours * 3600
        if cached := _cache.get(cache_key):
            ts, payload = cached
            if time.time() - ts < ttl:
                logger.info(
                    "ai.cache_hit",
                    employee=_hash_pii(request.employee_id),
                    version=version,
                )
                return AIAnalysisResult(**payload)

        system = self.prompts.get_system(version)
        user = self._build_user_prompt(
            request, self.prompts.get_user_template(version)
        )

        t0 = time.perf_counter()
        try:
            raw = await self._call_provider(system, user)
        except Exception as e:
            logger.error(
                "ai.provider_failure",
                provider=self.provider.name,
                error=str(e),
                employee=_hash_pii(request.employee_id),
            )
            raw = await MockProvider().complete_json(
                system,
                user,
                model=self.settings.ai_model,
                timeout=self.settings.ai_timeout_seconds,
            )

        raw["prompt_version"] = version
        raw["ai_model"] = self.settings.ai_model
        raw = _normalize_llm_response(raw)
        try:
            result = AIAnalysisResult(**raw)
        except ValidationError as e:
            logger.error(
                "ai.schema_validation_failed",
                errors=e.errors(),
                employee=_hash_pii(request.employee_id),
            )
            raw = await MockProvider().complete_json(
                system,
                user,
                model=self.settings.ai_model,
                timeout=self.settings.ai_timeout_seconds,
            )
            raw["prompt_version"] = version
            raw["ai_model"] = "fallback:mock"
            result = AIAnalysisResult(**raw)

        latency = int((time.perf_counter() - t0) * 1000)
        logger.info(
            "ai.analysis_done",
            employee=_hash_pii(request.employee_id),
            version=version,
            anchor=result.anchor_engine,
            latency_ms=latency,
            flags=result.risk_flags,
        )

        _cache[cache_key] = (time.time(), result.model_dump(mode="json"))
        return result
