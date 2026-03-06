#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "[staging-workspace-starlock-smoke] npm not found in PATH" >&2
  exit 1
fi

echo "[staging-workspace-starlock-smoke] playwright workspace->star-lock->wizard->grid smoke"
npm run test:e2e:workspace-starlock

echo
echo "[staging-workspace-starlock-smoke] PASS"
