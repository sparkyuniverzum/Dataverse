#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_PATH_INPUT="${1:-$ROOT_DIR}"
if [[ "$TARGET_PATH_INPUT" = /* ]]; then
  TARGET_PATH="$TARGET_PATH_INPUT"
else
  TARGET_PATH="$(cd "$ROOT_DIR" && realpath "$TARGET_PATH_INPUT")"
fi

echo "== ROOT RULES =="
if [[ -f "$ROOT_DIR/AGENTS.md" ]]; then
  sed -n '1,220p' "$ROOT_DIR/AGENTS.md"
else
  echo "Missing $ROOT_DIR/AGENTS.md"
fi

TARGET_DIR="$TARGET_PATH"
if [[ -f "$TARGET_DIR" ]]; then
  TARGET_DIR="$(dirname "$TARGET_DIR")"
fi

echo
echo "== LOCAL RULE CHAIN =="
CURRENT="$TARGET_DIR"
printed=0
while [[ "$CURRENT" == "$ROOT_DIR"* ]]; do
  if [[ -f "$CURRENT/AGENTS.md" && "$CURRENT" != "$ROOT_DIR" ]]; then
    echo "-- $CURRENT/AGENTS.md --"
    sed -n '1,220p' "$CURRENT/AGENTS.md"
    echo
    printed=1
  fi
  [[ "$CURRENT" == "$ROOT_DIR" ]] && break
  CURRENT="$(dirname "$CURRENT")"
done

if [[ "$printed" -eq 0 ]]; then
  echo "No local AGENTS.md found for target path: $TARGET_PATH"
fi
