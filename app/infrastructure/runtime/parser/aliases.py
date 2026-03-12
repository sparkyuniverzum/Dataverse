from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.parser.lexicon_cz import RESERVED_TERMS, build_parser_lexicon_payload
from app.models import Event

SCOPE_PERSONAL = "personal"
SCOPE_WORKSPACE = "workspace"
ALLOWED_SCOPE_TYPES = {SCOPE_PERSONAL, SCOPE_WORKSPACE}
ALIAS_EVENT_REGISTERED = "ALIAS_REGISTERED"
ALIAS_EVENT_UPDATED = "ALIAS_UPDATED"
ALIAS_EVENT_DEPRECATED = "ALIAS_DEPRECATED"
ALIAS_EVENT_TYPES = (ALIAS_EVENT_REGISTERED, ALIAS_EVENT_UPDATED, ALIAS_EVENT_DEPRECATED)
ONTOLOGY_BLOCKED_TERMS = {"mesic", "měsíc", "moon", "moons"}
CANONICAL_RUNTIME_PREFIX_OVERRIDES: dict[str, str] = {
    # Canonical CZ term stays in UX/docs, parser runtime still understands legacy selector verbs.
    "vyber": "show",
}


@dataclass(frozen=True)
class ParserAliasRecord:
    alias_id: UUID
    scope_type: str
    galaxy_id: UUID
    owner_user_id: UUID | None
    alias_phrase: str
    canonical_command: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    version: int

    @property
    def alias_phrase_normalized(self) -> str:
        return normalize_phrase(self.alias_phrase)


@dataclass(frozen=True)
class ParserAliasResolution:
    resolved_command: str
    alias_used: bool
    alias_id: UUID | None = None
    alias_phrase: str | None = None
    alias_scope_type: str | None = None
    alias_version: int | None = None


def normalize_phrase(value: str) -> str:
    text = " ".join(str(value or "").strip().split())
    return text.casefold()


def _coerce_uuid(value: Any) -> UUID | None:
    if isinstance(value, UUID):
        return value
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return UUID(raw)
    except (ValueError, TypeError):
        return None


def _coerce_bool(value: Any, *, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
    return default


def _coerce_int(value: Any, *, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parser_alias_conflict(reason: str, message: str, *, context: dict[str, Any] | None = None) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "PARSER_ALIAS_CONFLICT",
            "reason": reason,
            "message": message,
            "context": context or {},
        },
    )


def _parser_alias_validation_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail={
            "code": "PARSER_ALIAS_VALIDATION_ERROR",
            "message": message,
        },
    )


@lru_cache(maxsize=1)
def canonical_command_map() -> dict[str, str]:
    payload = build_parser_lexicon_payload()
    mapping: dict[str, str] = {}
    for item in list(payload.get("commands") or []):
        if not isinstance(item, dict):
            continue
        key = normalize_phrase(str(item.get("key") or ""))
        syntax = " ".join(str(item.get("syntax") or "").strip().split())
        syntax_prefix = syntax.split("<", 1)[0].strip()
        canonical_prefix = syntax_prefix or syntax
        if key and canonical_prefix:
            mapping[key] = canonical_prefix
        if canonical_prefix:
            mapping[normalize_phrase(canonical_prefix)] = canonical_prefix
        for alias in list(item.get("aliases") or []):
            alias_key = normalize_phrase(str(alias))
            if alias_key and canonical_prefix:
                mapping[alias_key] = canonical_prefix
    return mapping


@lru_cache(maxsize=1)
def reserved_alias_terms() -> set[str]:
    reserved = {normalize_phrase(item) for item in RESERVED_TERMS}
    for canonical_key in canonical_command_map():
        if canonical_key:
            reserved.add(canonical_key)
    return reserved


def resolve_canonical_command(raw: str) -> str:
    normalized = normalize_phrase(raw)
    if not normalized:
        raise _parser_alias_validation_error("`canonical_command` must not be empty.")
    resolved = canonical_command_map().get(normalized)
    if not resolved:
        raise _parser_alias_validation_error("`canonical_command` is not part of parser lexicon.")
    return resolved


def validate_alias_phrase(raw: str) -> str:
    phrase = " ".join(str(raw or "").strip().split())
    normalized = normalize_phrase(phrase)
    if not normalized:
        raise _parser_alias_validation_error("`alias_phrase` must not be empty.")
    if len(phrase) > 120:
        raise _parser_alias_validation_error("`alias_phrase` must be <= 120 chars.")
    terms = set(re.findall(r"[a-zA-Z0-9_á-ž]+", normalized))
    if terms.intersection(ONTOLOGY_BLOCKED_TERMS):
        raise _parser_alias_conflict(
            "ONTOLOGY_CONFLICT",
            "Alias phrase cannot redefine ontology terms (moon/civilization boundary).",
            context={"alias_phrase": phrase},
        )
    if normalized in reserved_alias_terms():
        raise _parser_alias_conflict(
            "RESERVED_TERM",
            "Alias phrase collides with reserved canonical terminology.",
            context={"alias_phrase": phrase},
        )
    return phrase


