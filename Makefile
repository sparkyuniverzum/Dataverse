.PHONY: install db-up migrate migrate-status migrate-check up up-d api down down-v logs wait-api migrate-local run-local test-backend-unit test-backend-integration test-backend test-frontend test test-contracts test-contracts-v2 parser2-release-gate ops-smoke v1-release-gate v1-release-full be-gate be-gate-quick be-gate-strict

install:
	./.venv/bin/pip install -r requirements.txt

db-up:
	docker compose up -d db

migrate:
	docker compose run --rm migrate

migrate-status:
	docker compose run --rm --entrypoint alembic migrate current

migrate-check:
	docker compose run --rm --entrypoint sh migrate -lc "alembic upgrade head && alembic current"

up:
	docker compose up --build

up-d:
	docker compose up --build -d

api:
	docker compose up --build api

down:
	docker compose down

down-v:
	docker compose down -v

logs:
	docker compose logs -f

wait-api:
	./scripts/wait_for_http.sh http://127.0.0.1:$${API_PORT:-8000}/openapi.json 90

migrate-local:
	DATABASE_URL=$${DATABASE_URL:-postgresql+asyncpg://dataverse:dataverse@localhost:55432/dataverse} ./.venv/bin/alembic upgrade head

run-local:
	DATABASE_URL=$${DATABASE_URL:-postgresql+asyncpg://dataverse:dataverse@localhost:55432/dataverse} ./.venv/bin/uvicorn app.main:app --reload

test-backend-unit:
	./.venv/bin/pip install -r requirements-dev.txt
	./.venv/bin/pytest -q tests/test_parser_service.py tests/test_calc_service.py

test-backend-integration:
	@set -e; \
	trap 'docker compose down' EXIT; \
	docker compose up -d --build api; \
	$(MAKE) wait-api; \
	./.venv/bin/pip install -r requirements-dev.txt; \
	./.venv/bin/pytest -q tests/test_api_integration.py

test-contracts:
	@set -e; \
	trap 'docker compose down' EXIT; \
	docker compose up -d --build api; \
	$(MAKE) wait-api; \
	./.venv/bin/pip install -r requirements-dev.txt; \
	./.venv/bin/pytest tests/test_api_integration.py -q -k "snapshot_v1_contract or tables_v1_contract"

test-contracts-v2:
	@set -e; \
	trap 'docker compose down' EXIT; \
	docker compose up -d --build api; \
	$(MAKE) wait-api; \
	./.venv/bin/pip install -r requirements-dev.txt; \
	./.venv/bin/pytest -q tests/test_parser2_spec_contract.py tests/test_parser2_lexer.py tests/test_parser2_ast.py tests/test_parser2_planner.py tests/test_parser2_resolver.py; \
	DATAVERSE_API_BASE=http://127.0.0.1:$${API_PORT:-8000} ./.venv/bin/pytest -q tests/test_api_integration.py -k "parser_v2_contract_gate or parser_v2_legacy_ or parser_v2_resolves_existing_names_to_ids_without_ingest or parser_v2_returns_bridge_error_for_mixed_id_and_name_selectors"

parser2-release-gate: test-contracts-v2

test-backend: test-backend-unit test-backend-integration

test-frontend:
	cd frontend && npm ci && npm test

test: test-backend test-frontend

ops-smoke:
	docker compose down -v
	docker compose up -d --build api
	$(MAKE) wait-api
	./.venv/bin/pip install -r requirements-dev.txt
	./.venv/bin/pytest -q tests/test_api_integration.py -k "snapshot_v1_contract or tables_v1_contract or task_executor_rolls_back_on_failed_link or execute_tasks_rollback_after_partial_write or guardian_command_is_idempotent_for_same_rule or mutate_asteroid_occ_parallel_writes_allow_single_winner or link_parallel_same_relation_returns_single_bond or bond_mutate_replaces_type_and_preserves_single_active_edge or bond_extinguish_soft_deletes_link"
	docker compose down

v1-release-gate:
	./scripts/release_v1_gate.sh
	$(MAKE) migrate-check
	$(MAKE) test-backend-unit
	$(MAKE) test-contracts
	cd frontend && npm ci && npm test && npm run build

v1-release-full: v1-release-gate
	$(MAKE) test-backend-integration
	$(MAKE) ops-smoke

be-gate:
	./scripts/backend_quality_gate.sh quick

be-gate-quick:
	./scripts/backend_quality_gate.sh quick

be-gate-strict:
	./scripts/backend_quality_gate.sh strict
