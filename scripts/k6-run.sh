#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <backend-label> <read|write|mixed> [public|auth]" >&2
  exit 1
fi
cd "$(dirname "${BASH_SOURCE[0]}")/.."
label="$1"
mode="$2"
phase="${3:-public}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p results
auth=false
[[ "$phase" == "auth" ]] && auth=true
k6 run k6/warmup.js -e BASE_URL="${BASE_URL:-http://127.0.0.1:8080}" -e AUTH="$auth" -e BENCH_TOKEN="${BENCH_TOKEN:-bench-write-token}"
k6 run k6/load.js \
  -e BASE_URL="${BASE_URL:-http://127.0.0.1:8080}" -e AUTH="$auth" -e BENCH_TOKEN="${BENCH_TOKEN:-bench-write-token}" -e MODE="$mode" \
  --summary-trend-stats="avg,min,med,p(90),p(95),p(99),max" \
  --summary-export="results/${timestamp}-${label}-${phase}-${mode}-summary.json" \
  --out "json=results/${timestamp}-${label}-${phase}-${mode}-raw.json"
