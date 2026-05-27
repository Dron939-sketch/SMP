import asyncio
from contextlib import asynccontextmanager

import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    admin,
    ai,
    assistant,
    auth,
    dashboard,
    health,
    prompts,
    reports,
    tests,
    usage,
)
from app.config import get_settings
from app.core.logging import configure_logging
from app.services.prompt_loader import get_prompt_loader
from app.services.usage_tracker import UsageTrackingMiddleware

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    if settings.sentry_dsn:
        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.app_env)
    loader = get_prompt_loader()
    logger.info(
        "app.startup",
        app=settings.app_name,
        version=settings.app_version,
        prompt_version=loader.active_version,
        ai_provider=settings.ai_provider,
    )

    # Запускаем сидинг прямо тут, чтобы видеть ошибки в логах (а не
    # глотать их через `|| true` в Dockerfile-CMD). Идемпотентно:
    # _ensure_user/Test внутри проверяет существование.
    try:
        from app.seed import run as seed_run

        await seed_run()
    except Exception as e:
        logger.error("seed.failed", error=str(e), exc_info=True)

    watch_task: asyncio.Task | None = None
    if settings.prompts_hot_reload:
        watch_task = asyncio.create_task(loader.watch())
    try:
        yield
    finally:
        loader.stop_watch()
        if watch_task:
            watch_task.cancel()
        logger.info("app.shutdown")


settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
app.add_middleware(UsageTrackingMiddleware)


@app.exception_handler(RequestValidationError)
async def _validation_exception(request, exc: RequestValidationError):  # type: ignore[no-untyped-def]
    """422-валидация — в лог: какое поле, какой код, что прислали.
    Без этого диагностировать падающие submit вслепую очень тяжело."""
    from fastapi.responses import JSONResponse

    # exc.errors() безопасен для логирования: pydantic чистит «input»
    # от больших значений, но на всякий случай ограничим длину.
    errs = []
    for e in exc.errors()[:10]:
        item = {"loc": e.get("loc"), "type": e.get("type"), "msg": e.get("msg")}
        inp = e.get("input")
        if isinstance(inp, str):
            item["input_preview"] = inp[:120]
            item["input_len"] = len(inp)
        elif isinstance(inp, list | dict):
            item["input_kind"] = type(inp).__name__
            item["input_len"] = len(inp)
        else:
            item["input"] = inp
        errs.append(item)
    logger.warning(
        "request_validation_failed",
        path=request.url.path,
        method=request.method,
        errors=errs,
    )
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def _unhandled_exception(request, exc):  # type: ignore[no-untyped-def]
    """Любая необработанная ошибка — в лог со stack-trace.
    Клиенту отдаём 500 с понятным русским текстом, не прокидывая
    внутренности наружу."""
    from fastapi.responses import JSONResponse

    logger.exception(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Внутренняя ошибка сервера. Попробуйте ещё раз."},
    )


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(tests.router)
app.include_router(ai.router)
app.include_router(prompts.router)
app.include_router(dashboard.router)
app.include_router(assistant.router)
app.include_router(admin.router)
app.include_router(reports.router)
app.include_router(usage.router)