def _same_scope(record: ParserAliasRecord, *, scope_type: str, owner_user_id: UUID | None) -> bool:
    if record.scope_type != scope_type:
        return False
    if scope_type == SCOPE_PERSONAL:
        return record.owner_user_id == owner_user_id
    return True


def _find_active_duplicate(
    records: list[ParserAliasRecord],
    *,
    scope_type: str,
    owner_user_id: UUID | None,
    alias_phrase: str,
    exclude_alias_id: UUID | None = None,
) -> ParserAliasRecord | None:
    target = normalize_phrase(alias_phrase)
    for record in records:
        if exclude_alias_id is not None and record.alias_id == exclude_alias_id:
            continue
        if not record.is_active:
            continue
        if not _same_scope(record, scope_type=scope_type, owner_user_id=owner_user_id):
            continue
        if record.alias_phrase_normalized == target:
            return record
    return None


def _is_alias_match(command: str, alias_phrase: str) -> bool:
    command_cmp = command.casefold()
    phrase_cmp = alias_phrase.casefold()
    if command_cmp == phrase_cmp:
        return True
    if not command_cmp.startswith(phrase_cmp):
        return False
    if len(command_cmp) == len(phrase_cmp):
        return True
    boundary = command[len(alias_phrase) : len(alias_phrase) + 1]
    return boundary in {" ", ":"}


def _apply_alias(command: str, *, alias_phrase: str, canonical_command: str) -> str:
    if not _is_alias_match(command, alias_phrase):
        return command
    rest = command[len(alias_phrase) :]
    if not rest:
        return canonical_command
    if rest.startswith(":"):
        if canonical_command.endswith(":"):
            return f"{canonical_command}{rest[1:]}"
        return f"{canonical_command}:{rest[1:]}"
    return f"{canonical_command}{rest}"


def to_runtime_command(command: str) -> str:
    normalized_command = " ".join(str(command or "").strip().split())
    if not normalized_command:
        return normalized_command
    for canonical_prefix, runtime_prefix in CANONICAL_RUNTIME_PREFIX_OVERRIDES.items():
        if _is_alias_match(normalized_command, canonical_prefix):
            return _apply_alias(
                normalized_command,
                alias_phrase=canonical_prefix,
                canonical_command=runtime_prefix,
            )
    return normalized_command


async def list_parser_aliases_for_galaxy(
    *,
    session: AsyncSession,
    galaxy_id: UUID,
) -> list[ParserAliasRecord]:
    stmt = (
        select(Event)
        .where(
            Event.galaxy_id == galaxy_id,
            Event.branch_id.is_(None),
            Event.event_type.in_(ALIAS_EVENT_TYPES),
        )
        .order_by(Event.event_seq.asc())
    )
    events = list((await session.execute(stmt)).scalars().all())
    projected: dict[UUID, ParserAliasRecord] = {}
    for event in events:
        payload = event.payload if isinstance(event.payload, dict) else {}
        alias_id = _coerce_uuid(payload.get("alias_id")) or event.entity_id
        scope_type = str(payload.get("scope_type") or "").strip().lower()
        if scope_type not in ALLOWED_SCOPE_TYPES:
            continue
        current = projected.get(alias_id)
        owner_user_id = _coerce_uuid(payload.get("owner_user_id"))
        alias_phrase = " ".join(str(payload.get("alias_phrase") or "").strip().split())
        canonical_command = " ".join(str(payload.get("canonical_command") or "").strip().split())
        if not alias_phrase or not canonical_command:
            continue
        version = _coerce_int(payload.get("version"), default=(current.version + 1 if current else 1))
        is_active_default = event.event_type != ALIAS_EVENT_DEPRECATED
        is_active = _coerce_bool(payload.get("is_active"), default=is_active_default)
        created_at = current.created_at if current is not None else event.timestamp
        projected[alias_id] = ParserAliasRecord(
            alias_id=alias_id,
            scope_type=scope_type,
            galaxy_id=_coerce_uuid(payload.get("galaxy_id")) or event.galaxy_id,
            owner_user_id=owner_user_id,
            alias_phrase=alias_phrase,
            canonical_command=canonical_command,
            is_active=is_active,
            created_at=created_at,
            updated_at=event.timestamp,
            version=version,
        )
    return sorted(projected.values(), key=lambda item: item.updated_at, reverse=True)


