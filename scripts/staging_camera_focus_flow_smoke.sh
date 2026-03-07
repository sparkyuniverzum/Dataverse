#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "[staging-camera-focus-flow-smoke] npm not found in PATH" >&2
  exit 1
fi

echo "[staging-camera-focus-flow-smoke] playwright camera focus flow smoke"
npm run test:e2e:camera-focus-flow

echo
echo "[staging-camera-focus-flow-smoke] PASS"
