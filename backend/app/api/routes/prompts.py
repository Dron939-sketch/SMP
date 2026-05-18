from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import require_roles
from app.models.user import User, UserRole
from app.services.prompt_loader import PromptNotFoundError, get_prompt_loader

router = APIRouter(prefix="/api/prompts", tags=["prompts"])

_ADMIN = require_roles(UserRole.ADMIN, UserRole.EXECUTIVE)


@router.get("/versions")
async def versions(user: Annotated[User, Depends(_ADMIN)]):
    loader = get_prompt_loader()
    return {"active": loader.active_version, "available": loader.available_versions()}


@router.post("/reload")
async def reload_prompts(
    user: Annotated[User, Depends(_ADMIN)],
    version: str | None = Query(default=None),
):
    loader = get_prompt_loader()
    loader.reload()
    if version:
        try:
            loader.set_active_version(version)
        except PromptNotFoundError as e:
            raise HTTPException(404, str(e)) from e
    return {"active": loader.active_version, "available": loader.available_versions()}


@router.get("/{name}")
async def get_prompt(
    name: str,
    user: Annotated[User, Depends(_ADMIN)],
    version: str | None = Query(default=None),
):
    loader = get_prompt_loader()
    try:
        return loader.get(name, version=version)
    except PromptNotFoundError as e:
        raise HTTPException(404, str(e)) from e
