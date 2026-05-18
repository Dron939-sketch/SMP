"""Парсер VK-страницы компании СпецМонтажПроект.

Использует официальный VK API через service-token. Кэшируется в памяти
на N минут — для дашборда достаточно. Если ключа нет — отдаёт пустой
снимок с пометкой `enabled=false`, чтобы фронт не падал.
"""

from __future__ import annotations

import time
from typing import Any

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)

_cache: dict[str, tuple[float, dict[str, Any]]] = {}


async def fetch_group_snapshot() -> dict[str, Any]:
    s = get_settings()
    cache_key = f"vk:{s.vk_group_domain}:{s.vk_posts_limit}"
    if cached := _cache.get(cache_key):
        ts, payload = cached
        if time.time() - ts < s.vk_cache_ttl_minutes * 60:
            return payload

    if not s.vk_service_token:
        snapshot = {
            "enabled": False,
            "reason": "VK_SERVICE_TOKEN не задан",
            "domain": s.vk_group_domain,
            "group": None,
            "posts": [],
        }
        _cache[cache_key] = (time.time(), snapshot)
        return snapshot

    async with httpx.AsyncClient(timeout=8) as client:
        group_resp = await client.get(
            "https://api.vk.com/method/groups.getById",
            params={
                "group_id": s.vk_group_domain,
                "fields": "members_count,description,activity,status,site,verified",
                "access_token": s.vk_service_token,
                "v": s.vk_api_version,
            },
        )
        wall_resp = await client.get(
            "https://api.vk.com/method/wall.get",
            params={
                "domain": s.vk_group_domain,
                "count": s.vk_posts_limit,
                "filter": "owner",
                "access_token": s.vk_service_token,
                "v": s.vk_api_version,
            },
        )

    try:
        group = (group_resp.json().get("response", {}).get("groups", [None]) or [None])[0]
    except (KeyError, ValueError):
        group = None
    try:
        items = wall_resp.json().get("response", {}).get("items", [])
    except (KeyError, ValueError):
        items = []

    posts = [
        {
            "id": p.get("id"),
            "date": p.get("date"),
            "text": (p.get("text") or "")[:1200],
            "likes": (p.get("likes") or {}).get("count", 0),
            "reposts": (p.get("reposts") or {}).get("count", 0),
            "comments": (p.get("comments") or {}).get("count", 0),
            "views": (p.get("views") or {}).get("count", 0),
            "has_image": any(a.get("type") == "photo" for a in p.get("attachments", []) or []),
        }
        for p in items
        if not p.get("marked_as_ads")
    ]

    snapshot = {
        "enabled": True,
        "domain": s.vk_group_domain,
        "group": group,
        "posts": posts,
        "aggregate": _aggregate(posts),
    }
    _cache[cache_key] = (time.time(), snapshot)
    return snapshot


def _aggregate(posts: list[dict[str, Any]]) -> dict[str, Any]:
    if not posts:
        return {"posts": 0}
    likes = [p["likes"] for p in posts]
    views = [p["views"] for p in posts if p.get("views")]
    return {
        "posts": len(posts),
        "avg_likes": round(sum(likes) / len(likes), 1),
        "max_likes": max(likes),
        "avg_views": round(sum(views) / len(views), 1) if views else None,
        "image_share": round(sum(1 for p in posts if p["has_image"]) / len(posts), 2),
    }
