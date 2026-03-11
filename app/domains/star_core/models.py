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


class Galaxy(Base):
    __tablename__ = "galaxies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
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


class OnboardingProgress(Base):
    __tablename__ = "onboarding_progress"

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
    mode: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'guided'"))
    stage_key: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'galaxy_bootstrap'"))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    stage_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[dict[str, Any]] = mapped_column(
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


class GalaxySummaryRM(Base):
    __tablename__ = "galaxy_summary_rm"

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
    constellations_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    planets_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    moons_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    bonds_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    formula_fields_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )


class GalaxyHealthRM(Base):
    __tablename__ = "galaxy_health_rm"

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
    guardian_rules_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    alerted_civilizations_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    circular_fields_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    quality_score: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("100"))
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'GREEN'"))
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


class GalaxyActivityRM(Base):
    __tablename__ = "galaxy_activity_rm"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    galaxy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("galaxies.id"),
        nullable=False,
        index=True,
    )
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    event_seq: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    happened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
