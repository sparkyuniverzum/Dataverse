#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTEST_BIN="${PYTEST_BIN:-./.venv/bin/pytest}"
API_BASE="${DATAVERSE_API_BASE:-http://127.0.0.1:8000}"

if [[ ! -x "$PYTEST_BIN" ]]; then
  echo "[parser-smoke] missing pytest binary: $PYTEST_BIN" >&2
  exit 1
fi

run_pytest() {
  PYTHONPATH=. "$PYTEST_BIN" -q "$@"
}

echo "[parser-smoke] [1/4] parser core unit+contract (v1 + v2)"
run_pytest \
  tests/test_parser_service.py \
  tests/test_schemas_parse_command.py \
  tests/test_parser2_lexer.py \
  tests/test_parser2_ast.py \
  tests/test_parser2_planner.py \
  tests/test_parser2_bridge.py \
  tests/test_parser2_resolver.py \
  tests/test_parser2_runtime_flags.py \
  tests/test_parser2_spec_contract.py

echo "[parser-smoke] [2/4] parser executor path"
run_pytest tests/test_task_executor_service_stage2.py

echo "[parser-smoke] [3/4] waiting for API: $API_BASE/openapi.json"
./scripts/wait_for_http.sh "$API_BASE/openapi.json" 90

echo "[parser-smoke] [4/4] parser integration subset"
DATAVERSE_API_BASE="$API_BASE" PYTHONPATH=. "$PYTEST_BIN" -q tests/test_api_integration.py -k "parser"

echo "[parser-smoke] PASS"
