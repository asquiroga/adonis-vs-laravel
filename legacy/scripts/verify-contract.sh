#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
auth="${AUTH:-false}"
k6 run legacy/k6/verify.js -e BASE_URL="${BASE_URL:-http://127.0.0.1:8080}" -e AUTH="$auth" -e BENCH_TOKEN="${BENCH_TOKEN:-bench-write-token}"
