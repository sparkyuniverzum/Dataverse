from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OutboxEvent
from app.services.onboarding_service import OnboardingService


class OnboardingBootstrapConsumer:
    def __init__(self, *, onboarding_service: OnboardingService | None = None) -> None:
        self.onboarding_service = onboarding_service or OnboardingService()

    async def consume(self, session: AsyncSession, *, event: OutboxEvent) -> bool:
        if str(event.event_type or "").strip().lower() != "user.created":
            return False

        payload = event.payload_json if isinstance(event.payload_json, dict) else {}
        user_id_raw = str(payload.get("user_id") or "").strip()
        galaxy_id_raw = str(payload.get("default_galaxy_id") or "").strip()
        if not user_id_raw or not galaxy_id_raw:
            raise ValueError("user.created event payload requires user_id and default_galaxy_id")

        user_id = UUID(user_id_raw)
        galaxy_id = UUID(galaxy_id_raw)
        progress = await self.onboarding_service.ensure_progress(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
        )

        now = datetime.now(UTC)
        notes = progress.notes if isinstance(progress.notes, dict) else {}
        bootstrap = notes.get("bootstrap") if isinstance(notes.get("bootstrap"), dict) else {}
        if str(bootstrap.get("status") or "").strip().lower() == "provisioned" and str(
            bootstrap.get("source_event_id") or ""
        ).strip() == str(event.domain_event_id):
            return True
        next_bootstrap = dict(bootstrap)
        next_bootstrap["status"] = "provisioned"
        next_bootstrap["source_event_id"] = str(event.domain_event_id)
        next_bootstrap["updated_at"] = now.isoformat()
        progress.notes = {**notes, "bootstrap": next_bootstrap}
        progress.updated_at = now
        await session.flush()
        return True
