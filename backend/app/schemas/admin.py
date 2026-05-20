from typing import Any

from pydantic import BaseModel


class AppSettingUpdate(BaseModel):
    value: Any


class ResetReport(BaseModel):
    deleted: dict[str, int]
