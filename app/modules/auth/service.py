from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.runtime.event_envelope import build_domain_event_envelope
from app.infrastructure.runtime.event_store_service import EventStoreService
from app.infrastructure.security.auth_security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_MINUTES,
    TokenClaims,
    create_access_token,
    create_refresh_token,
    decode_token_safe,
    hash_password,
    utc_now,
    verify_password,
)
from app.models import AuthSession, Galaxy, User
from app.modules.auth.errors import invalid_credentials_error, missing_session_error
from app.modules.auth.repository import AuthRepository
from app.services.task_executor.occ_guards import OccGuards
from app.services.universe_service import UniverseService


@dataclass(frozen=True)
class AuthTokens:
    access_token: str
    refresh_token: str


@dataclass(frozen=True)
class AuthResult:
    user: User
    default_galaxy: Galaxy
    tokens: AuthTokens


class AuthService:
    def __init__(
        self,
        *,
        repository: AuthRepository | None = None,
        event_store: EventStoreService | None = None,
        universe_service: UniverseService | None = None,
    ) -> None:
        self.repository = repository or AuthRepository()
        self.event_store = event_store or EventStoreService()
        self.universe_service = universe_service or UniverseService()

    @staticmethod
    def normalize_email(email: str) -> str:
        return str(email or "").strip().lower()

    @staticmethod
    def hash_password(password: str) -> str:
        return hash_password(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return verify_password(plain_password, hashed_password)

    async def _create_session_tokens(
        self,
        session: AsyncSession,
        *,
        user_id: UUID,
        user_agent: str | None,
        ip_address: str | None,
    ) -> tuple[AuthSession, AuthTokens]:
        now = utc_now()
        placeholder_access_exp = now + timedelta(minutes=max(1, int(ACCESS_TOKEN_EXPIRE_MINUTES)))
        placeholder_refresh_exp = now + timedelta(minutes=max(1, int(REFRESH_TOKEN_EXPIRE_MINUTES)))

        auth_session = await self.repository.create_auth_session(
            session=session,
            user_id=user_id,
            access_expires_at=placeholder_access_exp,
            refresh_expires_at=placeholder_refresh_exp,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        access_token, access_expires_at = create_access_token(user_id=user_id, session_id=auth_session.id)
        refresh_token, refresh_expires_at = create_refresh_token(user_id=user_id, session_id=auth_session.id)
        auth_session.access_expires_at = access_expires_at
        auth_session.refresh_expires_at = refresh_expires_at

        return auth_session, AuthTokens(access_token=access_token, refresh_token=refresh_token)

    async def _resolve_or_create_default_galaxy(self, session: AsyncSession, *, user_id: UUID) -> Galaxy:
        galaxies = await self.repository.list_galaxies(session=session, user_id=user_id)
        if galaxies:
            return galaxies[0]
        return await self.repository.create_galaxy(session=session, user_id=user_id, name="My Galaxy")

    async def register(
        self,
        session: AsyncSession,
        *,
        email: str,
        password: str,
        galaxy_name: str | None = None,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResult:
        normalized_email = self.normalize_email(email)
        if not normalized_email:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Email is required")

        existing = await self.repository.get_user_by_email(
            session=session,
            normalized_email=normalized_email,
            include_deleted=True,
        )
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

        user = await self.repository.create_user(
            session=session,
            normalized_email=normalized_email,
            hashed_password=self.hash_password(password),
        )
        requested_name = str(galaxy_name or "").strip()
        default_name = requested_name if requested_name else "My Galaxy"
        default_galaxy = await self.repository.create_galaxy(session=session, user_id=user.id, name=default_name)
        outbox_envelope = build_domain_event_envelope(
            event_type="user.created",
            aggregate_id=user.id,
            payload={
                "user_id": str(user.id),
                "email": normalized_email,
                "default_galaxy_id": str(default_galaxy.id),
            },
            trace_id=f"auth.register:{user.id}",
            correlation_id=f"auth.register:{user.id}",
        )
        await self.event_store.append_outbox_event(
            session=session,
            envelope=outbox_envelope,
        )
        _, tokens = await self._create_session_tokens(
            session=session,
            user_id=user.id,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        return AuthResult(user=user, default_galaxy=default_galaxy, tokens=tokens)

    async def login(
        self,
        session: AsyncSession,
        *,
        email: str,
        password: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResult:
        normalized_email = self.normalize_email(email)
        user = await self.repository.get_user_by_email(session=session, normalized_email=normalized_email)
        if user is None or not user.is_active:
            raise invalid_credentials_error()
        if not self.verify_password(password, user.hashed_password):
            raise invalid_credentials_error()

        default_galaxy = await self._resolve_or_create_default_galaxy(session=session, user_id=user.id)
        _, tokens = await self._create_session_tokens(
            session=session,
            user_id=user.id,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        return AuthResult(user=user, default_galaxy=default_galaxy, tokens=tokens)

    async def refresh_tokens(self, session: AsyncSession, *, refresh_token: str) -> AuthTokens:
        claims = decode_token_safe(refresh_token, expected_type="refresh")
        auth_session = await self.repository.get_active_auth_session(
            session=session,
            session_id=claims.session_id,
            user_id=claims.user_id,
        )
        if auth_session is None:
            raise missing_session_error()

        user = await self.repository.get_user_by_id(session=session, user_id=claims.user_id)
        if user is None or not user.is_active:
            raise invalid_credentials_error()

        access_token, access_expires_at = create_access_token(user_id=user.id, session_id=auth_session.id)
        rotated_refresh_token, refresh_expires_at = create_refresh_token(user_id=user.id, session_id=auth_session.id)
        auth_session.access_expires_at = access_expires_at
        auth_session.refresh_expires_at = refresh_expires_at
        return AuthTokens(access_token=access_token, refresh_token=rotated_refresh_token)

    @staticmethod
    def decode_access_token(token: str) -> TokenClaims:
        return decode_token_safe(token, expected_type="access")

    async def revoke_session(self, session: AsyncSession, *, session_id: UUID, reason: str = "logout") -> None:
        _ = await self.repository.revoke_session(
            session=session,
            session_id=session_id,
            revoked_reason=reason,
        )

    async def resolve_user_galaxy(self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID | None) -> Galaxy:
        return await self.repository.resolve_user_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)

    async def list_galaxies(self, session: AsyncSession, *, user_id: UUID) -> list[Galaxy]:
        return await self.repository.list_galaxies(session=session, user_id=user_id)

    async def create_galaxy(self, session: AsyncSession, *, user_id: UUID, name: str) -> Galaxy:
        normalized = str(name or "").strip()
        if not normalized:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Galaxy name cannot be empty")
        return await self.repository.create_galaxy(session=session, user_id=user_id, name=normalized)

    async def soft_delete_galaxy(
        self, session: AsyncSession, *, user_id: UUID, galaxy_id: UUID, expected_event_seq: int
    ) -> Galaxy:
        """
        Performs a transactionally-safe, cascading soft delete of a galaxy by generating
        a full set of soft-delete events for the galaxy and all its contents.
        """
        # 1. Enforce OCC lock to prevent race conditions
        await OccGuards.enforce_expected_entity_event_seq(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            branch_id=None,
            entity_id=galaxy_id,
            expected_event_seq=expected_event_seq,
            context="extinguish_galaxy",
        )

        # 2. Load the full state of the galaxy to find all active entities
        active_civilizations, active_bonds = await self.universe_service.project_state(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            apply_calculations=False,  # We don't need expensive calculations, just the entities
        )

        now = datetime.now(UTC)

        # 3. Generate soft-delete events for all related entities (bonds first)
        for bond in active_bonds:
            if not bond.is_deleted:
                await self.event_store.append_event(
                    session=session,
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    entity_id=bond.id,
                    event_type="BOND_SOFT_DELETED",
                    payload={"deleted_at": now.isoformat()},
                )

        for civilization in active_civilizations:
            if not civilization.is_deleted:
                await self.event_store.append_event(
                    session=session,
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    entity_id=civilization.id,
                    event_type="CIVILIZATION_SOFT_DELETED",
                    payload={"deleted_at": now.isoformat()},
                )

        # 4. Generate the event for the galaxy itself
        await self.event_store.append_event(
            session=session,
            user_id=user_id,
            galaxy_id=galaxy_id,
            entity_id=galaxy_id,
            event_type="GALAXY_EXTINGUISHED",
            payload={"deleted_at": now.isoformat()},
        )

        # 5. Perform the final soft-delete on the main galaxy table and return it
        deleted_galaxy = await self.repository.soft_delete_galaxy(session=session, user_id=user_id, galaxy_id=galaxy_id)
        return deleted_galaxy
