from __future__ import annotations

import os
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.parser2 import Parser2ExecutorBridge, Parser2SemanticPlanner
from app.core.task_executor.service import TaskExecutorService
from app.db import AsyncSessionLocal, dispose_db_engines
from app.modules.auth.service import AuthService
from app.services.bond_dashboard_service import BondDashboardService
from app.services.constellation_dashboard_service import ConstellationDashboardService
from app.services.cosmos_service import CosmosService
from app.services.event_consumers import OnboardingBootstrapConsumer, OutboxConsumerRegistry
from app.services.event_store_service import EventStoreService
from app.services.galaxy_dashboard_service import GalaxyDashboardService
from app.services.galaxy_lifecycle_service import GalaxyLifecycleService
from app.services.idempotency_service import IdempotencyService
from app.services.io_service import ImportExportService
from app.services.moon_dashboard_service import MoonDashboardService
from app.services.onboarding_service import OnboardingService
from app.services.outbox.operator import OutboxOperatorService
from app.services.outbox.publisher import InProcessOutboxPublisher
from app.services.outbox.relay import OutboxRelayService
from app.services.outbox.runner import OutboxRelayRunnerService
from app.services.parser_legacy_service import ParserService
from app.services.planet_dashboard_service import PlanetDashboardService
from app.services.preset_bundle_service import PresetBundleService
from app.services.runtime_shutdown_service import RuntimeShutdownService
from app.services.schema_preset_service import SchemaPresetService
from app.services.star_core_service import StarCoreService
from app.services.universe_service import UniverseService


@dataclass(frozen=True)
class ServiceContainer:
    event_store: EventStoreService
    outbox_relay_service: OutboxRelayService
    outbox_relay_runner_service: OutboxRelayRunnerService
    outbox_operator_service: OutboxOperatorService
    universe_service: UniverseService
    parser_service: ParserService
    parser2_planner: Parser2SemanticPlanner
    parser2_executor_bridge: Parser2ExecutorBridge
    task_executor_service: TaskExecutorService
    auth_service: AuthService
    io_service: ImportExportService
    cosmos_service: CosmosService
    galaxy_dashboard_service: GalaxyDashboardService
    constellation_dashboard_service: ConstellationDashboardService
    planet_dashboard_service: PlanetDashboardService
    moon_dashboard_service: MoonDashboardService
    bond_dashboard_service: BondDashboardService
    idempotency_service: IdempotencyService
    onboarding_service: OnboardingService
    outbox_consumer_registry: OutboxConsumerRegistry
    schema_preset_service: SchemaPresetService
    preset_bundle_service: PresetBundleService
    star_core_service: StarCoreService
    galaxy_lifecycle_service: GalaxyLifecycleService


_SERVICE_SINGLETON: ServiceContainer | None = None
LOCAL_FRONTEND_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
]


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.accepting_requests = True
        app.state.shutdown_in_progress = False
        app.state.shutdown_summary = None
        yield
        app.state.accepting_requests = False
        app.state.shutdown_in_progress = True
        services: ServiceContainer = app.state.services
        shutdown_service = RuntimeShutdownService(
            task_executor_service=services.task_executor_service,
            outbox_relay_runner_service=services.outbox_relay_runner_service,
            session_factory=AsyncSessionLocal,
            dispose_db_engines=dispose_db_engines,
            timeout_seconds=float(os.getenv("DATAVERSE_SHUTDOWN_TIMEOUT_SECONDS", "20")),
            outbox_requeue_limit=int(os.getenv("DATAVERSE_SHUTDOWN_REQUEUE_LIMIT", "512")),
            outbox_relay_batch_size=int(os.getenv("DATAVERSE_SHUTDOWN_RELAY_BATCH_SIZE", "256")),
        )
        app.state.shutdown_summary = await shutdown_service.shutdown()

    app = FastAPI(title="DataVerse API", version="0.3.0-auth-multitenant", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=LOCAL_FRONTEND_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.services = get_or_create_services()
    return app


def create_services() -> ServiceContainer:
    event_store = EventStoreService()
    universe_service = UniverseService(event_store=event_store)
    parser_service = ParserService()
    parser2_planner = Parser2SemanticPlanner()
    parser2_executor_bridge = Parser2ExecutorBridge()
    task_executor_service = TaskExecutorService(event_store=event_store, universe_service=universe_service)
    auth_service = AuthService()
    io_service = ImportExportService(task_executor=task_executor_service, universe_service=universe_service)
    cosmos_service = CosmosService()
    galaxy_dashboard_service = GalaxyDashboardService(projector=task_executor_service.read_model_projector)
    constellation_dashboard_service = ConstellationDashboardService(universe_service=universe_service)
    planet_dashboard_service = PlanetDashboardService(universe_service=universe_service)
    moon_dashboard_service = MoonDashboardService(universe_service=universe_service)
    bond_dashboard_service = BondDashboardService(universe_service=universe_service)
    idempotency_service = IdempotencyService()
    onboarding_service = OnboardingService()
    outbox_consumer_registry = OutboxConsumerRegistry(
        bindings={
            "user.created": (OnboardingBootstrapConsumer(onboarding_service=onboarding_service),),
        }
    )
    outbox_relay_service = OutboxRelayService(
        event_store=event_store,
        publisher=InProcessOutboxPublisher(registry=outbox_consumer_registry),
    )
    outbox_relay_runner_service = OutboxRelayRunnerService(relay_service=outbox_relay_service)
    outbox_operator_service = OutboxOperatorService(runner=outbox_relay_runner_service)
    schema_preset_service = SchemaPresetService(
        universe_service=universe_service,
        cosmos_service=cosmos_service,
        task_executor_service=task_executor_service,
    )
    preset_bundle_service = PresetBundleService(
        schema_preset_service=schema_preset_service,
        universe_service=universe_service,
        task_executor_service=task_executor_service,
    )
    galaxy_lifecycle_service = GalaxyLifecycleService()
    return ServiceContainer(
        event_store=event_store,
        outbox_relay_service=outbox_relay_service,
        outbox_relay_runner_service=outbox_relay_runner_service,
        outbox_operator_service=outbox_operator_service,
        universe_service=universe_service,
        parser_service=parser_service,
        parser2_planner=parser2_planner,
        parser2_executor_bridge=parser2_executor_bridge,
        task_executor_service=task_executor_service,
        auth_service=auth_service,
        io_service=io_service,
        cosmos_service=cosmos_service,
        galaxy_dashboard_service=galaxy_dashboard_service,
        constellation_dashboard_service=constellation_dashboard_service,
        planet_dashboard_service=planet_dashboard_service,
        moon_dashboard_service=moon_dashboard_service,
        bond_dashboard_service=bond_dashboard_service,
        idempotency_service=idempotency_service,
        onboarding_service=onboarding_service,
        outbox_consumer_registry=outbox_consumer_registry,
        schema_preset_service=schema_preset_service,
        preset_bundle_service=preset_bundle_service,
        star_core_service=StarCoreService(
            event_store=event_store,
            universe_service=universe_service,
            constellation_dashboard_service=constellation_dashboard_service,
        ),
        galaxy_lifecycle_service=galaxy_lifecycle_service,
    )


def get_or_create_services() -> ServiceContainer:
    global _SERVICE_SINGLETON
    if _SERVICE_SINGLETON is None:
        _SERVICE_SINGLETON = create_services()
    return _SERVICE_SINGLETON
