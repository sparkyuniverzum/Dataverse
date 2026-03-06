#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTEST_BIN="${PYTEST_BIN:-./.venv/bin/pytest}"

if [[ ! -x "$PYTEST_BIN" ]]; then
  echo "[star-contract-gate] missing pytest binary: $PYTEST_BIN" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[star-contract-gate] npm not found in PATH" >&2
  exit 1
fi

echo "[star-contract-gate] backend baseline parity"
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_star_contract_baseline.py

echo
echo "[star-contract-gate] backend domain contract closure"
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_contract_docs_closure.py tests/test_domain_payload_contract_shapes.py

echo
echo "[star-contract-gate] backend contract freeze gates"
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_api_v1_openapi_freeze.py
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_galaxy_workspace_contract_baseline.py
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_moon_contract_baseline.py
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_moon_contract_freeze_gate.py
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_moon_contracts.py -k "capability_composition_order_and_conflict_policy"
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_civilization_contract_baseline.py
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_mineral_contract_baseline.py
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_semantic_constitution_contract.py
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_planet_builder_mvp_contract.py
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_parser2_spec_contract.py tests/test_parser_service.py -k "contract"
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_schemas_table_contract.py

echo
echo "[star-contract-gate] backend integration closure gates"
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_api_integration.py -k "star_core_endpoint_by_endpoint_closure_v2 or moon_first_class_crud_endpoints or moon_capability_entity_lifecycle_and_projection_convergence or contract_evolution_revalidate_backfill_mark_invalid or civilization_first_class_alias_endpoints or civilization_contract_gate_create_mutate_extinguish_and_converge or mineral_contract_gate_typing_validation_and_facts_projection or contract_violation_explainability_payload_shape or bridge_integrity_soft_delete_and_replay_convergence or release_gate_star_lock_first_planet_grid_convergence or release_gate_star_lock_first_planet_moon_lifecycle_grid_convergence or semantic_constitution_endpoint_by_endpoint_closure_v1 or auth_session_lifecycle_login_refresh_logout_and_me"
PYTHONPATH=. "$PYTEST_BIN" -q tests/test_star_core_integration_freeze.py

echo
echo "[star-contract-gate] frontend contract parity (star + workspace + parser + projection + app gate)"
npm --prefix frontend test -- --run \
  src/components/universe/starContract.test.js \
  src/components/universe/scene/physicsSystem.test.js \
  src/lib/apiV1Contract.test.js \
  src/lib/tableContract.test.js \
  src/lib/parserContract.test.js \
  src/lib/parserExecutionMode.test.js \
  src/lib/semanticConstitutionContract.test.js \
  src/lib/moonContract.test.js \
  src/components/universe/workspaceContract.test.js \
  src/components/universe/workspaceContractExplainability.test.js \
  src/components/universe/workspaceFormatters.test.js \
  src/components/universe/projectionConvergenceGate.test.js \
  src/components/universe/moonWriteDefaults.test.js \
  src/components/universe/workspaceUiPersistence.test.js \
  src/components/universe/runtimeSyncUtils.test.js \
  src/lib/hierarchy_layout.test.js \
  src/lib/builderParserCommand.test.js \
  src/lib/workspaceScopeContract.test.js \
  src/lib/dataverseApi.test.js

echo
echo "[star-contract-gate] PASS"
