#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-unit}"

run_unit_gate() {
  echo "[dev-fast-check] format check"
  npm --prefix "${ROOT_DIR}/frontend" run format:check

  echo "[dev-fast-check] targeted unit/component gate"
  npm --prefix "${ROOT_DIR}/frontend" run test -- \
    src/components/universe/civilizationInspectorModel.test.js \
    src/components/universe/WorkspaceSidebar.moonImpact.test.jsx \
    src/components/universe/QuickGridOverlay.minerals.test.jsx \
    src/components/universe/QuickGridOverlay.civilizations.test.jsx \
    src/lib/archiveWorkflowGuard.test.js
}

run_staging_gate() {
  echo "[dev-fast-check] staging e2e gate"
  "${ROOT_DIR}/scripts/staging_workspace_starlock_wizard_grid_smoke.sh"
  "${ROOT_DIR}/scripts/staging_planet_civilization_mineral_workflow_smoke.sh"
  "${ROOT_DIR}/scripts/staging_planet_civilization_lf_matrix_smoke.sh"
  "${ROOT_DIR}/scripts/staging_planet_moon_preview_smoke.sh"
}

run_full_gate() {
  run_unit_gate
  run_staging_gate
  echo "[dev-fast-check] backend integration gate"
  (
    cd "${ROOT_DIR}"
    PYTHONPATH=. pytest -q tests/test_api_integration.py
  )
}

case "${MODE}" in
  unit)
    run_unit_gate
    ;;
  staging)
    run_staging_gate
    ;;
  full)
    run_full_gate
    ;;
  *)
    cat <<'EOF'
Usage: ./scripts/dev_fast_check.sh [unit|staging|full]
  unit    -> FE format + targeted FE unit/component tests
  staging -> FE staging e2e smoke set
  full    -> unit + staging + backend integration suite
EOF
    exit 2
    ;;
esac

echo "[dev-fast-check] OK (${MODE})"