def select_visible_aliases(
    aliases: list[ParserAliasRecord], *, current_user_id: UUID, include_inactive: bool = True
) -> list[ParserAliasRecord]:
    visible: list[ParserAliasRecord] = []
    for alias in aliases:
        if alias.scope_type == SCOPE_PERSONAL and alias.owner_user_id != current_user_id:
            continue
        if not include_inactive and not alias.is_active:
            continue
        visible.append(alias)
    return visible


async def resolve_command_alias_for_scope(
    *,
    session: AsyncSession,
    galaxy_id: UUID,
    current_user_id: UUID,
    command: str,
) -> ParserAliasResolution:
    command_text = " ".join(str(command or "").strip().split())
    if not command_text:
        return ParserAliasResolution(resolved_command="", alias_used=False)
    aliases = await list_parser_aliases_for_galaxy(session=session, galaxy_id=galaxy_id)
    visible = select_visible_aliases(aliases, current_user_id=current_user_id, include_inactive=False)
    ordered = sorted(
        visible,
        key=lambda item: (
            0 if item.scope_type == SCOPE_PERSONAL else 1,
            -len(item.alias_phrase),
            item.alias_phrase.casefold(),
        ),
    )
    for alias in ordered:
        if not _is_alias_match(command_text, alias.alias_phrase):
            continue
        return ParserAliasResolution(
            resolved_command=_apply_alias(
                command_text,
                alias_phrase=alias.alias_phrase,
                canonical_command=alias.canonical_command,
            ),
            alias_used=True,
            alias_id=alias.alias_id,
            alias_phrase=alias.alias_phrase,
            alias_scope_type=alias.scope_type,
            alias_version=alias.version,
        )
    return ParserAliasResolution(resolved_command=command_text, alias_used=False)


async def upsert_parser_alias(
    *,
    session: AsyncSession,
    actor_user_id: UUID,
    galaxy_id: UUID,
    scope_type: str,
    alias_phrase: str,
    canonical_command: str,
    event_writer: Any,
) -> tuple[ParserAliasRecord, str]:
    normalized_scope = str(scope_type or "").strip().lower()
    if normalized_scope not in ALLOWED_SCOPE_TYPES:
        raise _parser_alias_validation_error("`scope_type` must be either 'personal' or 'workspace'.")
    resolved_phrase = validate_alias_phrase(alias_phrase)
    resolved_canonical = resolve_canonical_command(canonical_command)
    owner_user_id = actor_user_id if normalized_scope == SCOPE_PERSONAL else None

    aliases = await list_parser_aliases_for_galaxy(session=session, galaxy_id=galaxy_id)
    current = next(
        (
            item
            for item in aliases
            if _same_scope(item, scope_type=normalized_scope, owner_user_id=owner_user_id)
            and item.alias_phrase_normalized == normalize_phrase(resolved_phrase)
        ),
        None,
    )
    duplicate = _find_active_duplicate(
        aliases,
        scope_type=normalized_scope,
        owner_user_id=owner_user_id,
        alias_phrase=resolved_phrase,
        exclude_alias_id=current.alias_id if current is not None else None,
    )
    if duplicate is not None:
        raise _parser_alias_conflict(
            "DUPLICATE_ACTIVE_ALIAS",
            "Active alias with same phrase already exists in this scope.",
            context={
                "alias_id": str(duplicate.alias_id),
                "scope_type": duplicate.scope_type,
                "alias_phrase": duplicate.alias_phrase,
            },
        )
    alias_id = current.alias_id if current is not None else uuid4()
    next_version = (current.version + 1) if current is not None else 1
    event_type = ALIAS_EVENT_UPDATED if current is not None else ALIAS_EVENT_REGISTERED
    payload = {
        "alias_id": str(alias_id),
        "scope_type": normalized_scope,
        "galaxy_id": str(galaxy_id),
        "owner_user_id": str(owner_user_id) if owner_user_id else None,
        "alias_phrase": resolved_phrase,
        "canonical_command": resolved_canonical,
        "is_active": True,
        "version": next_version,
    }
    event = await event_writer(
        session=session,
        user_id=actor_user_id,
        galaxy_id=galaxy_id,
        branch_id=None,
        entity_id=alias_id,
        event_type=event_type,
        payload=payload,
    )
    return (
        ParserAliasRecord(
            alias_id=alias_id,
            scope_type=normalized_scope,
            galaxy_id=galaxy_id,
            owner_user_id=owner_user_id,
            alias_phrase=resolved_phrase,
            canonical_command=resolved_canonical,
            is_active=True,
            created_at=current.created_at if current is not None else event.timestamp,
            updated_at=event.timestamp,
            version=next_version,
        ),
        event_type,
    )


