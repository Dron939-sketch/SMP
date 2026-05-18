"""Эндпоинты ИИ-ассистента «Джарвис».

- GET  /greeting        — приветственная фраза при входе в дашборд
- POST /ask             — текстовый/распознанный вопрос → текстовый ответ
- POST /speak           — текст → mp3 через Fish Audio (озвучка ответа)
- POST /listen          — wav/webm → текст через Deepgram (если STT)
- POST /ask-and-speak   — комбо: вопрос → ответ + сразу mp3 (для голосового режима)
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole
from app.services.assistant_service import AssistantService
from app.services.report_service import build_dashboard_payload
from app.services.voice_service import (
    STTUnavailable,
    TTSUnavailable,
    synthesize_fish_audio,
    tavily_search,
    transcribe_deepgram,
)

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

_ASSISTANT_ROLES = require_roles(
    UserRole.ADMIN,
    UserRole.EXECUTIVE,
    UserRole.POLITICAL_OFFICER,
    UserRole.MANAGER,
)


class GreetingResponse(BaseModel):
    name: str
    text: str
    voice_lang: str
    voice_id: str | None = None
    tts_provider: str
    stt_provider: str


class AssistantMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list[AssistantMessage] = Field(default_factory=list, max_length=20)
    include_dashboard_context: bool = True
    enable_web_search: bool = False
    cycle_tag: str | None = None


class AskResponse(BaseModel):
    answer: str
    voice_lang: str
    used_context: bool
    sources: list[dict[str, str]] = Field(default_factory=list)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice_id: str | None = None


@router.get("/greeting", response_model=GreetingResponse)
async def greeting(user: Annotated[User, Depends(_ASSISTANT_ROLES)]):
    s = get_settings()
    name_part = user.full_name.split()[0] if user.full_name else "командор"
    text = (
        f"Привет, {name_part}! Меня зовут {s.assistant_name}. "
        "Я твой персональный помощник. Можешь задать вопрос голосом — "
        "нажми микрофон, или просто напиши в поисковике. Я подключён к "
        "DeepSeek и вижу текущие метрики компании."
    )
    return GreetingResponse(
        name=s.assistant_name,
        text=text,
        voice_lang=s.assistant_voice_lang,
        voice_id=s.fish_audio_voice_id or None,
        tts_provider="fish_audio" if s.fish_audio_api_key else "browser",
        stt_provider="deepgram" if s.deepgram_api_key else "browser",
    )


async def _build_context(
    db: AsyncSession,
    payload: AskRequest,
) -> tuple[dict[str, Any] | None, list[dict[str, str]]]:
    context: dict[str, Any] | None = None
    if payload.include_dashboard_context:
        context = await build_dashboard_payload(db, cycle_tag=payload.cycle_tag)
    sources: list[dict[str, str]] = []
    if payload.enable_web_search:
        sources = await tavily_search(payload.question, max_results=4)
        if sources and context is not None:
            context = {**context, "web_search": sources}
    return context, sources


@router.post("/ask", response_model=AskResponse)
async def ask(
    payload: AskRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_ASSISTANT_ROLES)],
):
    context, sources = await _build_context(db, payload)
    answer = await AssistantService().ask(
        payload.question,
        history=[m.model_dump() for m in payload.history],
        context=context,
    )
    return AskResponse(
        answer=answer,
        voice_lang=get_settings().assistant_voice_lang,
        used_context=context is not None,
        sources=sources,
    )


@router.post("/speak")
async def speak(
    payload: SpeakRequest,
    user: Annotated[User, Depends(_ASSISTANT_ROLES)],
):
    try:
        audio = await synthesize_fish_audio(payload.text, voice_id=payload.voice_id)
    except TTSUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return Response(content=audio, media_type="audio/mpeg")


@router.post("/ask-and-speak")
async def ask_and_speak(
    payload: AskRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(_ASSISTANT_ROLES)],
):
    context, _ = await _build_context(db, payload)
    answer = await AssistantService().ask(
        payload.question,
        history=[m.model_dump() for m in payload.history],
        context=context,
    )
    try:
        audio = await synthesize_fish_audio(answer)
    except TTSUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return StreamingResponse(
        iter([audio]),
        media_type="audio/mpeg",
        headers={"X-Assistant-Answer": _encode_header(answer)},
    )


@router.post("/listen")
async def listen(
    user: Annotated[User, Depends(_ASSISTANT_ROLES)],
    audio: UploadFile = File(...),
    language: str = "ru",
):
    raw = await audio.read()
    try:
        transcript = await transcribe_deepgram(
            raw,
            mimetype=audio.content_type or "audio/webm",
            language=language,
        )
    except STTUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return {"transcript": transcript}


def _encode_header(value: str) -> str:
    """HTTP-заголовки не любят non-latin — кодируем в utf-8 base64-like."""
    import base64

    return base64.b64encode(value.encode("utf-8")).decode("ascii")
