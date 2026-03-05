#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-quick}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-./.venv/bin/python}"
PYTEST_BIN="${PYTEST_BIN:-./.venv/bin/pytest}"
API_BASE="${DATAVERSE_API_BASE:-http://127.0.0.1:8000}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "[be-gate] missing python binary: $PYTHON_BIN" >&2
  exit 1
fi

if [[ ! -x "$PYTEST_BIN" ]]; then
  echo "[be-gate] missing pytest binary: $PYTEST_BIN" >&2
  exit 1
fi

if [[ "$PROFILE" != "quick" && "$PROFILE" != "strict" ]]; then
  echo "[be-gate] unsupported profile '$PROFILE' (use: quick | strict)" >&2
  exit 1
fi

run_step() {
  local title="$1"
  shift
  echo
  echo "[be-gate] >>> $title"
  "$@"
}

run_pytest() {
  PYTHONPATH=. "$PYTEST_BIN" -q "$@"
}

echo "[be-gate] profile: $PROFILE"

run_step "v1 safety policy (soft delete guard)" ./scripts/release_v1_gate.sh

mapfile -t py_files < <(git ls-files '*.py')
if [[ "${#py_files[@]}" -gt 0 ]]; then
  run_step "python compile check" "$PYTHON_BIN" -m py_compile "${py_files[@]}"
fi

run_step "parser2 pipeline" run_pytest \
  tests/test_parser2_lexer.py \
  tests/test_parser2_ast.py \
  tests/test_parser2_planner.py \
  tests/test_parser2_bridge.py \
  tests/test_parser2_resolver.py \
  tests/test_parser2_runtime_flags.py \
  tests/test_parser2_spec_contract.py

run_step "executor + schema + io error model" run_pytest \
  tests/test_task_executor_service_stage2.py \
  tests/test_schemas_table_contract.py \
  tests/test_io_service_error_model.py

run_step "calc + physics + projection parity" run_pytest \
  tests/test_calc_engine_service.py \
  tests/test_physics_engine_service.py \
  tests/test_universe_projection_errors.py \
  tests/test_read_model_projector.py

run_step "scope + auth parity" run_pytest \
  tests/test_galaxy_scope_service.py \
  tests/test_auth_service.py

run_step "star contract baseline parity (be models -> frozen baseline)" run_pytest \
  tests/test_star_contract_baseline.py

run_step "domain contract closure (docs + payload freeze)" run_pytest \
  tests/test_contract_docs_closure.py \
  tests/test_domain_payload_contract_shapes.py

if [[ "$PROFILE" == "strict" ]]; then
  run_step "api healthcheck ($API_BASE)" ./scripts/wait_for_http.sh "$API_BASE/openapi.json" 90
  run_step "api integration contract suite" env DATAVERSE_API_BASE="$API_BASE" PYTHONPATH=. "$PYTEST_BIN" -q tests/test_api_integration.py
fi

echo
echo "[be-gate] PASS ($PROFILE)"
