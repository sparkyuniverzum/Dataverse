#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "docs/contracts/api-v1.md"
  "docs/contracts/parser-v1.md"
  "docs/contracts/table-contract-v1.md"
  "docs/upgrade/v1.md"
  "docs/release/v1-freeze-checklist.md"
  "docs/release/v1-rollout-runbook.md"
  ".env.example"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "[v1-gate] missing required file: $file" >&2
    exit 1
  fi
done

echo "[v1-gate] required artifacts present"

if rg -n --glob '!docs/**' --glob '!tests/**' "DELETE\\s+FROM" app alembic >/dev/null 2>&1; then
  echo "[v1-gate] hard delete SQL pattern found (DELETE FROM)" >&2
  rg -n --glob '!docs/**' --glob '!tests/**' "DELETE\\s+FROM" app alembic >&2 || true
  exit 1
fi

if rg -n --glob '!docs/**' --glob '!tests/**' "session\\.delete\\(" app >/dev/null 2>&1; then
  echo "[v1-gate] forbidden ORM hard delete detected (session.delete)" >&2
  rg -n --glob '!docs/**' --glob '!tests/**' "session\\.delete\\(" app >&2 || true
  exit 1
fi

echo "[v1-gate] soft-delete guard passed"
