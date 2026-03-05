#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select

from app.db import AsyncSessionLocal
from app.models import Atom, Galaxy, User
from app.services.auth_service import AuthService
from app.services.parser_service import AtomicTask
from app.services.task_executor_service import TaskExecutorService

SEED_GALAXY_NAME = "Axiom Effective Usage"
SEED_USER_EMAIL = "seed@dataverse.local"
SEED_USER_PASSWORD = "Dataverse123!"


@dataclass(frozen=True)
class MoonSeed:
    label: str
    table: str
    metadata: dict[str, Any]


MOON_SEEDS: list[MoonSeed] = [
    MoonSeed("Prijmy", "Finance > Cashflow", {"castka": 8000, "kanal": "mix"}),
    MoonSeed("Vydaje", "Finance > Cashflow", {"castka": -5100, "kanal": "mix"}),
    MoonSeed("Rezerva", "Finance > Cashflow", {"cil": 10000, "aktualne": 2800}),
    MoonSeed("Srouby", "Operace > Sklad", {"mnozstvi": 1200, "minimum": 400, "zona": "A1"}),
    MoonSeed("Hrebiky", "Operace > Sklad", {"mnozstvi": 800, "minimum": 300, "zona": "A2"}),
    MoonSeed("Desky", "Operace > Sklad", {"mnozstvi": 260, "minimum": 120, "zona": "B1"}),
    MoonSeed("Erik", "Lide > Zamestnanci", {"role": "skladnik", "team": "Operace"}),
    MoonSeed("Eva", "Lide > Zamestnanci", {"role": "nakup", "team": "Operace"}),
    MoonSeed("Petr", "Lide > Zamestnanci", {"role": "finance", "team": "Finance"}),
]


FLOW_SEEDS: list[tuple[str, str]] = [
    ("Prijmy", "Rezerva"),
    ("Vydaje", "Rezerva"),
]


RELATION_SEEDS: list[tuple[str, str]] = [
    ("Erik", "Srouby"),
    ("Eva", "Hrebiky"),
    ("Petr", "Desky"),
]


@asynccontextmanager
async def _session_tx(session):
    if session.in_transaction():
        async with session.begin_nested():
            yield
        return
    async with session.begin():
        yield


