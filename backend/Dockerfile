FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app
COPY ai-prompts /app/ai-prompts
COPY question-bank /app/question-bank

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# На Render порт прокидывается через $PORT; локально дефолт 8000.
# Seed запускается «лениво» — если БД уже наполнена, операции идемпотентны.
CMD ["sh", "-c", "python -m app.seed || true; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
