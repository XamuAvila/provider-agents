#!/usr/bin/env bash
# description: check patch whitespace, unresolved conflict markers, and unusually large added files
set -euo pipefail

git rev-parse --is-inside-work-tree >/dev/null
git diff --check

if rg -n '^(<<<<<<<|=======|>>>>>>>)' --glob '!node_modules/**' --glob '!build/**' --glob '!dist/**' .; then
  echo 'error: unresolved conflict markers found' >&2
  exit 1
fi

large=0
while IFS= read -r file; do
  [ -f "$file" ] || continue
  bytes=$(wc -c < "$file")
  if [ "$bytes" -gt 1048576 ]; then
    echo "large-added-file: $file ($bytes bytes)"
    large=1
  fi
done < <(git diff --name-only --diff-filter=A; git diff --cached --name-only --diff-filter=A)

exit "$large"
