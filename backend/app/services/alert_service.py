"""Сервис алертов.

Триггеры (для замполита):
  - stress_index > порога;
  - safety_culture < порога;
  - anchor_engine == "anchor_pretender" (главный поведенческий сигнал).
"""

from __future__ import annotations

import httpx
import structlog

from app.config import get_settings
from app.schemas.ai import AIAnalysisResult

logger = structlog.get_logger(__name__)


def evaluate(result: AIAnalysisResult) -> list[dict[str, str]]:
    settings = get_settings()
    alerts: list[dict[str, str]] = []

    if result.score_metrics.stress_index > settings.alert_stress_threshold:
        alerts.append(
            {
                "code": "high_stress",
                "severity": "high",
                "message": (
                    f"Стресс {result.score_metrics.stress_index:.1f} "
                    f"превышает порог {settings.alert_stress_threshold}"
                ),
            }
        )

    if result.score_metrics.safety_culture < settings.alert_safety_threshold:
        alerts.append(
            {
                "code": "low_safety_culture",
                "severity": "critical",
                "message": (
                    f"Культура безопасности {result.score_metrics.safety_culture:.1f} "
                    f"ниже порога {settings.alert_safety_threshold}"
                ),
            }
        )

    if result.anchor_engine == "anchor_pretender":
        alerts.append(
            {
                "code": "anchor_pretender",
                "severity": "high",
                "message": (
                    "Поведенческий якорь под маской двигателя: внешне "
                    "лояльный сотрудник, по проективным ответам — снижает "
                    "командный темп."
                ),
            }
        )

    return alerts


async def dispatch_alerts(alerts: list[dict[str, str]]) -> None:
    settings = get_settings()
    if not alerts or not settings.alert_webhook_url:
        return
    async with httpx.AsyncClient(timeout=5) as client:
        try:
            await client.post(settings.alert_webhook_url, json={"alerts": alerts})
        except httpx.HTTPError as e:
            logger.error("alert.webhook_failed", error=str(e))
