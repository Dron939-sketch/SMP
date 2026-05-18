from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_ALG = "HS256"


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _pwd.verify(password, hashed)


def _encode(claims: dict[str, Any], delta: timedelta) -> str:
    settings = get_settings()
    to_encode = claims.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + delta
    return jwt.encode(to_encode, settings.secret_key, algorithm=_ALG)


def create_access_token(sub: str, role: str) -> str:
    settings = get_settings()
    return _encode(
        {"sub": sub, "role": role, "typ": "access"},
        timedelta(minutes=settings.access_token_ttl_minutes),
    )


def create_refresh_token(sub: str) -> str:
    settings = get_settings()
    return _encode(
        {"sub": sub, "typ": "refresh"},
        timedelta(days=settings.refresh_token_ttl_days),
    )


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[_ALG])
    except JWTError as e:
        raise ValueError(f"invalid token: {e}") from e
