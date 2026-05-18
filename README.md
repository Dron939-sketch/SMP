# BuildPulse

**HR-аналитика, голосовой AI-помощник и мониторинг корпоративной атмосферы для строительной компании СпецМонтажПроект.**

BuildPulse — это веб-приложение для регулярного тестирования сотрудников с целью оценки настроения, восприятия бренда работодателя, уровня стресса и лояльности. Обработка ответов и генерация отчётов выполняется LLM-модулем (DeepSeek) с горячей перезагрузкой версионируемых промтов.

## Что внутри

- 🎭 **Замаскированные вопросы** — проективные сценарии, а не прямые опросы. См. [`docs/QUESTION_DESIGN.md`](docs/QUESTION_DESIGN.md).
- 🧠 **DeepSeek-анализ** ответов → скрытые метрики, образ компании, рекомендации.
- ⚓ **Детектор «якорей под маской двигателей»** (`anchor_pretender`) — главный сигнальный виджет замполита.
- ⏱ **Тайминг каждого вопроса** — отличает «прокликал» от «думал», флаг валидности уходит и в ИИ, и на дашборд.
- 🎤 **Джарвис** — голосовой ассистент на дашборде. TTS через **Fish Audio**, STT через **Deepgram**, веб-поиск через **Tavily**, фолбэк на браузерный SpeechAPI.
- 📊 **Дашборд замполита**: метрики по компании / отделам / участкам, тепловые срезы, anchor-карта, **«Образ компании»** (keywords + цитаты).
- 📣 **VK-парсер страницы компании** + AI-advisor с рекомендациями по контенту / продвижению / внутренней политике.
- 🔗 **Шаринг тестов по ссылке** — замполит создаёт ссылку, отдаёт в чат/Telegram, ссылка трекает использования.
- 📱 **Responsive UI + PWA**: работает на десктопе, планшетах, телефонах, в любом современном браузере (включая Safari/Firefox с фолбэками).
- 🔄 **Hot-reload промтов** + A/B версии через Git.

## Быстрый старт

```bash
cp .env.example .env
docker compose up -d
# backend: http://localhost:8000/api/docs
# frontend: http://localhost:5173
```

Пример запроса к ИИ-модулю:

```bash
curl -X POST http://localhost:8000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d @scripts/sample_payload.json
```

## Архитектура

| Слой        | Технологии                                                |
|-------------|------------------------------------------------------------|
| Frontend    | React 18 + TypeScript, Vite, Tailwind, Recharts, PWA       |
| Backend     | Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic v2, Celery   |
| БД / кэш    | PostgreSQL 15+, Redis 7                                    |
| ИИ          | Провайдер-абстракция (OpenAI, Anthropic, локальные LLM)    |
| CI/CD       | GitHub Actions → GHCR                                      |
| Мониторинг  | Prometheus, Sentry, structured JSON-логи                   |

## Структура репозитория

```
.
├── backend/             # FastAPI-приложение
│   ├── app/
│   │   ├── api/         # HTTP-роуты
│   │   ├── core/        # security, RBAC, логирование
│   │   ├── models/      # SQLAlchemy
│   │   ├── schemas/     # Pydantic
│   │   ├── services/    # AI, prompt loader, отчеты, алерты
│   │   └── workers/     # Celery
│   ├── alembic/         # Миграции
│   └── tests/           # pytest
├── frontend/            # React + Vite
├── ai-prompts/          # YAML, версионируются через Git
│   ├── v1.0/
│   └── v1.1/
├── question-bank/       # Замаскированные вопросы + mapping → метрики
├── scripts/             # Утилиты, sample-payloads
├── docs/                # Документация
└── .github/workflows/   # CI/CD
```

## Управление промтами

- Промты хранятся в `ai-prompts/<version>/*.yaml`.
- `PromptLoader` поддерживает горячую перезагрузку через `watchfiles`.
- Откат к предыдущей версии — через `POST /api/prompts/reload?version=v1.0`.
- A/B тестирование — поле `prompt_version` в каждой записи анализа.

См. [`docs/PROMPTS.md`](docs/PROMPTS.md).

## Безопасность

- ФЗ-152 / GDPR: явное согласие, право на отзыв и удаление.
- Анонимизация: менеджеры по умолчанию видят только агрегаты.
- TLS 1.3, AES-256 для БД, секреты — в `.env` / GitHub Secrets / Vault.
- JWT + refresh-токены, RBAC по ролям, аудит всех админ-действий.
- Этика: система **не используется** для увольнений и штрафов.

## Документация

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — развёртывание в проде
- [`docs/PROMPTS.md`](docs/PROMPTS.md) — управление и обновление промтов
- [`docs/QUESTION_DESIGN.md`](docs/QUESTION_DESIGN.md) — методология замаскированных вопросов
- [`docs/API.md`](docs/API.md) — описание REST-эндпоинтов
