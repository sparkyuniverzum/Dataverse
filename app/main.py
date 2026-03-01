from collections.abc import Mapping
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Galaxy, ImportError, ImportJob, User
from app.schemas import (
    AsteroidIngestRequest,
    AsteroidResponse,
    AuthResponse,
    BondCreateRequest,
    BondResponse,
    GalaxyCreateRequest,
    GalaxyPublic,
    ImportErrorsResponse,
    ImportJobPublic,
    ImportModeSchema,
    ImportRunResponse,
    ImportErrorPublic,
    LoginRequest,
    ParseCommandRequest,
    ParseCommandResponse,
    RegisterRequest,
    TaskSchema,
    UniverseAsteroidSnapshot,
    UniverseBondSnapshot,
    UniverseSnapshotResponse,
    UniverseTablesResponse,
    UserPublic,
)
from app.services.auth_service import AuthService, get_current_user
from app.services.event_store_service import EventStoreService
from app.services.io_service import ImportExportService, ImportMode
from app.services.parser_service import AtomicTask, ParserService
from app.services.task_executor_service import TaskExecutionResult, TaskExecutorService
from app.services.universe_service import (
    DEFAULT_GALAXY_ID,
    ProjectedAsteroid,
    ProjectedBond,
    UniverseService,
    derive_table_id,
    derive_table_name,
)

app = FastAPI(title="DataVerse API", version="0.3.0-auth-multitenant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

event_store = EventStoreService()
universe_service = UniverseService(event_store=event_store)
parser_service = ParserService()
task_executor_service = TaskExecutorService(event_store=event_store, universe_service=universe_service)
auth_service = AuthService()
io_service = ImportExportService(task_executor=task_executor_service, universe_service=universe_service)


def user_to_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        is_active=user.is_active,
        deleted_at=user.deleted_at,
    )


def galaxy_to_public(galaxy: Galaxy) -> GalaxyPublic:
    return GalaxyPublic(
        id=galaxy.id,
        name=galaxy.name,
        owner_id=galaxy.owner_id,
        created_at=galaxy.created_at,
        deleted_at=galaxy.deleted_at,
    )


def import_job_to_public(job: ImportJob) -> ImportJobPublic:
    return ImportJobPublic(
        id=job.id,
        user_id=job.user_id,
        galaxy_id=job.galaxy_id,
        filename=job.filename,
        file_hash=job.file_hash,
        mode=job.mode,
        status=job.status,
        total_rows=job.total_rows,
        processed_rows=job.processed_rows,
        errors_count=job.errors_count,
        summary=job.summary if isinstance(job.summary, dict) else {},
        created_at=job.created_at,
        finished_at=job.finished_at,
    )


def import_error_to_public(error: ImportError) -> ImportErrorPublic:
    return ImportErrorPublic(
        id=error.id,
        job_id=error.job_id,
        row_number=error.row_number,
        column_name=error.column_name,
        code=error.code,
        message=error.message,
        raw_value=error.raw_value,
        created_at=error.created_at,
    )


def transactional_context(session: AsyncSession):
    return session.begin_nested() if session.in_transaction() else session.begin()


async def commit_if_active(session: AsyncSession) -> None:
    if session.in_transaction():
        await session.commit()


def asteroid_to_response(asteroid: ProjectedAsteroid | Mapping[str, Any]) -> AsteroidResponse:
    if isinstance(asteroid, Mapping):
        return AsteroidResponse(
            id=asteroid["id"],
            value=asteroid.get("value"),
            metadata=asteroid.get("metadata", {}),
            is_deleted=bool(asteroid.get("is_deleted", False)),
            created_at=asteroid["created_at"],
            deleted_at=asteroid.get("deleted_at"),
        )
    return AsteroidResponse(
        id=asteroid.id,
        value=asteroid.value,
        metadata=asteroid.metadata,
        is_deleted=asteroid.is_deleted,
        created_at=asteroid.created_at,
        deleted_at=asteroid.deleted_at,
    )


def bond_to_response(bond: ProjectedBond | Mapping[str, Any]) -> BondResponse:
    if isinstance(bond, Mapping):
        return BondResponse(
            id=bond["id"],
            source_id=bond["source_id"],
            target_id=bond["target_id"],
            type=bond.get("type", "RELATION"),
            is_deleted=bool(bond.get("is_deleted", False)),
            created_at=bond["created_at"],
            deleted_at=bond.get("deleted_at"),
        )
    return BondResponse(
        id=bond.id,
        source_id=bond.source_id,
        target_id=bond.target_id,
        type=bond.type,
        is_deleted=bond.is_deleted,
        created_at=bond.created_at,
        deleted_at=bond.deleted_at,
    )


