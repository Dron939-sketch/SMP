"""Инициализация БД: схема + базовые данные.

Запуск: `python -m app.seed` из контейнера backend (или `make seed`).

Что создаём:
  - админ;
  - замполит Зорин Илья (роль POLITICAL_OFFICER, компания СпецМонтажПроект);
  - один менеджер и десяток тестовых сотрудников по разным участкам;
  - 16 замаскированных вопросов из question-bank/camouflaged_questions.yaml;
  - 5 шаблонов тестов из question-bank/tests.yaml.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import structlog
import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import get_settings
from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models.test import Question, QuestionType, Test
from app.models.user import User, UserRole

logger = structlog.get_logger(__name__)


def _question_bank_root() -> Path:
    here = Path(__file__).resolve().parent
    candidates = [
        Path("/app/question-bank"),
        here.parent.parent / "question-bank",
        Path.cwd() / "question-bank",
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError("question-bank not found")


async def _create_schema(eng: AsyncEngine) -> None:
    from sqlalchemy import text

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Дозаливка колонок, которые добавились после первого деплоя
        # (create_all не делает ALTER TABLE на существующих таблицах).
        await conn.execute(
            text("ALTER TABLE tests ADD COLUMN IF NOT EXISTS real_focus TEXT")
        )
        await conn.execute(
            text(
                "ALTER TABLE test_responses ADD COLUMN IF NOT EXISTS "
                "respondent_name VARCHAR(255)"
            )
        )


async def _ensure_user(
    session,
    *,
    email,
    password,
    role,
    full_name,
    department=None,
    site=None,
    position=None,
    force_password_reset=False,
):
    existing = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if existing:
        if force_password_reset:
            existing.hashed_password = hash_password(password)
            existing.is_active = True
            existing.consent_given = True
            await session.flush()
            logger.info("seed.user.password_reset", email=email)
        return existing
    logger.info("seed.user.create", email=email, role=role.value)
    user = User(
        email=email,
        hashed_password=hash_password(password),
        role=role,
        full_name=full_name,
        department=department,
        site=site,
        position=position,
        consent_given=True,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def _migrate_legacy_emails(session) -> None:
    """Старые сиды использовали @smp.local (RFC-зарезервированный домен,
    email-validator его отклоняет). Меняем на @smp.team. Устойчиво к
    коллизиям: если такой @smp.team уже есть — удаляем legacy-копию,
    иначе UNIQUE-констрейнт уронил бы весь seed.
    """
    legacy = (
        await session.execute(select(User).where(User.email.like("%@smp.local")))
    ).scalars().all()
    if not legacy:
        return
    for u in legacy:
        local = u.email.split("@", 1)[0]
        new_email = f"{local}@smp.team"
        target = (
            await session.execute(select(User).where(User.email == new_email))
        ).scalar_one_or_none()
        if target and target.id != u.id:
            logger.info("seed.migrate.delete_legacy_duplicate", email=u.email)
            await session.delete(u)
        else:
            u.email = new_email
            logger.info("seed.migrate.renamed", from_=u.email, to=new_email)
    await session.flush()


async def _seed_users(session) -> None:
    from app.api.deps import ZAMPOLIT_USER_ID

    await _migrate_legacy_emails(session)

    # Гарантированный замполит с фиксированным UUID — используется
    # при отсутствии JWT (FK всегда валиден).
    existing = (
        await session.execute(select(User).where(User.id == ZAMPOLIT_USER_ID))
    ).scalar_one_or_none()
    if not existing:
        session.add(
            User(
                id=ZAMPOLIT_USER_ID,
                email="zorin@smp.team",
                hashed_password=hash_password("zorin"),
                role=UserRole.POLITICAL_OFFICER,
                full_name="Зорин Илья",
                position="Замполит",
                consent_given=True,
                is_active=True,
            )
        )
        await session.flush()

    # Резервная учётка быстрого входа 123 / 123 (для проверки логина).
    await _ensure_user(
        session,
        email="123@smp.team",
        password="123",
        role=UserRole.POLITICAL_OFFICER,
        full_name="Зорин Илья",
        position="Замполит",
    )
    await _ensure_user(
        session,
        email="admin@smp.team",
        password="admin12345",
        role=UserRole.ADMIN,
        full_name="Системный администратор",
    )
    await _ensure_user(
        session,
        email="zorin@smp.team",
        password="zorin12345",
        role=UserRole.POLITICAL_OFFICER,
        full_name="Илья Зорин",
        position="Замполит",
    )
    await _ensure_user(
        session,
        email="manager@smp.team",
        password="manager12345",
        role=UserRole.MANAGER,
        full_name="Сергей Иванов",
        department="СМР",
        site="Участок №2",
        position="Начальник участка",
    )
    sample_employees = [
        ("e1@smp.team", "Михаил Петров", "СМР", "Участок №1", "Прораб"),
        ("e2@smp.team", "Анна Смирнова", "ПТО", "Офис",        "Инженер ПТО"),
        ("e3@smp.team", "Дмитрий Ким",   "СМР", "Участок №2", "Мастер"),
        ("e4@smp.team", "Ольга Новикова","HR",  "Офис",        "Специалист HR"),
        ("e5@smp.team", "Алексей Грин",  "ОТиТБ","Участок №1","Инженер ОТ"),
        ("e6@smp.team", "Иван Соколов",  "СМР", "Участок №3", "Бригадир"),
    ]
    for email, name, dept, site, pos in sample_employees:
        await _ensure_user(
            session,
            email=email,
            password="employee123",
            role=UserRole.EMPLOYEE,
            full_name=name,
            department=dept,
            site=site,
            position=pos,
        )


def _expected_test_titles() -> list[str]:
    """Список title тестов из tests.yaml — для self-heal сравнения с БД."""
    try:
        root = _question_bank_root()
        templates = yaml.safe_load((root / "tests.yaml").read_text("utf-8"))
        return [t["title"] for t in templates.get("tests", [])]
    except Exception:
        return []


async def _seed_tests(session) -> None:
    root = _question_bank_root()
    bank = yaml.safe_load((root / "camouflaged_questions.yaml").read_text("utf-8"))
    templates = yaml.safe_load((root / "tests.yaml").read_text("utf-8"))

    bank_by_code = {q["code"]: q for q in bank["questions"]}

    for tpl in templates["tests"]:
        cover = tpl.get("cover_story") or tpl.get("description")
        focus = tpl.get("real_focus")
        existing = (
            await session.execute(select(Test).where(Test.title == tpl["title"]))
        ).scalar_one_or_none()
        if existing:
            # Обновляем описания при изменении YAML (на старых записях
            # real_focus может быть NULL — досыпаем).
            updated = False
            if cover and existing.description != cover:
                existing.description = cover
                updated = True
            if focus and existing.real_focus != focus:
                existing.real_focus = focus
                updated = True
            if updated:
                await session.flush()
                logger.info("seed.test.refreshed", title=tpl["title"])
            else:
                logger.info("seed.test.skip", title=tpl["title"])
            continue

        test = Test(
            title=tpl["title"],
            description=cover,
            real_focus=focus,
            cycle=tpl.get("cycle", "monthly"),
            time_limit_seconds=tpl.get("time_limit_seconds"),
            is_active=True,
        )
        session.add(test)
        await session.flush()

        for idx, code in enumerate(tpl["question_codes"]):
            src = bank_by_code.get(code)
            if not src:
                logger.warning("seed.test.unknown_code", code=code, test=tpl["title"])
                continue
            session.add(
                Question(
                    test_id=test.id,
                    code=src["code"],
                    display_text=src["display_text"],
                    question_type=QuestionType(src["type"]),
                    options={"choices": src["options"]} if src.get("options") else None,
                    order_index=idx,
                    is_required=True,
                    hidden_metrics=src.get("hidden_metrics", {}),
                    reverse_scored=src.get("reverse_scored", False),
                )
            )
        logger.info("seed.test.created", title=tpl["title"])


async def run() -> None:
    settings = get_settings()
    logger.info("seed.start", db=settings.database_url.split("@")[-1])
    await _create_schema(engine)
    async with SessionLocal() as session:
        await _seed_users(session)
        await _seed_tests(session)
        await session.commit()
    logger.info("seed.done")


if __name__ == "__main__":
    asyncio.run(run())
