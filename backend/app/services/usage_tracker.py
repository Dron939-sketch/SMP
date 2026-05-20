"""Регистрация пользовательской активности.

Middleware пишет в usage_events для каждого осмысленного API-вызова.
Парсер User-Agent — без сторонних зависимостей, простые регексы.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import structlog
from sqlalchemy import insert
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.database import SessionLocal
from app.models.usage import UsageEvent

logger = structlog.get_logger(__name__)


# Какие пути НЕ логируем — служебные/шумные.
SKIP_PREFIXES = (
    "/health",
    "/metrics",
    "/api/docs",
    "/api/openapi",
    "/static",
)


# Человекочитаемое название действия для пути.
ACTION_BY_PATH = [
    ("GET /api/dashboard/political-officer", "Просмотр дашборда"),
    ("GET /api/dashboard/vk", "Просмотр VK-снимка"),
    ("POST /api/dashboard/advisor/refresh", "Обновление рекомендаций"),
    ("GET /api/dashboard/export", "Экспорт отчёта"),
    ("GET /api/reports/responses", "Просмотр отчётов"),
    ("GET /api/reports/responses/", "Открытие отчёта респондента"),
    ("GET /api/tests", "Список тестов"),
    ("GET /api/tests/shared", "Открытие теста по ссылке"),
    ("POST /api/tests/shared", "Прохождение теста (по ссылке)"),
    ("POST /api/tests/", "Прохождение теста"),
    ("POST /api/tests/_reseed", "Пересоздание тестов (admin)"),
    ("/share", "Создание/просмотр ссылок на тест"),
    ("POST /api/assistant/greeting", "Приветствие Джарвиса"),
    ("GET /api/assistant/greeting", "Приветствие Джарвиса"),
    ("POST /api/assistant/ask", "Запрос к Джарвису"),
    ("POST /api/assistant/speak", "Озвучка ответа"),
    ("POST /api/assistant/listen", "Распознавание голоса"),
    ("POST /api/auth/login", "Вход"),
    ("POST /api/admin/wipe-responses", "Очистка ответов (admin)"),
    ("POST /api/admin/wipe-share-links", "Очистка ссылок (admin)"),
    ("GET /api/usage/events", "Просмотр статистики"),
]


def _action_for(method: str, path: str) -> str | None:
    key1 = f"{method} {path}"
    for prefix, label in ACTION_BY_PATH:
        if key1.startswith(prefix) or path.startswith(prefix) or prefix in key1:
            return label
    return None


_UA_BROWSERS = [
    ("YaBrowser", "Yandex Browser"),
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("Chrome/", "Chrome"),
    ("Firefox/", "Firefox"),
    ("Safari/", "Safari"),
]
_UA_OS = [
    ("Windows NT", "Windows"),
    ("Mac OS X", "macOS"),
    ("iPhone", "iOS"),
    ("iPad", "iPadOS"),
    ("Android", "Android"),
    ("Linux", "Linux"),
]


def parse_user_agent(ua: str | None) -> dict[str, str | None]:
    if not ua:
        return {"browser": None, "os": None, "device": None}
    browser = next((name for tag, name in _UA_BROWSERS if tag in ua), None)
    os_ = next((name for tag, name in _UA_OS if tag in ua), None)
    device = (
        "iPhone" if "iPhone" in ua
        else "iPad" if "iPad" in ua
        else "Android" if "Android" in ua and "Mobile" in ua
        else "Tablet" if "Android" in ua
        else "Desktop"
    )
    return {"browser": browser, "os": os_, "device": device}


class UsageTrackingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        path = request.url.path
        if any(path.startswith(p) for p in SKIP_PREFIXES):
            return await call_next(request)

        t0 = time.perf_counter()
        response: Response = await call_next(request)
        dur_ms = int((time.perf_counter() - t0) * 1000)

        try:
            ua = request.headers.get("user-agent")
            ip = (
                request.headers.get("x-forwarded-for", "").split(",")[0].strip()
                or (request.client.host if request.client else None)
            )
            uap = parse_user_agent(ua)
            action = _action_for(request.method, path)

            # user_id — если он в request.state (выставлено deps),
            # иначе берём дефолтного замполита.
            user_id = getattr(request.state, "user_id", None)
            user_label = getattr(request.state, "user_label", "Зорин Илья")

            async with SessionLocal() as session:
                await session.execute(
                    insert(UsageEvent).values(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        user_label=user_label,
                        method=request.method,
                        path=path[:255],
                        action=action,
                        status_code=response.status_code,
                        duration_ms=dur_ms,
                        ip=(ip or "")[:64] or None,
                        user_agent=(ua or "")[:512] or None,
                        **uap,
                    )
                )
                await session.commit()
        except Exception as e:
            logger.warning("usage.write_failed", error=str(e))

        return response
