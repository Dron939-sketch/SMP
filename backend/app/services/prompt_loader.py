"""Загрузка и горячая перезагрузка YAML-промтов.

Все промты лежат в `ai-prompts/<version>/*.yaml`. При запуске и при
изменении файлов (watchfiles) кэш в памяти переcобирается. Поддерживается
A/B: можно по запросу получить промт конкретной версии для записи метрики.
"""

from __future__ import annotations

import asyncio
import threading
from pathlib import Path
from typing import Any

import structlog
import yaml
from watchfiles import awatch

from app.config import get_settings

logger = structlog.get_logger(__name__)


class PromptNotFoundError(KeyError):
    pass


class PromptLoader:
    def __init__(self, prompts_dir: Path, active_version: str) -> None:
        self.prompts_dir = prompts_dir
        self._active_version = active_version
        self._cache: dict[str, dict[str, dict[str, Any]]] = {}
        self._lock = threading.RLock()
        self._stop_event: asyncio.Event | None = None
        self.reload()

    @property
    def active_version(self) -> str:
        return self._active_version

    def set_active_version(self, version: str) -> None:
        with self._lock:
            if version not in self._cache:
                raise PromptNotFoundError(f"prompt version not loaded: {version}")
            self._active_version = version
            logger.info("prompt.active_version_changed", version=version)

    def available_versions(self) -> list[str]:
        with self._lock:
            return sorted(self._cache.keys())

    def reload(self) -> None:
        with self._lock:
            self._cache.clear()
            if not self.prompts_dir.exists():
                logger.warning("prompts.dir_missing", path=str(self.prompts_dir))
                return
            for version_dir in sorted(self.prompts_dir.iterdir()):
                if not version_dir.is_dir():
                    continue
                version_data: dict[str, dict[str, Any]] = {}
                for f in sorted(version_dir.glob("*.yaml")):
                    try:
                        data = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
                        version_data[f.stem] = data
                    except yaml.YAMLError as e:
                        logger.error(
                            "prompts.parse_error", file=str(f), error=str(e)
                        )
                self._cache[version_dir.name] = version_data
            logger.info(
                "prompts.reloaded",
                versions=list(self._cache.keys()),
                active=self._active_version,
            )

    def get(self, name: str, version: str | None = None) -> dict[str, Any]:
        with self._lock:
            version = version or self._active_version
            try:
                return self._cache[version][name]
            except KeyError as e:
                raise PromptNotFoundError(
                    f"prompt '{name}' not found in version '{version}'"
                ) from e

    def get_system(self, version: str | None = None) -> str:
        prompt = self.get("analyzer_system", version=version)
        return prompt.get("template", "")

    def get_user_template(self, version: str | None = None) -> str:
        prompt = self.get("analyzer_user", version=version)
        return prompt.get("template", "")

    def get_metrics_mapping(self, version: str | None = None) -> dict[str, Any]:
        return self.get("metrics_mapping", version=version)

    async def watch(self) -> None:
        """Фоновый таск: следит за изменениями YAML и перезагружает кэш."""
        self._stop_event = asyncio.Event()
        logger.info("prompts.watch.started", path=str(self.prompts_dir))
        try:
            async for changes in awatch(
                str(self.prompts_dir), stop_event=self._stop_event
            ):
                logger.info("prompts.changes_detected", count=len(changes))
                self.reload()
        except Exception as e:
            logger.error("prompts.watch.error", error=str(e))

    def stop_watch(self) -> None:
        if self._stop_event:
            self._stop_event.set()


_loader: PromptLoader | None = None


def get_prompt_loader() -> PromptLoader:
    global _loader
    if _loader is None:
        settings = get_settings()
        _loader = PromptLoader(settings.prompts_dir, settings.prompts_active_version)
    return _loader
