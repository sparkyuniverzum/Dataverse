import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domains.shared.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("TRUE"),
        default=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StarCorePolicyRM(Base):
    __tablename__ = "star_core_policies"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True,
    )
    galaxy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("galaxies.id"),
        primary_key=True,
    )
    profile_key: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'ORIGIN'"))
    law_preset: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'balanced'"))
    physical_profile_key: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'BALANCE'"))
    physical_profile_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    no_hard_delete: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("TRUE"), default=True)
    deletion_mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'soft_delete'"))
    soft_delete_flag_field: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'is_deleted'"))
    soft_delete_timestamp_field: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'deleted_at'"))
    event_sourcing_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("TRUE"), default=True
    )
    occ_enforced: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("TRUE"), default=True)
    idempotency_supported: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("TRUE"), default=True
    )
    branch_scope_supported: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("TRUE"), default=True
    )
    lock_status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'draft'"))
    policy_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    interior_entry_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    locked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )


class CalcStateRM(Base):
    __tablename__ = "calc_state_rm"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True,
    )
    galaxy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("galaxies.id"),
        primary_key=True,
    )
    civilization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("civilization_rm.id"),
        primary_key=True,
    )
    source_event_seq: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"), index=True)
    engine_version: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'calc-v1'"))
    calculated_values: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    calc_errors: Mapped[list[Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'[]'::jsonb"),
    )
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    circular_fields_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PhysicsStateRM(Base):
    __tablename__ = "physics_state_rm"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True,
    )
    galaxy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("galaxies.id"),
        primary_key=True,
    )
    entity_kind: Mapped[str] = mapped_column(Text, primary_key=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        primary_key=True,
    )
    source_event_seq: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"), index=True)
    engine_version: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'physics-v1'"))
    stress_score: Mapped[float] = mapped_column(nullable=False, server_default=text("0"))
    mass_factor: Mapped[float] = mapped_column(nullable=False, server_default=text("1"))
    radius_factor: Mapped[float] = mapped_column(nullable=False, server_default=text("1"))
    emissive_boost: Mapped[float] = mapped_column(nullable=False, server_default=text("0"))
    pulse_factor: Mapped[float] = mapped_column(nullable=False, server_default=text("1"))
    opacity_factor: Mapped[float] = mapped_column(nullable=False, server_default=text("1"))
    attraction_factor: Mapped[float] = mapped_column(nullable=False, server_default=text("1"))
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


__all__ = [
    "CalcStateRM",
    "PhysicsStateRM",
    "StarCorePolicyRM",
    "User",
]
