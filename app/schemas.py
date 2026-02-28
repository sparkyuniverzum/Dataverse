import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

class AsteroidIngestRequest(BaseModel):
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)
    galaxy_id: uuid.UUID | None = None


class AsteroidResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None


class BondCreateRequest(BaseModel):
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str
    galaxy_id: uuid.UUID | None = None


class BondResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str
    is_deleted: bool
    created_at: datetime
    deleted_at: datetime | None


class ParseCommandRequest(BaseModel):
    text: str | None = None
    query: str | None = None
    galaxy_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_text_or_query(self) -> "ParseCommandRequest":
        text = self.text.strip() if isinstance(self.text, str) else None
        query = self.query.strip() if isinstance(self.query, str) else None

        if text:
            self.text = text
        if query:
            self.query = query

        if not text and not query:
            raise ValueError("Provide either 'text' or 'query'")

        if text and query and text != query:
            raise ValueError("'text' and 'query' must match when both are provided")

        return self

    @property
    def command(self) -> str:
        if self.query:
            return self.query
        if self.text:
            return self.text
        return ""


class TaskSchema(BaseModel):
    action: str
    params: dict[str, Any]


class ParseCommandResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tasks: list[TaskSchema]
    asteroids: list[AsteroidResponse] = Field(default_factory=list)
    bonds: list[BondResponse] = Field(default_factory=list)
    selected_asteroids: list[AsteroidResponse] = Field(default_factory=list)
    extinguished_asteroid_ids: list[uuid.UUID] = Field(default_factory=list)
    extinguished_bond_ids: list[uuid.UUID] = Field(default_factory=list)


class UniverseAsteroidSnapshot(BaseModel):
    id: uuid.UUID
    value: Any
    metadata: dict[str, Any] = Field(default_factory=dict)
    calculated_values: dict[str, Any] = Field(default_factory=dict)
    active_alerts: list[str] = Field(default_factory=list)
    created_at: datetime


class UniverseBondSnapshot(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    type: str


class UniverseSnapshotResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asteroids: list[UniverseAsteroidSnapshot] = Field(default_factory=list)
    bonds: list[UniverseBondSnapshot] = Field(default_factory=list)


class UserPublic(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime
    is_active: bool
    deleted_at: datetime | None


class GalaxyPublic(BaseModel):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    created_at: datetime
    deleted_at: datetime | None


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    galaxy_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
    default_galaxy: GalaxyPublic


class GalaxyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
