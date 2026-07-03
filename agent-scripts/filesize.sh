#!/usr/bin/env bash
# description: report a file's size (bytes, human, lines) BEFORE reading it whole
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: filesize.sh <path>" >&2
  exit 2
fi

f="$1"
if [ ! -e "$f" ]; then
  echo "not found: $f" >&2
  exit 1
fi

bytes=$(wc -c < "$f" | tr -d ' ')
lines=$(wc -l < "$f" | tr -d ' ')
human=$(du -h "$f" | cut -f1)

echo "path:  $f"
echo "bytes: $bytes"
echo "human: $human"
echo "lines: $lines"
