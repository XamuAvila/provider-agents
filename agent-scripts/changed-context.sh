#!/usr/bin/env bash
# description: summarize branch, staged/unstaged files, diff statistics, and recent commits without printing file contents
set -euo pipefail

git rev-parse --is-inside-work-tree >/dev/null
printf 'branch: '; git branch --show-current
printf '\nstatus:\n'; git status --short
printf '\nunstaged-stat:\n'; git diff --stat
printf '\nstaged-stat:\n'; git diff --cached --stat
printf '\nrecent-commits:\n'; git log -5 --oneline --decorate
