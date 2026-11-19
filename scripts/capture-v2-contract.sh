#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
: "${BASE_URL:?BASE_URL is required}"
: "${BENCHMARK_PASSWORD:?BENCHMARK_PASSWORD is required}"
label="${1:?Usage: $0 LABEL}"
directory="results/contracts/v2/$label"
mkdir -p "$directory"
jar="$(mktemp)"
trap 'rm -f "$jar"' EXIT

curl -fsS -c "$jar" -H 'Content-Type: application/json' \
  -d "{\"email\":\"admin001@benchmark.invalid\",\"password\":\"$BENCHMARK_PASSWORD\"}" \
  "$BASE_URL/bench-v2/auth/login" >/dev/null
curl -fsS "$BASE_URL/bench-v2/health" | jq -S . > "$directory/health.json"
curl -fsS -b "$jar" "$BASE_URL/bench-v2/auth/me" | jq -S . > "$directory/me.json"
curl -fsS -b "$jar" "$BASE_URL/bench-v2/patients?page=2" | jq -S . > "$directory/patients.json"
curl -fsS -b "$jar" "$BASE_URL/bench-v2/patients/42" | jq -S . > "$directory/patient.json"
curl -fsS -b "$jar" "$BASE_URL/bench-v2/visits/42" | jq -S . > "$directory/visit.json"
curl -fsS -b "$jar" "$BASE_URL/bench-v2/agenda?date=2026-06-15&doctor_id=1" | jq -S . > "$directory/agenda.json"
echo "Captured $directory"
