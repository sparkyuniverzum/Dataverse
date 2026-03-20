from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import galaxy_to_public, user_to_public
from app.api.runtime import (
    commit_if_active,
    ensure_onboarding_progress_safe,
    get_service_container,
    transactional_context,
)
from app.app_factory import ServiceContainer
from app.db import get_session
from app.domains.auth.commands import (
    AuthCommandError,
    login as login_command,
    plan_login,
    plan_logout,
    plan_refresh,
    plan_register,
    refresh_tokens as refresh_tokens_command,
    register as register_command,
    revoke_session as revoke_session_command,
)
from app.domains.auth.queries import AuthQueryError, decode_access_token as decode_access_token_query
from app.modules.auth.dependencies import AuthContext, get_current_auth_context, get_current_user
from app.modules.auth.schemas import (
    AuthResponse,
    LoginRequest,
    LogoutResponse,
    OAuthTokenResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
)
from app.schema_models.auth_onboarding import UserPublic

router = APIRouter(tags=["auth"])


def _command_to_http_exception(exc: AuthCommandError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail, headers=exc.headers)


def _query_to_http_exception(exc: AuthQueryError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail, headers=exc.headers)


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
    plan = plan_register(
        email=payload.email,
        password=payload.password,
        galaxy_name=payload.galaxy_name,
    )
    async with transactional_context(session):
        try:
            result = await register_command(
                session=session,
                services=services,
                email=str(plan.request_payload["email"]),
                password=str(plan.request_payload["password"]),
                galaxy_name=(
                    str(plan.request_payload["galaxy_name"])
                    if plan.request_payload["galaxy_name"] is not None
                    else None
                ),
                user_agent=_request_user_agent(request),
                ip_address=_request_ip_address(request),
            )
        except AuthCommandError as exc:
            raise _command_to_http_exception(exc) from exc
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
    plan = plan_login(
        email=payload.email,
        password=payload.password,
    )
    async with transactional_context(session):
        try:
            result = await login_command(
                session=session,
                services=services,
                email=str(plan.request_payload["email"]),
                password=str(plan.request_payload["password"]),
                user_agent=_request_user_agent(request),
                ip_address=_request_ip_address(request),
            )
        except AuthCommandError as exc:
            raise _command_to_http_exception(exc) from exc
        await ensure_onboarding_progress_safe(
            session=session,
            services=services,
            user_id=result.user.id,
            galaxy_id=result.default_galaxy.id,
            context="auth.login",
        )
    await commit_if_active(session)
    return AuthResponse(
        access_token=result.tokens.access_token,
        refresh_token=result.tokens.refresh_token,
        token_type="bearer",
        user=user_to_public(result.user),
        default_galaxy=galaxy_to_public(result.default_galaxy),
    )


@router.post("/auth/token", response_model=OAuthTokenResponse, status_code=status.HTTP_200_OK)
async def token_login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
    services: ServiceContainer = Depends(get_service_container),
) -> OAuthTokenResponse:
    plan = plan_login(
        email=form_data.username,
        password=form_data.password,
    )
    async with transactional_context(session):
        try:
            result = await login_command(
                session=session,
                services=services,
                email=str(plan.request_payload["email"]),
                password=str(plan.request_payload["password"]),
                user_agent=_request_user_agent(request),
                ip_address=_request_ip_address(request),
            )
        except AuthCommandError as exc:
            raise _command_to_http_exception(exc) from exc
        await ensure_onboarding_progress_safe(
            session=session,
            services=services,
            user_id=result.user.id,
            galaxy_id=result.default_galaxy.id,
            context="auth.token",
        )
    await commit_if_active(session)
    return OAuthTokenResponse(access_token=result.tokens.access_token, token_type="bearer")


@router.post("/auth/refresh", response_model=RefreshResponse, status_code=status.HTTP_200_OK)
async def refresh(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_session),
    services: ServiceContainer = Depends(get_service_container),
) -> RefreshResponse:
    plan = plan_refresh(refresh_token=payload.refresh_token)
    async with transactional_context(session):
        try:
            tokens = await refresh_tokens_command(
                session=session,
                services=services,
                refresh_token=str(plan.request_payload["refresh_token"]),
            )
        except AuthCommandError as exc:
            raise _command_to_http_exception(exc) from exc
    try:
        claims = decode_access_token_query(token=tokens.access_token)
    except AuthQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    await commit_if_active(session)
    return RefreshResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type="bearer",
        expires_at=claims.expires_at,
    )


@router.post("/auth/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
async def logout(
    context: AuthContext = Depends(get_current_auth_context),
    session: AsyncSession = Depends(get_session),
    services: ServiceContainer = Depends(get_service_container),
) -> LogoutResponse:
    plan = plan_logout(session_id=context.auth_session.id, reason="logout")
    async with transactional_context(session):
        try:
            await revoke_session_command(
                session=session,
                services=services,
                session_id=context.auth_session.id,
                reason=str(plan.request_payload["reason"]),
            )
        except AuthCommandError as exc:
            raise _command_to_http_exception(exc) from exc
    await commit_if_active(session)
    return LogoutResponse(ok=True)


@router.get("/auth/me", response_model=UserPublic, status_code=status.HTTP_200_OK)
async def auth_me(
    current_user=Depends(get_current_user),
) -> UserPublic:
    return user_to_public(current_user)
