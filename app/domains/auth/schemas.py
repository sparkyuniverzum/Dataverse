from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schema_models.auth_onboarding import GalaxyPublic, UserPublic


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=256)
    galaxy_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic
    default_galaxy: GalaxyPublic


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime


class LogoutResponse(BaseModel):
    ok: bool = True


__all__ = [
    "AuthResponse",
    "LoginRequest",
    "LogoutResponse",
    "RefreshRequest",
    "RefreshResponse",
    "RegisterRequest",
]
