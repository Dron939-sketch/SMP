from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="ENVIRONMENT")
    app_name: str = "BuildPulse"
    app_version: str = "0.1.0"
    api_url: str = "http://localhost:8000"
    app_url: str = "http://localhost:5173"
    secret_key: str = "change-me"
    admin_token: str = ""
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 14
    # MAX_TOKEN в окружении хостинга используется как auth-токен (строка),
    # поэтому наш «макс. токенов LLM» — отдельный alias LLM_MAX_TOKENS.
    llm_max_tokens: int = Field(default=2048, alias="LLM_MAX_TOKENS")

    database_url: str = "postgresql+psycopg://buildpulse:buildpulse@postgres:5432/buildpulse"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    ai_provider: str = "deepseek"
    ai_model: str = "deepseek-chat"
    ai_timeout_seconds: float = 12.0
    ai_max_retries: int = 2
    ai_cache_ttl_hours: int = 24
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    ollama_base_url: str = "http://ollama:11434"

    assistant_name: str = "Джарвис"
    assistant_greeting: str = (
        "Привет, командор! Меня зовут Джарвис — твой персональный помощник. "
        "Можешь задать вопрос голосом или написать в поисковике."
    )
    assistant_model: str = "deepseek-chat"
    assistant_voice_lang: str = "ru-RU"

    prompts_dir: Path = Path("/app/ai-prompts")
    prompts_active_version: str = "v1.1"
    prompts_hot_reload: bool = True

    alert_stress_threshold: float = 4.2
    alert_safety_threshold: float = 3.0
    alert_webhook_url: str = ""

    vk_api_version: str = "5.199"
    vk_service_token: str = ""
    vk_group_domain: str = "specmontazhproekt"
    vk_posts_limit: int = 30
    vk_cache_ttl_minutes: int = 30

    advisor_enabled: bool = True
    advisor_model: str = "deepseek-chat"

    fish_audio_api_key: str = ""
    fish_audio_voice_id: str = ""
    fish_audio_base_url: str = "https://api.fish.audio"
    fish_audio_model: str = "speech-1.6"
    deepgram_api_key: str = ""
    vad_mode: int = 2

    hume_api_key: str = ""
    tavily_api_key: str = ""
    openweather_api_key: str = ""
    yandex_api_key: str = ""

    vk_user_token: str = ""

    telegram_token: str = ""
    email_smtp_host: str = ""
    email_smtp_port: int = 587
    email_smtp_user: str = ""
    email_smtp_pass: str = ""
    email_from: str = ""
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_contact: str = ""

    sentry_dsn: str = ""
    log_level: str = "INFO"
    log_format: str = "json"

    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
