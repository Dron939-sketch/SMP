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
from app.schemas.ai import AIAnalyzeRequest, AIAnalysisResult
from app.services.ai_providers import LLMProvider, MockProvider, build_provider
from app.services.prompt_loader import PromptLoader, get_prompt_loader

logger = structlog.get_logger(__name__)

_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _hash_payload(payload: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _hash_pii(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:16]


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
        except Exception as e:  # noqa: BLE001
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
