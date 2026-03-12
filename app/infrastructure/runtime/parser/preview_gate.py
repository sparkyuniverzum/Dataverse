from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from jose import JWTError, jwt

DEFAULT_DEV_SECRET = "dataverse-preview-gate-dev-insecure-change-me"
PREVIEW_GATE_SECRET = (
    os.getenv("DATAVERSE_PARSER_PREVIEW_GATE_SECRET") or os.getenv("DATAVERSE_JWT_SECRET") or DEFAULT_DEV_SECRET
).strip()
PREVIEW_GATE_ALGORITHM = (os.getenv("DATAVERSE_PARSER_PREVIEW_GATE_ALGORITHM") or "HS256").strip() or "HS256"
PREVIEW_GATE_TOKEN_TTL_SECONDS = max(
    30,
    int((os.getenv("DATAVERSE_PARSER_PREVIEW_TOKEN_TTL_SECONDS") or "900").strip() or "900"),
)
_PREVIEW_GATE_MODE = (os.getenv("DATAVERSE_PARSER_PREVIEW_GATE_MODE") or "optional").strip().lower()
PREVIEW_GATE_MODE = _PREVIEW_GATE_MODE if _PREVIEW_GATE_MODE in {"optional", "enforced"} else "optional"


@dataclass(frozen=True)
class PreviewGateTokenClaims:
    user_id: UUID
    galaxy_id: UUID
    branch_id: UUID | None
    plan_hash: str
    issued_at: datetime
    expires_at: datetime


def preview_gate_mode() -> str:
    return PREVIEW_GATE_MODE


def _json_default(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def build_preview_plan_hash(*, payload: dict[str, Any]) -> str:
    normalized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=_json_default)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def build_preview_gate_plan_payload(
    *,
    resolved_command: str,
    parser_version_requested: str,
    parser_version_effective: str,
    parser_path: str,
    fallback_used: bool,
    fallback_policy_mode: str,
    fallback_policy_reason: str,
    alias_version: int | None,
    tasks: list[dict[str, Any]],
    galaxy_id: UUID,
    branch_id: UUID | None,
) -> dict[str, Any]:
    return {
        "resolved_command": str(resolved_command),
        "parser_version_requested": str(parser_version_requested),
        "parser_version_effective": str(parser_version_effective),
        "parser_path": str(parser_path),
        "fallback_used": bool(fallback_used),
        "fallback_policy_mode": str(fallback_policy_mode),
        "fallback_policy_reason": str(fallback_policy_reason),
        "alias_version": int(alias_version) if alias_version is not None else None,
        "tasks": tasks,
        "scope": {"galaxy_id": str(galaxy_id), "branch_id": str(branch_id) if branch_id is not None else None},
    }


def create_preview_gate_token(
    *,
    user_id: UUID,
    galaxy_id: UUID,
    branch_id: UUID | None,
    plan_hash: str,
) -> tuple[str, datetime]:
    issued_at = datetime.now(UTC)
    expires_at = issued_at + timedelta(seconds=PREVIEW_GATE_TOKEN_TTL_SECONDS)
    payload = {
        "typ": "parser_preview",
        "sub": str(user_id),
        "gid": str(galaxy_id),
        "bid": str(branch_id) if branch_id is not None else "",
        "ph": str(plan_hash),
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, PREVIEW_GATE_SECRET, algorithm=PREVIEW_GATE_ALGORITHM)
    return token, expires_at


def decode_preview_gate_token(token: str) -> PreviewGateTokenClaims:
    try:
        payload = jwt.decode(token, PREVIEW_GATE_SECRET, algorithms=[PREVIEW_GATE_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PARSER_PREVIEW_TOKEN_INVALID",
                "message": "Preview token is invalid or expired.",
            },
        ) from exc

    token_type = str(payload.get("typ") or "").strip().lower()
    if token_type != "parser_preview":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PARSER_PREVIEW_TOKEN_INVALID",
                "message": "Preview token has invalid type.",
            },
        )

    try:
        user_id = UUID(str(payload.get("sub") or ""))
        galaxy_id = UUID(str(payload.get("gid") or ""))
        branch_raw = str(payload.get("bid") or "").strip()
        branch_id = UUID(branch_raw) if branch_raw else None
        plan_hash = str(payload.get("ph") or "").strip()
        issued_at = datetime.fromtimestamp(float(payload.get("iat")), tz=UTC)
        expires_at = datetime.fromtimestamp(float(payload.get("exp")), tz=UTC)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PARSER_PREVIEW_TOKEN_INVALID",
                "message": "Preview token payload is malformed.",
            },
        ) from exc

    if not plan_hash:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PARSER_PREVIEW_TOKEN_INVALID",
                "message": "Preview token payload is missing plan hash.",
            },
        )

    return PreviewGateTokenClaims(
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=branch_id,
        plan_hash=plan_hash,
        issued_at=issued_at,
        expires_at=expires_at,
    )


def validate_preview_gate_token(
    *,
    token: str | None,
    mode: str,
    mutating: bool,
    expected_plan_hash: str,
    expected_user_id: UUID,
    expected_galaxy_id: UUID,
    expected_branch_id: UUID | None,
) -> None:
    if not token:
        if mode == "enforced" and mutating:
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail={
                    "code": "PARSER_PREVIEW_REQUIRED",
                    "message": "Execute mutace vyzaduje validni preview token.",
                },
            )
        return

    claims = decode_preview_gate_token(token)
    if claims.user_id != expected_user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PARSER_PREVIEW_TOKEN_SCOPE_MISMATCH",
                "message": "Preview token does not belong to current user.",
            },
        )
    if claims.galaxy_id != expected_galaxy_id or claims.branch_id != expected_branch_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PARSER_PREVIEW_TOKEN_SCOPE_MISMATCH",
                "message": "Preview token scope does not match execute scope.",
            },
        )
    if claims.plan_hash != expected_plan_hash:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PARSER_PREVIEW_TOKEN_PLAN_MISMATCH",
                "message": "Preview token does not match current parser plan.",
            },
        )
