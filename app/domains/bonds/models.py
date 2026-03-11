import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domains.shared.base import Base


class Bond(Base):
    __tablename__ = "bonds"
    __table_args__ = (
        CheckConstraint("source_civilization_id <> target_civilization_id", name="bonds_no_delete_chk"),
        CheckConstraint(
            "((is_deleted = FALSE AND deleted_at IS NULL) OR (is_deleted = TRUE AND deleted_at IS NOT NULL))",
            name="bonds_soft_delete_chk",
        ),
        Index(
            "ux_bonds_active_relation",
            "user_id",
            "galaxy_id",
            "source_civilization_id",
            "target_civilization_id",
            "type",
            unique=True,
            postgresql_where=text("is_deleted = FALSE"),
        ),
    )

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
    source_civilization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("civilization_rm.id"),
        nullable=False,
    )
    target_civilization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("civilization_rm.id"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(nullable=False)
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("FALSE"),
        default=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