def task_to_response(task: AtomicTask) -> TaskSchema:
    return TaskSchema(action=task.action, params=task.params)


def execution_to_response(tasks: list[AtomicTask], execution: TaskExecutionResult) -> ParseCommandResponse:
    return ParseCommandResponse(
        tasks=[task_to_response(task) for task in tasks],
        asteroids=[asteroid_to_response(asteroid) for asteroid in execution.asteroids],
        bonds=[bond_to_response(bond) for bond in execution.bonds],
        selected_asteroids=[asteroid_to_response(asteroid) for asteroid in execution.selected_asteroids],
        extinguished_asteroid_ids=execution.extinguished_asteroid_ids,
        extinguished_bond_ids=execution.extinguished_bond_ids,
    )


def universe_asteroid_to_snapshot(
    asteroid: ProjectedAsteroid | Mapping[str, Any],
    *,
    galaxy_id: UUID = DEFAULT_GALAXY_ID,
) -> UniverseAsteroidSnapshot:
    if isinstance(asteroid, Mapping):
        metadata = asteroid.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        calculated_values = asteroid.get("calculated_values", {})
        if not isinstance(calculated_values, dict):
            calculated_values = {}
        active_alerts = asteroid.get("active_alerts", [])
        if not isinstance(active_alerts, list):
            active_alerts = []
        table_name_raw = asteroid.get("table_name")
        table_name = (
            table_name_raw.strip()
            if isinstance(table_name_raw, str) and table_name_raw.strip()
            else derive_table_name(value=asteroid.get("value"), metadata=metadata)
        )
        table_id = asteroid.get("table_id")
        table_uuid = table_id if isinstance(table_id, UUID) else derive_table_id(galaxy_id=galaxy_id, table_name=table_name)
        return UniverseAsteroidSnapshot(
            id=asteroid["id"],
            value=asteroid.get("value"),
            table_id=table_uuid,
            table_name=table_name,
            metadata=metadata,
            calculated_values=calculated_values,
            active_alerts=[str(alert) for alert in active_alerts],
            created_at=asteroid["created_at"],
        )

    table_name = derive_table_name(value=asteroid.value, metadata=asteroid.metadata)
    return UniverseAsteroidSnapshot(
        id=asteroid.id,
        value=asteroid.value,
        table_id=derive_table_id(galaxy_id=galaxy_id, table_name=table_name),
        table_name=table_name,
        metadata=asteroid.metadata,
        calculated_values={},
        active_alerts=[],
        created_at=asteroid.created_at,
    )


def universe_bond_to_snapshot(
    bond: ProjectedBond | Mapping[str, Any],
    *,
    asteroid_table_index: Mapping[UUID, tuple[UUID, str]] | None = None,
) -> UniverseBondSnapshot:
    table_index = asteroid_table_index or {}
    if isinstance(bond, Mapping):
        source_id = bond["source_id"]
        target_id = bond["target_id"]
        source_table_id, source_table_name = table_index.get(source_id, (DEFAULT_GALAXY_ID, "Unknown"))
        target_table_id, target_table_name = table_index.get(target_id, (DEFAULT_GALAXY_ID, "Unknown"))
        return UniverseBondSnapshot(
            id=bond["id"],
            source_id=source_id,
            target_id=target_id,
            type=bond.get("type", "RELATION"),
            source_table_id=source_table_id,
            source_table_name=source_table_name,
            target_table_id=target_table_id,
            target_table_name=target_table_name,
        )
    source_table_id, source_table_name = table_index.get(bond.source_id, (DEFAULT_GALAXY_ID, "Unknown"))
    target_table_id, target_table_name = table_index.get(bond.target_id, (DEFAULT_GALAXY_ID, "Unknown"))
    return UniverseBondSnapshot(
        id=bond.id,
        source_id=bond.source_id,
        target_id=bond.target_id,
        type=bond.type,
        source_table_id=source_table_id,
        source_table_name=source_table_name,
        target_table_id=target_table_id,
        target_table_name=target_table_name,
    )


async def resolve_galaxy_id_for_user(
    session: AsyncSession,
    *,
    user: User,
    galaxy_id: UUID | None,
) -> UUID:
    galaxy = await auth_service.resolve_user_galaxy(
        session=session,
        user_id=user.id,
        galaxy_id=galaxy_id,
    )
    return galaxy.id


