#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "[staging-planet-civilization-lf-matrix-smoke] npm not found in PATH" >&2
  exit 1
fi

echo "[staging-planet-civilization-lf-matrix-smoke] playwright LF matrix staging smoke"
npm run test:e2e -- e2e/staging/planet-civilization-lf.matrix.placeholder.spec.mjs

echo
echo "[staging-planet-civilization-lf-matrix-smoke] PASS"
