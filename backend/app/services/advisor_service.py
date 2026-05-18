"""Advisor: рекомендации замполиту по трём осям —
   - content (что и как постить в VK),
   - promotion (бренд работодателя, охваты, тон),
   - internal_policy (внутренние HR-практики на основе текущих метрик).

Принимает на вход агрегаты дашборда + VK-снимок, выдаёт структурированный
JSON через DeepSeek. Кэшируется по хешу входа на 30 минут.
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any

import structlog
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import get_settings
from app.services.ai_providers import MockProvider, build_provider

logger = structlog.get_logger(__name__)


class AdvisorRecommendation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    detail: str
    severity: str = Field(default="info", pattern="^(info|warn|critical)$")


class AdvisorOutput(BaseModel):
    content: list[AdvisorRecommendation] = Field(default_factory=list)
    promotion: list[AdvisorRecommendation] = Field(default_factory=list)
    internal_policy: list[AdvisorRecommendation] = Field(default_factory=list)
    summary: str = ""


_cache: dict[str, tuple[float, dict[str, Any]]] = {}


_SYSTEM_PROMPT = (
    "Ты — стратегический советник замполита строительной компании "
    "«СпецМонтажПроект». На основе агрегатов опроса сотрудников и "
    "снимка VK-страницы компании дай конкретные рекомендации в трёх "
    "категориях. Никакого маркдауна, никаких эмодзи, никаких длинных "
    "вступлений. Только JSON по схеме:\n"
    "{\n"
    '  "content": [{"title":"...","detail":"...","severity":"info|warn|critical"}],\n'
    '  "promotion": [...],\n'
    '  "internal_policy": [...],\n'
    '  "summary": "1-2 предложения"\n'
    "}\n"
    "Правила:\n"
    "- 2–4 пункта в каждой категории, не больше;\n"
    "- title до 80 символов, detail до 280 символов;\n"
    "- если метрика плохая, severity=warn или critical;\n"
    "- учитывай реальные числа из контекста, не выдумывай;\n"
    "- предлагай практичные шаги (что сделать на следующей неделе)."
)


def _make_user_prompt(dashboard: dict[str, Any], vk: dict[str, Any]) -> str:
    company = dashboard.get("company_metrics") or {}
    anchors = dashboard.get("anchor_engine_distribution") or {}
    image = dashboard.get("employer_image") or {}
    kw = ", ".join(k.get("keyword", "") for k in image.get("top_keywords", [])[:8])
    sentences = "\n".join(f"  - {s}" for s in image.get("sample_sentences", [])[:5])

    vk_block = "VK интеграция выключена."
    if vk.get("enabled"):
        g = vk.get("group") or {}
        a = vk.get("aggregate") or {}
        vk_block = (
            f"Группа: {g.get('name', '—')}, подписчиков {g.get('members_count', '—')}.\n"
            f"Постов в выборке: {a.get('posts', 0)}, "
            f"средний лайк {a.get('avg_likes', '—')}, "
            f"доля постов с фото {a.get('image_share', '—')}.\n"
            "Последние тексты (короткие фрагменты):\n"
            + "\n".join(
                f"  - {p.get('text', '')[:120]}…  лайки={p.get('likes')}"
                for p in (vk.get("posts") or [])[:8]
            )
        )

    return (
        f"Респондентов: {dashboard.get('respondents', 0)}\n"
        f"Средние метрики (0..5):\n"
        f"  стресс={company.get('stress_index', '—')}\n"
        f"  доверие к руководству={company.get('leadership_trust', '—')}\n"
        f"  безопасность={company.get('safety_culture', '—')}\n"
        f"  бренд работодателя={company.get('employer_brand', '—')}\n"
        f"  командная сплочённость={company.get('team_cohesion', '—')}\n"
        f"  лояльность={company.get('loyalty_intent', '—')}\n"
        f"Распределение anchor_engine: {anchors}\n"
        f"Ключевые слова образа: {kw}\n"
        f"Цитаты сотрудников:\n{sentences}\n\n"
        f"VK-снимок:\n{vk_block}\n\n"
        "Сформируй рекомендации."
    )


class AdvisorService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.provider = build_provider(
            "deepseek" if self.settings.deepseek_api_key else "mock",
            openai_key=self.settings.openai_api_key,
            anthropic_key=self.settings.anthropic_api_key,
            deepseek_key=self.settings.deepseek_api_key,
            deepseek_url=self.settings.deepseek_base_url,
            ollama_url=self.settings.ollama_base_url,
        )

    async def recommend(
        self, dashboard: dict[str, Any], vk: dict[str, Any]
    ) -> AdvisorOutput:
        if not self.settings.advisor_enabled:
            return AdvisorOutput()

        cache_key = hashlib.sha256(
            json.dumps(
                {"d": dashboard.get("company_metrics"), "v": vk.get("aggregate")},
                sort_keys=True,
                default=str,
            ).encode()
        ).hexdigest()
        if cached := _cache.get(cache_key):
            ts, payload = cached
            if time.time() - ts < 30 * 60:
                return AdvisorOutput(**payload)

        user_prompt = _make_user_prompt(dashboard, vk)
        try:
            raw = await self.provider.complete_json(
                _SYSTEM_PROMPT,
                user_prompt,
                model=self.settings.advisor_model,
                timeout=self.settings.ai_timeout_seconds,
            )
        except Exception as e:  # noqa: BLE001
            logger.error("advisor.failure", error=str(e))
            raw = await MockProvider().complete_json(
                _SYSTEM_PROMPT,
                user_prompt,
                model=self.settings.advisor_model,
                timeout=self.settings.ai_timeout_seconds,
            )
            raw = _fallback_advice(dashboard, vk)

        try:
            output = AdvisorOutput(**raw)
        except ValidationError as e:
            logger.error("advisor.schema_invalid", errors=e.errors())
            output = AdvisorOutput(**_fallback_advice(dashboard, vk))

        _cache[cache_key] = (time.time(), output.model_dump())
        return output


def _fallback_advice(
    dashboard: dict[str, Any], vk: dict[str, Any]
) -> dict[str, Any]:
    """Эвристический fallback, если LLM недоступен."""
    company = dashboard.get("company_metrics") or {}
    safety = company.get("safety_culture", 4)
    stress = company.get("stress_index", 3)
    brand = company.get("employer_brand", 3)

    content = [
        {
            "title": "Истории сотрудников",
            "detail": (
                "Раз в неделю публикуйте короткий рассказ от прораба/мастера: "
                "как прошёл этап, чем гордится бригада."
            ),
            "severity": "info",
        }
    ]
    if vk.get("enabled") and (vk.get("aggregate") or {}).get("image_share", 1) < 0.6:
        content.append(
            {
                "title": "Меньше текста, больше фото",
                "detail": "Доля постов с фото ниже 60%. Добавляйте фото объектов и людей.",
                "severity": "warn",
            }
        )

    promotion = [
        {
            "title": (
                "Тон коммуникации соответствует образу"
                if brand >= 3.5
                else "Подкрутить тон бренда"
            ),
            "detail": (
                "Текущий бренд работодателя оценивается в "
                f"{brand}/5. Подсветите ценности, которые сотрудники называют в опросе."
            ),
            "severity": "info" if brand >= 3.5 else "warn",
        }
    ]

    policy = []
    if safety < 3.5:
        policy.append(
            {
                "title": "Внеочередной разбор ОТ",
                "detail": (
                    f"Культура безопасности {safety}/5. Проведите 30-минутный "
                    "брифинг по нарушениям за неделю на каждом участке."
                ),
                "severity": "critical",
            }
        )
    if stress > 3.8:
        policy.append(
            {
                "title": "Ревизия графика дежурств",
                "detail": (
                    f"Стресс {stress}/5. Проверьте плечи между сменами и "
                    "ночные звонки от руководителей."
                ),
                "severity": "warn",
            }
        )
    if not policy:
        policy.append(
            {
                "title": "Поддержать текущий ритм",
                "detail": "Метрики в норме. Запланируйте повторный замер через 4 недели.",
                "severity": "info",
            }
        )

    return {
        "content": content,
        "promotion": promotion,
        "internal_policy": policy,
        "summary": "Эвристические рекомендации (LLM-провайдер недоступен).",
    }
