#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "[staging-accessibility-preview-smoke] npm not found in PATH" >&2
  exit 1
fi

echo "[staging-accessibility-preview-smoke] playwright reduced-motion + keyboard smoke"
npm run test:e2e:accessibility-preview

echo
echo "[staging-accessibility-preview-smoke] PASS"
