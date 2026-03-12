from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infrastructure.runtime.parser.preview_gate import (
    build_preview_gate_plan_payload,
    build_preview_plan_hash,
    create_preview_gate_token,
    decode_preview_gate_token,
    validate_preview_gate_token,
)


def test_preview_plan_hash_is_deterministic_for_same_payload() -> None:
    galaxy_id = uuid4()
    payload = build_preview_gate_plan_payload(
        resolved_command="Delete : Alpha",
        parser_version_requested="v2",
        parser_version_effective="v2",
        parser_path="v2",
        fallback_used=False,
        fallback_policy_mode="auto_unpinned",
        fallback_policy_reason="policy_auto_unpinned_allowed",
        alias_version=1,
        tasks=[{"action": "DELETE", "params": {"target": "Alpha"}, "source_text": "Delete : Alpha"}],
        galaxy_id=galaxy_id,
        branch_id=None,
    )
    first = build_preview_plan_hash(payload=payload)
    second = build_preview_plan_hash(payload=payload)
    assert first == second


def test_preview_gate_token_roundtrip_and_scope_validation() -> None:
    user_id = uuid4()
    galaxy_id = uuid4()
    plan_hash = "abc123"
    token, _expires_at = create_preview_gate_token(
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=None,
        plan_hash=plan_hash,
    )
    claims = decode_preview_gate_token(token)
    assert claims.user_id == user_id
    assert claims.galaxy_id == galaxy_id
    assert claims.branch_id is None
    assert claims.plan_hash == plan_hash

    validate_preview_gate_token(
        token=token,
        mode="enforced",
        mutating=True,
        expected_plan_hash=plan_hash,
        expected_user_id=user_id,
        expected_galaxy_id=galaxy_id,
        expected_branch_id=None,
    )


def test_preview_gate_token_rejects_plan_mismatch() -> None:
    user_id = uuid4()
    galaxy_id = uuid4()
    token, _expires_at = create_preview_gate_token(
        user_id=user_id,
        galaxy_id=galaxy_id,
        branch_id=None,
        plan_hash="hash-a",
    )

    with pytest.raises(HTTPException) as exc:
        validate_preview_gate_token(
            token=token,
            mode="enforced",
            mutating=True,
            expected_plan_hash="hash-b",
            expected_user_id=user_id,
            expected_galaxy_id=galaxy_id,
            expected_branch_id=None,
        )
    assert exc.value.status_code == 422
    assert exc.value.detail.get("code") == "PARSER_PREVIEW_TOKEN_PLAN_MISMATCH"
