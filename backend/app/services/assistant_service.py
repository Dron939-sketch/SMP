"""Сервис ассистента «Джарвис» (DeepSeek).

Управленческий помощник замполита. Может:
  - объяснять метрики и тренды текущего цикла («что значит anchor_pretender?»);
  - подсказывать, какому отделу нужен 1:1;
  - формулировать commute-friendly summary (для прослушивания через TTS).

Контекст сборка из последнего dashboard-snapshot — модель не получает
сырых PII, только агрегаты.
"""

from __future__ import annotations

from typing import Any

import structlog

from app.config import get_settings
from app.services.ai_providers import build_provider

logger = structlog.get_logger(__name__)


def _build_system_prompt(context: dict[str, Any] | None) -> str:
    settings = get_settings()
    base = (
        f"Ты — {settings.assistant_name}, корпоративный AI-помощник "
        f"замполита строительной компании «СпецМонтажПроект». "
        "Отвечай кратко, по делу, на русском, спокойным деловым тоном. "
        "Обращайся к собеседнику «командор». Объясняй метрики простыми "
        "словами, без англицизмов где можно. Если данных недостаточно — "
        "честно скажи и предложи, что собрать. Не выдумывай цифры. "
        "Никогда не называй имён сотрудников — только агрегаты по "
        "отделам/участкам. Ответ для голосового озвучивания — не "
        "используй маркдаун, не оформляй списки звёздочками, разделяй "
        "идеи короткими предложениями."
    )
    if context:
        company = context.get("company_metrics") or {}
        anchors = context.get("anchor_engine_distribution") or {}
        image = context.get("employer_image") or {}
        kw = ", ".join(
            k.get("keyword", "") for k in image.get("top_keywords", [])[:7]
        )
        base += (
            "\n\nТекущий снимок дашборда (используй цифры в ответах):\n"
            f"- респондентов: {context.get('respondents', 0)}\n"
            f"- средний стресс: {company.get('stress_index', '—')}\n"
            f"- доверие к руководству: {company.get('leadership_trust', '—')}\n"
            f"- культура безопасности: {company.get('safety_culture', '—')}\n"
            f"- бренд работодателя: {company.get('employer_brand', '—')}\n"
            f"- распределение anchor_engine: {anchors}\n"
            f"- ключевые слова образа: {kw}\n"
        )
    return base


class AssistantService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.provider = build_provider(
            "deepseek" if self.settings.deepseek_api_key else self.settings.ai_provider,
            openai_key=self.settings.openai_api_key,
            anthropic_key=self.settings.anthropic_api_key,
            deepseek_key=self.settings.deepseek_api_key,
            deepseek_url=self.settings.deepseek_base_url,
            ollama_url=self.settings.ollama_base_url,
        )

    async def ask(
        self,
        question: str,
        *,
        history: list[dict[str, str]] | None = None,
        context: dict[str, Any] | None = None,
    ) -> str:
        system = _build_system_prompt(context)
        messages: list[dict[str, str]] = []
        if history:
            for m in history[-10:]:
                if m.get("role") in {"user", "assistant"} and m.get("content"):
                    messages.append({"role": m["role"], "content": m["content"][:4000]})
        messages.append({"role": "user", "content": question[:4000]})

        try:
            answer = await self.provider.complete_text(
                system,
                messages,
                model=self.settings.assistant_model,
                timeout=self.settings.ai_timeout_seconds,
            )
        except Exception as e:  # noqa: BLE001
            logger.error("assistant.failure", provider=self.provider.name, error=str(e))
            answer = (
                "Командор, не смог связаться с DeepSeek. "
                "Проверь ключ DEEPSEEK_API_KEY и сетевой доступ."
            )
        return answer.strip()
