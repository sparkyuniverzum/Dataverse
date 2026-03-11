import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domains.shared.base import Base


class MoonCapability(Base):
    __tablename__ = "moon_capabilities"
    __table_args__ = (
        CheckConstraint("version > 0", name="moon_capabilities_version_positive_chk"),
        CheckConstraint(
            "status IN ('active','deprecated')",
            name="moon_capabilities_status_chk",
        ),
        Index(
            "ux_moon_capabilities_active_key",
            "galaxy_id",
            "table_id",
            "capability_key",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    galaxy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("galaxies.id"),
        nullable=False,
        index=True,
    )
    table_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    capability_key: Mapped[str] = mapped_column(Text, nullable=False)
    capability_class: Mapped[str] = mapped_column(Text, nullable=False)
    config_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("100"), default=100)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'active'"), default="active")
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"), default=1)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
