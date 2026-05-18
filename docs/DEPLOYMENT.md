# Развёртывание

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
| Замполит (Зорин)    | zorin@smp.local    | zorin12345   |
| Админ               | admin@smp.local    | admin12345   |
| Менеджер участка    | manager@smp.local  | manager12345 |
| Сотрудник (e1..e6)  | e1@smp.local       | employee123  |

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
