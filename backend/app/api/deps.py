import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.database import get_db
from app.models.user import User, UserRole

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Annotated[str | None, Depends(oauth2)],
) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing token")
    try:
        claims = decode_token(token)
    except ValueError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e
    if claims.get("typ") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "expected access token")
    try:
        uid = uuid.UUID(claims["sub"])
    except (KeyError, ValueError) as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid sub") from e
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user disabled")
    return user


def require_roles(*roles: UserRole):
    async def _check(user: Annotated[User, Depends(get_optional_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "forbidden")
        return user

    return _check


# Демо-режим: если токена нет/невалидный — возвращаем синтетического
# замполита, чтобы дашборд и ассистент работали без логина.
_DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-00000000beef")


def _demo_user() -> User:
    u = User(
        id=_DEMO_USER_ID,
        email="demo@smp.team",
        hashed_password="",
        role=UserRole.POLITICAL_OFFICER,
        full_name="Демо Замполит",
        position="Замполит",
        consent_given=True,
        is_active=True,
    )
    return u


async def get_optional_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Annotated[str | None, Depends(oauth2)],
) -> User:
    if not token:
        return _demo_user()
    try:
        claims = decode_token(token)
        uid = uuid.UUID(claims["sub"])
    except (ValueError, KeyError):
        return _demo_user()
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    return user if user and user.is_active else _demo_user()
