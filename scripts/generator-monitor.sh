#!/usr/bin/env bash
set -euo pipefail
pid="$1"
output="$2"
echo 'timestamp,cpu_percent,rss_kb' > "$output"
while kill -0 "$pid" 2>/dev/null; do
  read -r cpu rss < <(ps -p "$pid" -o %cpu=,rss=)
  printf '%s,%s,%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${cpu:-0}" "${rss:-0}" >> "$output"
  sleep 5
done