@app.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    async with transactional_context(session):
        user, galaxy = await auth_service.register(
            session=session,
            email=payload.email,
            password=payload.password,
            galaxy_name=payload.galaxy_name,
        )
    await commit_if_active(session)
    token = auth_service.create_access_token(user.id)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=user_to_public(user),
        default_galaxy=galaxy_to_public(galaxy),
    )


@app.post("/auth/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    user = await auth_service.authenticate(session=session, email=payload.email, password=payload.password)
    galaxy = await auth_service.resolve_user_galaxy(session=session, user_id=user.id, galaxy_id=None)
    token = auth_service.create_access_token(user.id)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=user_to_public(user),
        default_galaxy=galaxy_to_public(galaxy),
    )


@app.get("/auth/me", response_model=UserPublic, status_code=status.HTTP_200_OK)
async def auth_me(
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    return user_to_public(current_user)


@app.patch("/auth/me/extinguish", response_model=UserPublic, status_code=status.HTTP_200_OK)
async def auth_extinguish_me(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    async with transactional_context(session):
        user = await auth_service.soft_delete_user(session=session, user=current_user)
    await commit_if_active(session)
    return user_to_public(user)


@app.get("/galaxies", response_model=list[GalaxyPublic], status_code=status.HTTP_200_OK)
async def list_galaxies(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[GalaxyPublic]:
    galaxies = await auth_service.list_galaxies(session=session, user_id=current_user.id)
    return [galaxy_to_public(galaxy) for galaxy in galaxies]


@app.post("/galaxies", response_model=GalaxyPublic, status_code=status.HTTP_201_CREATED)
async def create_galaxy(
    payload: GalaxyCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GalaxyPublic:
    async with transactional_context(session):
        galaxy = await auth_service.create_galaxy(session=session, user_id=current_user.id, name=payload.name)
    await commit_if_active(session)
    return galaxy_to_public(galaxy)


@app.patch("/galaxies/{galaxy_id}/extinguish", response_model=GalaxyPublic, status_code=status.HTTP_200_OK)
async def extinguish_galaxy(
    galaxy_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GalaxyPublic:
    async with transactional_context(session):
        galaxy = await auth_service.soft_delete_galaxy(session=session, user_id=current_user.id, galaxy_id=galaxy_id)
    await commit_if_active(session)
    return galaxy_to_public(galaxy)


@app.post("/asteroids/ingest", response_model=AsteroidResponse, status_code=status.HTTP_200_OK)
async def ingest_asteroid(
    payload: AsteroidIngestRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AsteroidResponse:
    tasks = [AtomicTask(action="INGEST", params={"value": payload.value, "metadata": payload.metadata})]
    async with transactional_context(session):
        target_galaxy_id = await resolve_galaxy_id_for_user(
            session=session,
            user=current_user,
            galaxy_id=payload.galaxy_id,
        )
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            manage_transaction=False,
        )
    await commit_if_active(session)
    if not execution.asteroids:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Asteroid ingest failed")
    return asteroid_to_response(execution.asteroids[0])


@app.patch("/asteroids/{asteroid_id}/extinguish", response_model=AsteroidResponse, status_code=status.HTTP_200_OK)
async def extinguish_asteroid(
    asteroid_id: UUID,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> AsteroidResponse:
    tasks = [AtomicTask(action="EXTINGUISH", params={"asteroid_id": str(asteroid_id)})]
    async with transactional_context(session):
        target_galaxy_id = await resolve_galaxy_id_for_user(
            session=session,
            user=current_user,
            galaxy_id=galaxy_id,
        )
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            manage_transaction=False,
        )
    await commit_if_active(session)
    if asteroid_id not in execution.extinguished_asteroid_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asteroid not found")

    deleted_asteroid = next(
        (asteroid for asteroid in execution.extinguished_asteroids if asteroid.id == asteroid_id),
        None,
    )
    if deleted_asteroid is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Extinguish result is inconsistent")
    return asteroid_to_response(deleted_asteroid)


@app.post("/bonds/link", response_model=BondResponse, status_code=status.HTTP_200_OK)
async def link_bond(
    payload: BondCreateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> BondResponse:
    tasks = [
        AtomicTask(
            action="LINK",
            params={
                "source_id": str(payload.source_id),
                "target_id": str(payload.target_id),
                "type": payload.type,
            },
        )
    ]
    async with transactional_context(session):
        target_galaxy_id = await resolve_galaxy_id_for_user(
            session=session,
            user=current_user,
            galaxy_id=payload.galaxy_id,
        )
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            manage_transaction=False,
        )
    await commit_if_active(session)
    if not execution.bonds:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Bond link failed")
    return bond_to_response(execution.bonds[0])


@app.post("/parser/execute", response_model=ParseCommandResponse, status_code=status.HTTP_200_OK)
async def parse_and_execute(
    payload: ParseCommandRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ParseCommandResponse:
    tasks = parser_service.parse(payload.command)
    if not tasks:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty command")

    async with transactional_context(session):
        target_galaxy_id = await resolve_galaxy_id_for_user(
            session=session,
            user=current_user,
            galaxy_id=payload.galaxy_id,
        )
        execution = await task_executor_service.execute_tasks(
            session=session,
            tasks=tasks,
            user_id=current_user.id,
            galaxy_id=target_galaxy_id,
            manage_transaction=False,
        )
    await commit_if_active(session)
    return execution_to_response(tasks=tasks, execution=execution)


@app.get("/universe/snapshot", response_model=UniverseSnapshotResponse, status_code=status.HTTP_200_OK)
async def universe_snapshot(
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UniverseSnapshotResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    active_asteroids, active_bonds = await universe_service.snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        as_of=as_of,
    )

    asteroid_snapshots = [
        universe_asteroid_to_snapshot(asteroid, galaxy_id=target_galaxy_id)
        for asteroid in active_asteroids
    ]
    table_index: dict[UUID, tuple[UUID, str]] = {
        asteroid.id: (asteroid.table_id, asteroid.table_name)
        for asteroid in asteroid_snapshots
    }

    return UniverseSnapshotResponse(
        asteroids=asteroid_snapshots,
        bonds=[
            universe_bond_to_snapshot(
                bond,
                asteroid_table_index=table_index,
            )
            for bond in active_bonds
        ],
    )


@app.get("/universe/tables", response_model=UniverseTablesResponse, status_code=status.HTTP_200_OK)
async def universe_tables(
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UniverseTablesResponse:
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    tables = await universe_service.tables_snapshot(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        as_of=as_of,
    )
    return UniverseTablesResponse(tables=tables)


@app.post("/io/imports", response_model=ImportRunResponse, status_code=status.HTTP_200_OK)
async def run_import_csv(
    file: UploadFile = File(...),
    mode: ImportModeSchema = Form(default=ImportModeSchema.commit),
    strict: bool = Form(default=True),
    galaxy_id: UUID | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ImportRunResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing filename")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Phase 1 import supports CSV only",
        )

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Uploaded file is empty")

    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    result = await io_service.import_csv(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        filename=file.filename,
        file_bytes=payload,
        mode=ImportMode(mode.value),
        strict=bool(strict),
    )
    return ImportRunResponse(job=import_job_to_public(result.job))


@app.get("/io/imports/{job_id}", response_model=ImportJobPublic, status_code=status.HTTP_200_OK)
async def get_import_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ImportJobPublic:
    job = await io_service.get_job_for_user(session=session, user_id=current_user.id, job_id=job_id)
    return import_job_to_public(job)


@app.get("/io/imports/{job_id}/errors", response_model=ImportErrorsResponse, status_code=status.HTTP_200_OK)
async def get_import_job_errors(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ImportErrorsResponse:
    errors = await io_service.get_job_errors(session=session, user_id=current_user.id, job_id=job_id)
    return ImportErrorsResponse(errors=[import_error_to_public(error) for error in errors])


@app.get("/io/exports/snapshot", status_code=status.HTTP_200_OK)
async def export_snapshot_csv(
    format: str = Query(default="csv"),
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    if format.lower() != "csv":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Phase 1 export supports CSV only")
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    csv_payload = await io_service.export_snapshot_csv(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        as_of=as_of,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="snapshot-{target_galaxy_id}.csv"',
    }
    return StreamingResponse(iter([csv_payload]), media_type="text/csv", headers=headers)


@app.get("/io/exports/tables", status_code=status.HTTP_200_OK)
async def export_tables_csv(
    format: str = Query(default="csv"),
    as_of: datetime | None = None,
    galaxy_id: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    if format.lower() != "csv":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Phase 1 export supports CSV only")
    target_galaxy_id = await resolve_galaxy_id_for_user(
        session=session,
        user=current_user,
        galaxy_id=galaxy_id,
    )
    csv_payload = await io_service.export_tables_csv(
        session=session,
        user_id=current_user.id,
        galaxy_id=target_galaxy_id,
        as_of=as_of,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="tables-{target_galaxy_id}.csv"',
    }
    return StreamingResponse(iter([csv_payload]), media_type="text/csv", headers=headers)
