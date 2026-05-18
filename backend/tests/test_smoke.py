"""Минимальные smoke-тесты ядра без сетевых вызовов и БД."""

import pytest

from app.schemas.ai import AIAnalysisResult, AIAnalyzeRequest, AIAnswerItem
from app.services.ai_providers import MockProvider
from app.services.ai_service import AIService
from app.services.prompt_loader import PromptLoader


@pytest.mark.asyncio
async def test_mock_provider_returns_valid_schema():
    raw = await MockProvider().complete_json(
        "system", "user prompt", model="mock", timeout=1
    )
    raw["prompt_version"] = "v1.1"
    raw["ai_model"] = "mock"
    parsed = AIAnalysisResult(**raw)
    assert 0 <= parsed.score_metrics.stress_index <= 5
    assert parsed.anchor_engine in {"engine", "neutral", "anchor", "anchor_pretender"}
    assert 0 <= parsed.anchor_engine_confidence <= 1


def test_prompt_loader_reads_packaged_prompts(tmp_path, monkeypatch):
    # build minimal in-memory prompt tree
    v = tmp_path / "v1.0"
    v.mkdir()
    (v / "analyzer_system.yaml").write_text(
        "template: 'sys'\n", encoding="utf-8"
    )
    (v / "analyzer_user.yaml").write_text(
        "template: 'user {{role}}'\n", encoding="utf-8"
    )
    (v / "metrics_mapping.yaml").write_text(
        "metrics: {stress_index: 's'}\n", encoding="utf-8"
    )

    loader = PromptLoader(tmp_path, "v1.0")
    assert loader.active_version == "v1.0"
    assert "v1.0" in loader.available_versions()
    assert loader.get_system() == "sys"
    assert "user " in loader.get_user_template()


@pytest.mark.asyncio
async def test_ai_service_end_to_end_with_mock(tmp_path, monkeypatch):
    v = tmp_path / "v1.0"
    v.mkdir()
    (v / "analyzer_system.yaml").write_text("template: 'sys'\n", encoding="utf-8")
    (v / "analyzer_user.yaml").write_text(
        "template: '{{role}} {{cycle_tag}} {{answers}}'\n",
        encoding="utf-8",
    )
    (v / "metrics_mapping.yaml").write_text("metrics: {}\n", encoding="utf-8")

    loader = PromptLoader(tmp_path, "v1.0")
    service = AIService(provider=MockProvider(), prompt_loader=loader)

    req = AIAnalyzeRequest(
        employee_id="00000000-0000-0000-0000-000000000001",
        role="employee",
        cycle_tag="2026-Q2",
        answers=[
            AIAnswerItem(question_id="q1", code="Q_BREAK_HABITS", value=4),
            AIAnswerItem(
                question_id="q2",
                code="Q_FRIEND_PITCH",
                value=None,
                text="Норм, надёжная компания",
            ),
        ],
    )
    result = await service.analyze(req)
    assert result.prompt_version == "v1.0"
    assert result.summary_text
    assert isinstance(result.risk_flags, list)
