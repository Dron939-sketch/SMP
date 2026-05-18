# Управление промтами

Промты лежат в `ai-prompts/<version>/`. Загружаются `PromptLoader`
(`app/services/prompt_loader.py`) и **горячо** перезагружаются через
`watchfiles` при изменении любого `*.yaml`.

## Структура версии

```
ai-prompts/v1.1/
  analyzer_system.yaml   # системный промт для /api/ai/analyze
  analyzer_user.yaml     # шаблон пользовательской части
  metrics_mapping.yaml   # коды Q_* → скрытые метрики и веса
```

## Переключение версии

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/prompts/reload?version=v1.0"
```

Активная версия сохраняется в каждой записи `AnalysisResult.prompt_version`
— это и есть A/B-разметка для последующего сравнения качества.

## Создание новой версии

1. `cp -r ai-prompts/v1.1 ai-prompts/v1.2`
2. Редактируем YAML, коммитим.
3. Loader подхватит автоматически (если `PROMPTS_HOT_RELOAD=true`),
   либо вручную: `POST /api/prompts/reload?version=v1.2`.
4. Откат — `POST /api/prompts/reload?version=v1.1`.

## Контракт ответа LLM

`AIAnalysisResult` (`app/schemas/ai.py`). При невалидном JSON или
неполной схеме сервис автоматически фолбэчит на детерминированный
mock-провайдер, чтобы дашборд не падал.
