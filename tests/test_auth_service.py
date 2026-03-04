from pathlib import Path
import sys

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.modules.auth.service import AuthService


def test_hash_password_rejects_input_longer_than_bcrypt_limit() -> None:
    too_long = "a" * 73
    with pytest.raises(HTTPException) as exc:
        AuthService.hash_password(too_long)
    assert exc.value.status_code == 422
    assert "too long" in str(exc.value.detail).lower()


def test_verify_password_returns_false_for_too_long_plaintext() -> None:
    hashed = AuthService.hash_password("safe-pass-123")
    assert AuthService.verify_password("b" * 100, hashed) is False
