"""Провайдер-абстракция LLM.

Реальные сетевые вызовы инкапсулированы за единым интерфейсом, что:
  - упрощает тесты (mock-провайдер по умолчанию в dev);
  - позволяет переключаться OpenAI ↔ Anthropic ↔ Ollama без правки кода;
  - даёт единую retry/таймаут-политику на уровне сервиса.
"""

from __future__ import annotations

import json
import random
from abc import ABC, abstractmethod
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def complete_json(
        self, system: str, user: str, *, model: str, timeout: float
    ) -> dict[str, Any]: ...

    async def complete_text(
        self,
        system: str,
        messages: list[dict[str, str]],
        *,
        model: str,
        timeout: float,
    ) -> str:
        """Свободный текстовый ответ (для ассистента «Джарвис»).

        Базовая реализация — fallback на complete_json и возврат summary.
        Провайдеры с чат-API переопределяют этот метод.
        """
        last_user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            "",
        )
        data = await self.complete_json(
            system, last_user, model=model, timeout=timeout
        )
        return data.get("summary_text") or str(data)


class MockProvider(LLMProvider):
    """Детерминированный провайдер для разработки и тестов.

    Сэмплирует осмысленный валидный JSON по schema AIAnalysisResult.
    """

    name = "mock"

    async def complete_text(
        self,
        system: str,
        messages: list[dict[str, str]],
        *,
        model: str,
        timeout: float,
    ) -> str:
        last_user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            "",
        )
        return (
            f"(офлайн-режим, ключ DeepSeek не задан) Понял вопрос: «{last_user[:120]}». "
            "В реальном развёртывании ответ придёт от DeepSeek."
        )

    async def complete_json(
        self, system: str, user: str, *, model: str, timeout: float
    ) -> dict[str, Any]:
        rng = random.Random(hash(user) & 0xFFFFFFFF)

        def s(low: float = 1.5, high: float = 4.5) -> float:
            return round(rng.uniform(low, high), 2)

        stress = s(2.0, 4.5)
        burnout = s(1.5, 4.0)
        trust = s(2.0, 4.8)
        brand = s(2.0, 4.7)
        safety = s(2.5, 4.8)

        anchor_type = "engine"
        if brand > 4.2 and stress > 4.0 and trust < 3.0:
            anchor_type = "anchor_pretender"
        elif stress > 4.2 or trust < 2.5:
            anchor_type = "anchor"
        elif brand < 3.0 and trust < 3.5:
            anchor_type = "neutral"

        flags: list[str] = []
        if stress > 4.0:
            flags.append("high_stress")
        if safety < 3.0:
            flags.append("low_safety_culture")
        if anchor_type == "anchor_pretender":
            flags.append("anchor_pretender")

        return {
            "score_metrics": {
                "stress_index": stress,
                "burnout_risk": burnout,
                "work_life_balance": s(),
                "employer_brand": brand,
                "leadership_trust": trust,
                "safety_culture": safety,
                "career_clarity": s(),
                "team_cohesion": s(),
                "loyalty_intent": s(),
                "psychological_safety": s(),
            },
            "risk_flags": flags,
            "recommendations": [
                "Провести 1:1 с непосредственным руководителем",
                "Пересмотреть распределение нагрузки на текущем объекте",
            ],
            "summary_text": (
                "Сотрудник демонстрирует средний уровень вовлечённости. "
                "Косвенные индикаторы указывают на повышенный стресс при "
                "сохранении позитивных оценок бренда."
            ),
            "employer_image": {
                "keywords": ["надёжная", "требовательная", "консервативная"],
                "one_sentence": (
                    "«Стабильная компания, где можно расти, но требуется "
                    "выдерживать ритм»."
                ),
                "sentiment": "mixed",
                "what_to_change": "Прозрачность критериев премии и графика",
            },
            "anchor_engine": anchor_type,
            "anchor_engine_confidence": round(rng.uniform(0.55, 0.92), 2),
            "anchor_engine_reasoning": (
                "Расхождение между прямой шкалой лояльности и проективными "
                "ответами о готовности рекомендовать работодателя."
            ),
        }


class _OpenAICompatibleProvider(LLMProvider):
    """Общая реализация для OpenAI-совместимых HTTP API (OpenAI, DeepSeek)."""

    base_url: str = "https://api.openai.com"

    def __init__(self, api_key: str, *, base_url: str | None = None) -> None:
        self.api_key = api_key
        if base_url:
            self.base_url = base_url.rstrip("/")

    async def complete_json(
        self, system: str, user: str, *, model: str, timeout: float
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(
                f"{self.base_url}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                },
            )
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            start, end = content.find("{"), content.rfind("}")
            return json.loads(content[start : end + 1] if start != -1 else content)

    async def complete_text(
        self,
        system: str,
        messages: list[dict[str, str]],
        *,
        model: str,
        timeout: float,
    ) -> str:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(
                f"{self.base_url}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [{"role": "system", "content": system}, *messages],
                    "temperature": 0.5,
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()


class OpenAIProvider(_OpenAICompatibleProvider):
    name = "openai"
    base_url = "https://api.openai.com"


class DeepSeekProvider(_OpenAICompatibleProvider):
    name = "deepseek"
    base_url = "https://api.deepseek.com"


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def complete_json(
        self, system: str, user: str, *, model: str, timeout: float
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 2048,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            )
            r.raise_for_status()
            data = r.json()
            text = data["content"][0]["text"]
            start, end = text.find("{"), text.rfind("}")
            return json.loads(text[start : end + 1])


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    async def complete_json(
        self, system: str, user: str, *, model: str, timeout: float
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "stream": False,
                    "format": "json",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            r.raise_for_status()
            return json.loads(r.json()["message"]["content"])


def build_provider(
    name: str,
    *,
    openai_key: str,
    anthropic_key: str,
    deepseek_key: str,
    deepseek_url: str,
    ollama_url: str,
) -> LLMProvider:
    name = name.lower()
    if name == "deepseek" and deepseek_key:
        return DeepSeekProvider(deepseek_key, base_url=deepseek_url)
    if name == "openai" and openai_key:
        return OpenAIProvider(openai_key)
    if name == "anthropic" and anthropic_key:
        return AnthropicProvider(anthropic_key)
    if name == "ollama":
        return OllamaProvider(ollama_url)
    if name not in {"mock", "deepseek", "openai", "anthropic", "ollama"}:
        logger.warning("ai.unknown_provider", name=name)
    return MockProvider()
