#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "[staging-planet-civilization-mineral-workflow-smoke] npm not found in PATH" >&2
  exit 1
fi

echo "[staging-planet-civilization-mineral-workflow-smoke] playwright planet+civilization+mineral workflow smoke"
npm run test:e2e:planet-civilization-mineral-workflow

echo
echo "[staging-planet-civilization-mineral-workflow-smoke] PASS"
