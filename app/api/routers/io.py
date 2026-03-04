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
from app.db import get_session
from app.models import User
from app.schemas import ImportErrorsResponse, ImportJobPublic, ImportModeSchema, ImportRunResponse
from app.modules.auth.dependencies import get_current_user
from app.services.io_service import ImportMode

router = APIRouter(tags=["io"])


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
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Missing filename")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Phase 1 import supports CSV only",
        )

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Uploaded file is empty")

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
        result = await services.io_service.import_csv(
            session=session,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            branch_id=target_branch_id,
            filename=file.filename,
            file_bytes=payload,
            mode=ImportMode(mode.value),
            strict=bool(strict),
        )
    await commit_if_active(session)
    return ImportRunResponse(job=import_job_to_public(result.job))


@router.get("/io/imports/{job_id}", response_model=ImportJobPublic, status_code=status.HTTP_200_OK)
async def get_import_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ImportJobPublic:
    job = await services.io_service.get_job_for_user(session=session, user_id=current_user.id, job_id=job_id)
    return import_job_to_public(job)


@router.get("/io/imports/{job_id}/errors", response_model=ImportErrorsResponse, status_code=status.HTTP_200_OK)
async def get_import_job_errors(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> ImportErrorsResponse:
    errors = await services.io_service.get_job_errors(session=session, user_id=current_user.id, job_id=job_id)
    return ImportErrorsResponse(errors=[import_error_to_public(error) for error in errors])


@router.get("/io/exports/snapshot", status_code=status.HTTP_200_OK)
async def export_snapshot_csv(
    format: str = Query(default="csv"),
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    branch_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StreamingResponse:
    if format.lower() != "csv":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Phase 1 export supports CSV only")
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
    csv_payload = await services.io_service.export_snapshot_csv(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
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
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    services: ServiceContainer = Depends(get_service_container),
) -> StreamingResponse:
    if format.lower() != "csv":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Phase 1 export supports CSV only")
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
    csv_payload = await services.io_service.export_tables_csv(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        branch_id=target_branch_id,
        as_of=as_of,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="tables-{target_galaxy_id}.csv"',
    }
    return StreamingResponse(iter([csv_payload]), media_type="text/csv", headers=headers)
