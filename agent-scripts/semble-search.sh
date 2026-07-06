#!/usr/bin/env bash
# description: search the current or specified codebase through the configured Semble CLI
set -euo pipefail

if [ $# -lt 1 ] || [ $# -gt 3 ]; then
  echo 'usage: semble-search.sh <query> [path] [top-k]' >&2
  exit 2
fi

query=$1
path=${2:-.}
top_k=${3:-5}
if ! [[ "$top_k" =~ ^[1-9][0-9]*$ ]]; then
  echo 'error: top-k must be a positive integer' >&2
  exit 2
fi

export HF_HOME=${HF_HOME:-$HOME/.cache/huggingface}
export XDG_CACHE_HOME=${TMPDIR:-/tmp}/provider-agents/semble-cache
mkdir -p "$XDG_CACHE_HOME"
exec semble search "$query" "$path" --top-k "$top_k"
