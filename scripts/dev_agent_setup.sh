#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARK_START="# >>> dataverse-dev >>>"
MARK_END="# <<< dataverse-dev <<<"
BASHRC="${HOME}/.bashrc"

ALIAS_BLOCK="$(cat <<EOF
${MARK_START}
export DATAVERSE_ROOT="${ROOT_DIR}"
alias dv='cd "${ROOT_DIR}"'
alias dff='npm --prefix "${ROOT_DIR}/frontend"'
alias dvt='cd "${ROOT_DIR}" && PYTHONPATH=. pytest -q'
alias dvg='cd "${ROOT_DIR}" && git status --short'
alias dwd='cd "${ROOT_DIR}" && git diff --stat'
alias dvfast='cd "${ROOT_DIR}" && ./scripts/dev_fast_check.sh unit'
alias dve2e='cd "${ROOT_DIR}" && ./scripts/dev_fast_check.sh staging'
${MARK_END}
EOF
)"

print_help() {
  cat <<'EOF'
Dataverse agent setup

Usage:
  ./scripts/dev_agent_setup.sh           # preview only (no file changes)
  ./scripts/dev_agent_setup.sh --apply   # write aliases to ~/.bashrc
  ./scripts/dev_agent_setup.sh --remove  # remove Dataverse alias block from ~/.bashrc

Recommended after --apply:
  source ~/.bashrc
  dv
  dvg
  dvfast
EOF
}

remove_block() {
  if [[ ! -f "${BASHRC}" ]]; then
    return
  fi
  local tmp
  tmp="$(mktemp)"
  awk -v s="${MARK_START}" -v e="${MARK_END}" '
    $0==s {skip=1; next}
    $0==e {skip=0; next}
    !skip {print}
  ' "${BASHRC}" > "${tmp}"
  mv "${tmp}" "${BASHRC}"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_help
  exit 0
fi

if [[ "${1:-}" == "--remove" ]]; then
  remove_block
  echo "Removed Dataverse alias block from ${BASHRC}."
  exit 0
fi

if [[ "${1:-}" != "--apply" ]]; then
  print_help
  echo
  echo "Preview alias block:"
  echo "${ALIAS_BLOCK}"
  exit 0
fi

touch "${BASHRC}"
remove_block
{
  echo
  echo "${ALIAS_BLOCK}"
} >> "${BASHRC}"

echo "Dataverse alias block installed into ${BASHRC}."
echo "Run: source ~/.bashrc"
