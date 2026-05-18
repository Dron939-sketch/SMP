"""Голосовые сервисы.

TTS — Fish Audio (server-side proxy: фронт не светит ключ).
STT — Deepgram (опциональный fallback к браузерному SpeechRecognition).

Оба эндпоинта возвращают/принимают сырые байты, поэтому масштабируются
по запросу: ничего не пишется в БД, поток отдаётся как application/octet
(в случае Fish — audio/mpeg).
"""

from __future__ import annotations

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


class TTSUnavailable(RuntimeError):
    pass


class STTUnavailable(RuntimeError):
    pass


async def synthesize_fish_audio(text: str, *, voice_id: str | None = None) -> bytes:
    s = get_settings()
    if not s.fish_audio_api_key:
        raise TTSUnavailable("FISH_AUDIO_API_KEY не задан")

    voice = voice_id or s.fish_audio_voice_id
    payload: dict[str, object] = {
        "text": text[:5000],
        "format": "mp3",
        "mp3_bitrate": 128,
    }
    if voice:
        payload["reference_id"] = voice

    url = f"{s.fish_audio_base_url.rstrip('/')}/v1/tts"
    headers = {
        "Authorization": f"Bearer {s.fish_audio_api_key}",
        "Content-Type": "application/json",
        "Model": s.fish_audio_model,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, json=payload, headers=headers)
        if r.status_code >= 400:
            logger.error(
                "fish_audio.error",
                status=r.status_code,
                body=r.text[:200],
            )
            raise TTSUnavailable(f"Fish Audio {r.status_code}: {r.text[:200]}")
        return r.content


async def transcribe_deepgram(audio: bytes, *, mimetype: str, language: str) -> str:
    s = get_settings()
    if not s.deepgram_api_key:
        raise STTUnavailable("DEEPGRAM_API_KEY не задан")

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.deepgram.com/v1/listen",
            params={
                "model": "nova-2",
                "language": language,
                "smart_format": "true",
                "punctuate": "true",
            },
            headers={
                "Authorization": f"Token {s.deepgram_api_key}",
                "Content-Type": mimetype,
            },
            content=audio,
        )
        if r.status_code >= 400:
            raise STTUnavailable(f"Deepgram {r.status_code}: {r.text[:200]}")
        data = r.json()
        try:
            return data["results"]["channels"][0]["alternatives"][0]["transcript"]
        except (KeyError, IndexError) as e:
            raise STTUnavailable(f"unexpected Deepgram response: {e}") from e


async def tavily_search(query: str, *, max_results: int = 4) -> list[dict[str, str]]:
    s = get_settings()
    if not s.tavily_api_key:
        return []
    async with httpx.AsyncClient(timeout=12) as client:
        r = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": s.tavily_api_key,
                "query": query,
                "max_results": max_results,
                "include_answer": False,
                "search_depth": "basic",
            },
        )
        if r.status_code >= 400:
            logger.warning("tavily.error", status=r.status_code)
            return []
        return [
            {
                "title": x.get("title", ""),
                "url": x.get("url", ""),
                "snippet": (x.get("content", "") or "")[:400],
            }
            for x in r.json().get("results", [])
        ]
