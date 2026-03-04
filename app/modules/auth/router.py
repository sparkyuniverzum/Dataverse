from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import galaxy_to_public, user_to_public
from app.api.runtime import commit_if_active, get_service_container, transactional_context
from app.app_factory import ServiceContainer
from app.db import get_session
from app.modules.auth.dependencies import AuthContext, get_current_auth_context, get_current_user
from app.modules.auth.schemas import AuthResponse, LoginRequest, LogoutResponse, RefreshRequest, RefreshResponse, RegisterRequest
from app.schema_models.auth_onboarding import UserPublic

router = APIRouter(tags=["auth"])


def _request_user_agent(request: Request) -> str | None:
    user_agent = request.headers.get("user-agent")
    if not isinstance(user_agent, str):
        return None
    normalized = user_agent.strip()
    return normalized if normalized else None


def _request_ip_address(request: Request) -> str | None:
    if request.client is None:
        return None
    host = str(request.client.host or "").strip()
    return host if host else None


@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    services: ServiceContainer = Depends(get_service_container),
) -> AuthResponse:
    async with transactional_context(session):
        result = await services.auth_service.register(
            session=session,
            email=payload.email,
            password=payload.password,
            galaxy_name=payload.galaxy_name,
            user_agent=_request_user_agent(request),
            ip_address=_request_ip_address(request),
        )
        await services.onboarding_service.ensure_progress(
            session=session,
            user_id=result.user.id,
            galaxy_id=result.default_galaxy.id,
        )
    await commit_if_active(session)
    return AuthResponse(
        access_token=result.tokens.access_token,
        refresh_token=result.tokens.refresh_token,
        token_type="bearer",
        user=user_to_public(result.user),
        default_galaxy=galaxy_to_public(result.default_galaxy),
    )


@router.post("/auth/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
async def login(
    payload: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    services: ServiceContainer = Depends(get_service_container),
) -> AuthResponse:
    async with transactional_context(session):
        result = await services.auth_service.login(
            session=session,
            email=payload.email,
            password=payload.password,
            user_agent=_request_user_agent(request),
            ip_address=_request_ip_address(request),
        )
        await services.onboarding_service.ensure_progress(
            session=session,
            user_id=result.user.id,
            galaxy_id=result.default_galaxy.id,
        )
    await commit_if_active(session)
    return AuthResponse(
        access_token=result.tokens.access_token,
        refresh_token=result.tokens.refresh_token,
        token_type="bearer",
        user=user_to_public(result.user),
        default_galaxy=galaxy_to_public(result.default_galaxy),
    )


@router.post("/auth/refresh", response_model=RefreshResponse, status_code=status.HTTP_200_OK)
async def refresh(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_session),
    services: ServiceContainer = Depends(get_service_container),
) -> RefreshResponse:
    async with transactional_context(session):
        tokens = await services.auth_service.refresh_tokens(
            session=session,
            refresh_token=payload.refresh_token,
        )
    await commit_if_active(session)
    return RefreshResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type="bearer",
        expires_at=services.auth_service.decode_access_token(tokens.access_token).expires_at,
    )


@router.post("/auth/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
async def logout(
    context: AuthContext = Depends(get_current_auth_context),
    session: AsyncSession = Depends(get_session),
    services: ServiceContainer = Depends(get_service_container),
) -> LogoutResponse:
    async with transactional_context(session):
        await services.auth_service.revoke_session(
            session=session,
            session_id=context.auth_session.id,
            reason="logout",
        )
    await commit_if_active(session)
    return LogoutResponse(ok=True)


@router.get("/auth/me", response_model=UserPublic, status_code=status.HTTP_200_OK)
async def auth_me(
    current_user=Depends(get_current_user),
) -> UserPublic:
    return user_to_public(current_user)
