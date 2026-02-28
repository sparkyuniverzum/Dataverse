#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://127.0.0.1:8000/openapi.json}"
TIMEOUT_SECONDS="${2:-60}"

start_ts=$(date +%s)

while true; do
  if curl -fsS "$URL" >/dev/null 2>&1; then
    echo "[wait_for_http] ready: $URL"
    exit 0
  fi

  now_ts=$(date +%s)
  elapsed=$((now_ts - start_ts))
  if (( elapsed >= TIMEOUT_SECONDS )); then
    echo "[wait_for_http] timeout after ${TIMEOUT_SECONDS}s: $URL" >&2
    exit 1
  fi
  sleep 1
done
