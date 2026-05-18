# Развёртывание

## Render (одной кнопкой)

В репозитории лежит `render.yaml` (Blueprint). В Render Dashboard:
1. **New → Blueprint** → подключить репозиторий `Dron939-sketch/SMP`.
2. Render создаст 4 ресурса: managed Postgres, Redis, backend (Docker)
   и frontend (Static).
3. В свежесозданном backend-сервисе → **Environment** → задать секреты
   (`DEEPSEEK_API_KEY`, `FISH_AUDIO_API_KEY`, `FISH_AUDIO_VOICE_ID`,
   `DEEPGRAM_API_KEY`, `TAVILY_API_KEY`, `VK_SERVICE_TOKEN` и т.д.) —
   они помечены `sync: false` и не лежат в репо.
4. После первого деплоя backend сам выполнит `python -m app.seed` →
   создадутся демо-учётки (см. ниже).

Если деплой падает с `could not find Cargo.toml` — Render по ошибке
выбрал Rust-runtime. Убедитесь, что в Dashboard выбран блюпринт
(`render.yaml`), а не дефолтный «Rust web service».

## Локально
```bash
cp .env.example .env  # заполнить DEEPSEEK_API_KEY, FISH_AUDIO_*, VK_SERVICE_TOKEN
docker compose up -d
docker compose exec backend python -m app.seed   # одноразовый seed
```

- backend  → http://localhost:8000/api/docs
- frontend → http://localhost:5173

## Демо-учётки (после seed)
| Роль                | Email              | Пароль       |
|---------------------|--------------------|--------------|
| Замполит (Зорин)    | zorin@smp.team    | zorin12345   |
| Админ               | admin@smp.team    | admin12345   |
| Менеджер участка    | manager@smp.team  | manager12345 |
| Сотрудник (e1..e6)  | e1@smp.team       | employee123  |

## Прод
- Postgres 15+ managed (RDS/Yandex Managed/etc.).
- Redis 7+ для кэша и Celery.
- Backend и frontend — Docker-образы из GHCR (см. `.github/workflows/ci.yml`).
- TLS обязательно (nginx или managed ingress).
- Секреты — в Vault / GitHub Secrets / Yandex Lockbox.
- Sentry DSN для error tracking.

## Голос
- TTS: Fish Audio (server-side proxy). Не нужно передавать ключ на фронт.
- STT: Deepgram (server-side proxy) или браузерный SpeechRecognition.
- В Safari/Firefox SpeechRecognition отсутствует — используется Deepgram.

## Сайд-эффекты
- VK-парсер: один запрос раз в `VK_CACHE_TTL_MINUTES` минут.
- Advisor: кэш на 30 минут по хешу метрик + VK-агрегата.
- LLM-кэш: 24 часа по хешу ответов (если те же ответы повторно
  отправлены, новый запрос к DeepSeek не делается).