async def resolve_target_user_and_galaxy() -> tuple[UUID, UUID]:
    auth_service = AuthService()
    target_email = str(os.getenv("SEED_TARGET_EMAIL") or "").strip().lower()
    seed_email = str(os.getenv("SEED_USER_EMAIL") or SEED_USER_EMAIL).strip().lower()
    seed_password = str(os.getenv("SEED_USER_PASSWORD") or SEED_USER_PASSWORD)
    galaxy_name = str(os.getenv("SEED_GALAXY_NAME") or SEED_GALAXY_NAME).strip() or SEED_GALAXY_NAME
    async with AsyncSessionLocal() as session:
        user = None
        galaxy = None
        created_entities = False

        if target_email:
            user = (
                await session.execute(
                    select(User)
                    .where(
                        and_(
                            User.deleted_at.is_(None),
                            User.is_active.is_(True),
                            User.email == target_email,
                        )
                    )
                    .limit(1)
                )
            ).scalar_one_or_none()
            if user is None:
                raise RuntimeError(f"Target user not found for SEED_TARGET_EMAIL={target_email}")
        else:
            user = (
                await session.execute(
                    select(User).where(
                        and_(
                            User.deleted_at.is_(None),
                            User.is_active.is_(True),
                            User.email == seed_email,
                        )
                    )
                )
            ).scalar_one_or_none()
            if user is None:
                async with _session_tx(session):
                    user, galaxy = await auth_service.register(
                        session=session,
                        email=seed_email,
                        password=seed_password,
                        galaxy_name=galaxy_name,
                    )
                created_entities = True

        if galaxy is None and user is not None:
            galaxy = (
                await session.execute(
                    select(Galaxy)
                    .where(
                        and_(
                            Galaxy.owner_id == user.id,
                            Galaxy.deleted_at.is_(None),
                            Galaxy.name == galaxy_name,
                        )
                    )
                    .order_by(Galaxy.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if galaxy is None:
                async with _session_tx(session):
                    galaxy = await auth_service.create_galaxy(
                        session=session,
                        user_id=user.id,
                        name=galaxy_name,
                    )
                created_entities = True

        if created_entities:
            await session.commit()

        if user is None or galaxy is None:
            raise RuntimeError("Cannot resolve seed target user or galaxy")
        return user.id, galaxy.id


async def ingest_moon(
    *,
    executor: TaskExecutorService,
    session,
    user_id: UUID,
    galaxy_id: UUID,
    value: str,
    metadata: dict[str, Any],
) -> UUID:
    result = await executor.execute_tasks(
        session=session,
        tasks=[AtomicTask(action="INGEST", params={"value": value, "metadata": metadata})],
        user_id=user_id,
        galaxy_id=galaxy_id,
        manage_transaction=False,
    )
    if result.asteroids:
        return result.asteroids[-1].id

    row = (
        await session.execute(
            select(Atom)
            .where(
                and_(
                    Atom.user_id == user_id,
                    Atom.galaxy_id == galaxy_id,
                    Atom.is_deleted.is_(False),
                    Atom.value == value,
                )
            )
            .order_by(Atom.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if row is None:
        raise RuntimeError(f"Failed to resolve moon id for '{value}'")
    return row.id


async def seed_effective_usage() -> None:
    user_id, galaxy_id = await resolve_target_user_and_galaxy()
    executor = TaskExecutorService()

    async with AsyncSessionLocal() as session:
        async with session.begin():
            moon_ids: dict[str, UUID] = {}

            for seed in MOON_SEEDS:
                metadata = {"table": seed.table, **seed.metadata}
                moon_ids[seed.label] = await ingest_moon(
                    executor=executor,
                    session=session,
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    value=seed.label,
                    metadata=metadata,
                )

            for source_label, target_label in FLOW_SEEDS:
                await executor.execute_tasks(
                    session=session,
                    tasks=[
                        AtomicTask(
                            action="LINK",
                            params={
                                "source_id": str(moon_ids[source_label]),
                                "target_id": str(moon_ids[target_label]),
                                "type": "FLOW",
                            },
                        )
                    ],
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    manage_transaction=False,
                )

            for source_label, target_label in RELATION_SEEDS:
                await executor.execute_tasks(
                    session=session,
                    tasks=[
                        AtomicTask(
                            action="LINK",
                            params={
                                "source_id": str(moon_ids[source_label]),
                                "target_id": str(moon_ids[target_label]),
                                "type": "RELATION",
                            },
                        )
                    ],
                    user_id=user_id,
                    galaxy_id=galaxy_id,
                    manage_transaction=False,
                )

            await executor.execute_tasks(
                session=session,
                tasks=[
                    AtomicTask(
                        action="SET_FORMULA",
                        params={
                            "target": str(moon_ids["Rezerva"]),
                            "field": "saldo",
                            "formula": "=SUM(castka)",
                        },
                    ),
                    AtomicTask(
                        action="ADD_GUARDIAN",
                        params={
                            "target": str(moon_ids["Rezerva"]),
                            "field": "saldo",
                            "operator": "<",
                            "threshold": 3000,
                            "action": "cash_warning",
                        },
                    ),
                    AtomicTask(
                        action="ADD_GUARDIAN",
                        params={
                            "target": str(moon_ids["Desky"]),
                            "field": "mnozstvi",
                            "operator": "<",
                            "threshold": 150,
                            "action": "restock_warning",
                        },
                    ),
                ],
                user_id=user_id,
                galaxy_id=galaxy_id,
                manage_transaction=False,
            )

    print("Seed applied.")
    print(f"user_id={user_id}")
    print(f"galaxy_id={galaxy_id}")
    print("dataset=effective_usage_v1")


if __name__ == "__main__":
    asyncio.run(seed_effective_usage())
