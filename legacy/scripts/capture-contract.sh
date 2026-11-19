#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 1 ]]; then echo "Usage: $0 <backend-label>" >&2; exit 1; fi
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
label="$1"
base="${BASE_URL:-http://127.0.0.1:8080}"
directory="results/contracts/$label"
mkdir -p "$directory"
curl --fail --silent --show-error "$base/bench/json" | jq -S . > "$directory/json.json"
curl --fail --silent --show-error "$base/bench/patients?page=2" | jq -S . > "$directory/patients.json"
curl --fail --silent --show-error "$base/bench/patients/42" | jq -S . > "$directory/patient-detail.json"
curl --silent --show-error -H 'Content-Type: application/json' -d '{"patient_id":0,"visited_at":"bad","type":"bad"}' "$base/bench/visits" | jq -S . > "$directory/validation.json"
echo "Captured $directory"
