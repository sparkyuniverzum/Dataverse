import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domains.shared.base import Base


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


__all__ = [
    "Galaxy",
    "GalaxyActivityRM",
    "GalaxyHealthRM",
    "GalaxySummaryRM",
    "OnboardingProgress",
]
