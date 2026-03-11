from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.mappers.public import import_error_to_public, import_job_to_public
from app.api.runtime import (
    commit_if_active,
    get_service_container,
    resolve_branch_id_for_user,
    resolve_galaxy_id_for_user,
    transactional_context,
)
from app.app_factory import ServiceContainer
from app.db import get_read_session, get_session
from app.domains.imports.commands import (
    ImportCommandError,
    ensure_csv_export_format,
    ensure_non_empty_payload,
    plan_import_csv,
    run_import_csv as run_import_csv_command,
)
from app.domains.imports.queries import (
    ImportQueryError,
    export_snapshot_csv as export_snapshot_csv_query,
    export_tables_csv as export_tables_csv_query,
    get_job_errors as get_job_errors_query,
    get_job_for_user as get_job_for_user_query,
)
from app.models import User
from app.modules.auth.dependencies import get_current_user
from app.schemas import ImportErrorsResponse, ImportJobPublic, ImportModeSchema, ImportRunResponse

router = APIRouter(tags=["io"])


def _command_to_http_exception(exc: ImportCommandError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _query_to_http_exception(exc: ImportQueryError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.post("/io/imports", response_model=ImportRunResponse, status_code=status.HTTP_200_OK)
async def run_import_csv(
    file: UploadFile = File(...),
    mode: ImportModeSchema = Form(default=ImportModeSchema.commit),
    strict: bool = Form(default=True),
    galaxy_id: UUID | None = Form(default=None),
    branch_id: UUID | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ImportRunResponse:
    try:
        plan = plan_import_csv(
            filename=file.filename,
            mode=mode.value,
            strict=strict,
            galaxy_id=galaxy_id,
            branch_id=branch_id,
        )
    except ImportCommandError as exc:
        raise _command_to_http_exception(exc) from exc
    payload = ensure_non_empty_payload(await file.read())

    async with transactional_context(session):
        target_galaxy_id = await resolve_galaxy_id_for_user(
            session=session,
            user=current_user,
            galaxy_id=galaxy_id,
            services=services,
        )
        target_branch_id = await resolve_branch_id_for_user(
            session=session,
            user=current_user,
            galaxy_id=target_galaxy_id,
            branch_id=branch_id,
            services=services,
        )
        try:
            result = await run_import_csv_command(
                session=session,
                services=services,
                user_id=current_user.id,
                galaxy_id=target_galaxy_id,
                branch_id=target_branch_id,
                filename=str(plan.request_payload["filename"]),
                file_bytes=payload,
                mode=str(plan.request_payload["mode"]),
                strict=bool(plan.request_payload["strict"]),
            )
        except ImportCommandError as exc:
            raise _command_to_http_exception(exc) from exc
    await commit_if_active(session)
    return ImportRunResponse(job=import_job_to_public(result.job))


@router.get("/io/imports/{job_id}", response_model=ImportJobPublic, status_code=status.HTTP_200_OK)
async def get_import_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ImportJobPublic:
    try:
        job = await get_job_for_user_query(
            session=session,
            services=services,
            user_id=current_user.id,
            job_id=job_id,
        )
    except ImportQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return import_job_to_public(job)


@router.get("/io/imports/{job_id}/errors", response_model=ImportErrorsResponse, status_code=status.HTTP_200_OK)
async def get_import_job_errors(
    job_id: UUID,
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ImportErrorsResponse:
    try:
        errors = await get_job_errors_query(
            session=session,
            services=services,
            user_id=current_user.id,
            job_id=job_id,
        )
    except ImportQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    return ImportErrorsResponse(errors=[import_error_to_public(error) for error in errors])


@router.get("/io/exports/snapshot", status_code=status.HTTP_200_OK)
async def export_snapshot_csv(
    format: str = Query(default="csv"),
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StreamingResponse:
    try:
        _ = ensure_csv_export_format(format)
    except ImportCommandError as exc:
        raise _command_to_http_exception(exc) from exc
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        services=services,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    try:
        csv_payload = await export_snapshot_csv_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            as_of=as_of,
        )
    except ImportQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    headers = {
        "Content-Disposition": f'attachment; filename="snapshot-{target_galaxy_id}.csv"',
    }
    return StreamingResponse(iter([csv_payload]), media_type="text/csv", headers=headers)


@router.get("/io/exports/tables", status_code=status.HTTP_200_OK)
async def export_tables_csv(
    format: str = Query(default="csv"),
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_read_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StreamingResponse:
    try:
        _ = ensure_csv_export_format(format)
    except ImportCommandError as exc:
        raise _command_to_http_exception(exc) from exc
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
        services=services,
    )
    target_branch_id = await resolve_branch_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=target_galaxy_id,
        branch_id=branch_id,
        services=services,
    )
    try:
        csv_payload = await export_tables_csv_query(
            session=session,
            services=services,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            as_of=as_of,
        )
    except ImportQueryError as exc:
        raise _query_to_http_exception(exc) from exc
    headers = {
        "Content-Disposition": f'attachment; filename="tables-{target_galaxy_id}.csv"',
    }
    return StreamingResponse(iter([csv_payload]), media_type="text/csv", headers=headers)