async def patch_parser_alias(
    *,
    session: AsyncSession,
    actor_user_id: UUID,
    galaxy_id: UUID,
    alias_id: UUID,
    alias_phrase: str | None,
    canonical_command: str | None,
    is_active: bool | None,
    event_writer: Any,
) -> tuple[ParserAliasRecord, str]:
    aliases = await list_parser_aliases_for_galaxy(session=session, galaxy_id=galaxy_id)
    visible = select_visible_aliases(aliases, current_user_id=actor_user_id, include_inactive=True)
    current = next((item for item in visible if item.alias_id == alias_id), None)
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PARSER_ALIAS_NOT_FOUND", "message": "Alias not found in active galaxy scope."},
        )

    next_phrase = validate_alias_phrase(alias_phrase) if alias_phrase is not None else current.alias_phrase
    next_canonical = (
        resolve_canonical_command(canonical_command) if canonical_command is not None else current.canonical_command
    )
    next_is_active = bool(current.is_active if is_active is None else is_active)
    if next_is_active:
        duplicate = _find_active_duplicate(
            aliases,
            scope_type=current.scope_type,
            owner_user_id=current.owner_user_id,
            alias_phrase=next_phrase,
            exclude_alias_id=current.alias_id,
        )
        if duplicate is not None:
            raise _parser_alias_conflict(
                "DUPLICATE_ACTIVE_ALIAS",
                "Active alias with same phrase already exists in this scope.",
                context={
                    "alias_id": str(duplicate.alias_id),
                    "scope_type": duplicate.scope_type,
                    "alias_phrase": duplicate.alias_phrase,
                },
            )

    next_version = current.version + 1
    payload = {
        "alias_id": str(current.alias_id),
        "scope_type": current.scope_type,
        "galaxy_id": str(galaxy_id),
        "owner_user_id": str(current.owner_user_id) if current.owner_user_id else None,
        "alias_phrase": next_phrase,
        "canonical_command": next_canonical,
        "is_active": next_is_active,
        "version": next_version,
    }
    event = await event_writer(
        session=session,
        user_id=actor_user_id,
        galaxy_id=galaxy_id,
        branch_id=None,
        entity_id=current.alias_id,
        event_type=ALIAS_EVENT_UPDATED,
        payload=payload,
    )
    return (
        ParserAliasRecord(
            alias_id=current.alias_id,
            scope_type=current.scope_type,
            galaxy_id=galaxy_id,
            owner_user_id=current.owner_user_id,
            alias_phrase=next_phrase,
            canonical_command=next_canonical,
            is_active=next_is_active,
            created_at=current.created_at,
            updated_at=event.timestamp,
            version=next_version,
        ),
        ALIAS_EVENT_UPDATED,
    )


async def deactivate_parser_alias(
    *,
    session: AsyncSession,
    actor_user_id: UUID,
    galaxy_id: UUID,
    alias_id: UUID,
    event_writer: Any,
) -> tuple[ParserAliasRecord, str]:
    aliases = await list_parser_aliases_for_galaxy(session=session, galaxy_id=galaxy_id)
    visible = select_visible_aliases(aliases, current_user_id=actor_user_id, include_inactive=True)
    current = next((item for item in visible if item.alias_id == alias_id), None)
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PARSER_ALIAS_NOT_FOUND", "message": "Alias not found in active galaxy scope."},
        )
    if not current.is_active:
        return current, ALIAS_EVENT_DEPRECATED

    next_version = current.version + 1
    payload = {
        "alias_id": str(current.alias_id),
        "scope_type": current.scope_type,
        "galaxy_id": str(galaxy_id),
        "owner_user_id": str(current.owner_user_id) if current.owner_user_id else None,
        "alias_phrase": current.alias_phrase,
        "canonical_command": current.canonical_command,
        "is_active": False,
        "version": next_version,
    }
    event = await event_writer(
        session=session,
        user_id=actor_user_id,
        galaxy_id=galaxy_id,
        branch_id=None,
        entity_id=current.alias_id,
        event_type=ALIAS_EVENT_DEPRECATED,
        payload=payload,
    )
    return (
        ParserAliasRecord(
            alias_id=current.alias_id,
            scope_type=current.scope_type,
            galaxy_id=galaxy_id,
            owner_user_id=current.owner_user_id,
            alias_phrase=current.alias_phrase,
            canonical_command=current.canonical_command,
            is_active=False,
            created_at=current.created_at,
            updated_at=event.timestamp,
            version=next_version,
        ),
        ALIAS_EVENT_DEPRECATED,
    )
