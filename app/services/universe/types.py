from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from app.models import Event

DEFAULT_GALAXY_ID = UUID("00000000-0000-0000-0000-000000000001")
TABLE_PREFIX_RE = re.compile(r"^\s*([A-Za-zÀ-ž0-9 _-]{2,64})\s*:")


def normalize_table_name(name: str | None) -> str:
    text = str(name or "").strip()
    return text if text else "Uncategorized"


def derive_table_name(*, value: Any, metadata: Mapping[str, Any] | None) -> str:
    data = metadata if isinstance(metadata, Mapping) else {}

    for key in ("kategorie", "category", "typ", "type", "table", "table_name"):
        direct = data.get(key)
        if isinstance(direct, str) and direct.strip():
            return normalize_table_name(direct)

    if isinstance(value, str):
        match = TABLE_PREFIX_RE.match(value)
        if match:
            return normalize_table_name(match.group(1))

    return "Uncategorized"


def derive_table_id(*, galaxy_id: UUID, table_name: str) -> UUID:
    normalized = normalize_table_name(table_name).lower()
    return uuid5(NAMESPACE_URL, f"dataverse:{galaxy_id}:{normalized}")


def split_constellation_and_planet_name(table_name: str | None) -> tuple[str, str]:
    normalized = normalize_table_name(table_name)
    separators = (">", "/", "::", "|")
    for separator in separators:
        if separator not in normalized:
            continue
        parts = [part.strip() for part in normalized.split(separator) if part.strip()]
        if len(parts) >= 2:
            constellation = parts[0]
            planet = " / ".join(parts[1:])
            return constellation, planet
    return normalized, normalized


@dataclass
class ProjectedAsteroid:
    id: UUID
    value: Any
    metadata: dict[str, Any]
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None
    current_event_seq: int = 0


@dataclass
class ProjectedBond:
    id: UUID
    source_id: UUID
    target_id: UUID
    type: str
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None
    current_event_seq: int = 0


class ProjectionPayloadError(ValueError):
    def __init__(self, *, event: Event, reason: str) -> None:
        self.event = event
        self.reason = reason
        super().__init__(reason)
