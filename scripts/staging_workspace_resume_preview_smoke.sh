#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "[staging-workspace-resume-preview-smoke] npm not found in PATH" >&2
  exit 1
fi

echo "[staging-workspace-resume-preview-smoke] playwright workspace resume preview smoke"
npm run test:e2e:workspace-resume-preview

echo
echo "[staging-workspace-resume-preview-smoke] PASS"
