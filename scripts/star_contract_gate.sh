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
echo "[star-contract-gate] frontend baseline + classification parity"
npm --prefix frontend test -- --run src/components/universe/starContract.test.js

echo
echo "[star-contract-gate] PASS"
