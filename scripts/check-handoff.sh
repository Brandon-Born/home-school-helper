#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git not available; skipping handoff check"
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "not a git repository; skipping handoff check"
  exit 0
fi

BASE_REF="${BASE_SHA:-}"

if [[ -z "$BASE_REF" ]]; then
  if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    git fetch origin "$GITHUB_BASE_REF" --depth=1 >/dev/null 2>&1 || true
    BASE_REF="origin/$GITHUB_BASE_REF"
  elif git rev-parse HEAD~1 >/dev/null 2>&1; then
    BASE_REF="HEAD~1"
  else
    echo "no base commit found; skipping handoff check"
    exit 0
  fi
fi

CHANGED_FILES="$(git diff --name-only "$BASE_REF"...HEAD || true)"

if [[ -z "$CHANGED_FILES" ]]; then
  echo "no changed files detected"
  exit 0
fi

if ! printf '%s\n' "$CHANGED_FILES" | grep -Eq '^(app/|src/|pages/|components/|lib/|package\.json|next\.config\.(js|mjs|cjs|ts)|tsconfig\.json|jsconfig\.json)'; then
  echo "runtime code not changed; handoff log update not required"
  exit 0
fi

if printf '%s\n' "$CHANGED_FILES" | grep -Eq '^docs/handoffs/HANDOFF_LOG\.md$'; then
  echo "handoff log updated"
  exit 0
fi

echo "runtime code changed but docs/handoffs/HANDOFF_LOG.md was not updated"
exit 1
