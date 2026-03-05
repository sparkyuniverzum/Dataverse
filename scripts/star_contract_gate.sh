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
echo "[star-contract-gate] frontend contract parity (star + workspace + app gate)"
npm --prefix frontend test -- --run \
  src/components/universe/starContract.test.js \
  src/components/universe/scene/physicsSystem.test.js \
  src/components/universe/workspaceContract.test.js \
  src/components/universe/workspaceFormatters.test.js \
  src/lib/workspaceScopeContract.test.js \
  src/lib/dataverseApi.test.js

echo
echo "[star-contract-gate] PASS"
