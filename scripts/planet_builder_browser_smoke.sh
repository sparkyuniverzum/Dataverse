#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "[planet-builder-browser-smoke] npm not found in PATH" >&2
  exit 1
fi

echo "[planet-builder-browser-smoke] install playwright chromium"
npx playwright install chromium

echo
echo "[planet-builder-browser-smoke] run browser smoke"
npm run test:e2e:planet-builder

echo
echo "[planet-builder-browser-smoke] PASS"
