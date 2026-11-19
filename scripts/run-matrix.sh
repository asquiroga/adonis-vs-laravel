#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

: "${SSH_TARGET:?SSH_TARGET is required, for example vpsMedihome}"
: "${REMOTE_DIR:?REMOTE_DIR is required}"
: "${BASE_URL:?BASE_URL is required}"
: "${BENCHMARK_PASSWORD:?BENCHMARK_PASSWORD is required}"
campaign="${CAMPAIGN:-$(date -u +%Y%m%dT%H%M%SZ)}"
repetitions="${REPETITIONS:-3}"
pools="${POOLS:-4 10 20}"
scenarios="${SCENARIOS:-write_ramp mixed_peak}"
results_root="${RESULTS_DIR:-results/campaigns}"

ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && docker compose up -d postgres"

for repetition in $(seq 1 "$repetitions"); do
  if (( repetition % 2 == 1 )); then backends=(adonis octane); else backends=(octane adonis); fi
  for pool in $pools; do
    for scenario in $scenarios; do
      for backend in "${backends[@]}"; do
        label="$campaign/$scenario-$backend-pool$pool-r$repetition"
        echo "=== $label ==="
        ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && \
          docker compose --profile octane --profile adonis --profile fpm stop laravel-octane adonis laravel-fpm nginx >/dev/null 2>&1 || true; \
          ./scripts/db/restore-baseline.sh; \
          docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -c 'SELECT pg_stat_statements_reset();' >/dev/null; \
          APP_WORKERS='${APP_WORKERS:-4}' DB_CONNECTION_BUDGET='$pool' ./scripts/backend.sh start '$backend'; \
          RESULTS_DIR='$results_root' ./scripts/monitor.sh start '$label' '$backend'"

        set +e
        CAMPAIGN="$campaign" RESULTS_DIR="$results_root" DB_CONNECTION_BUDGET="$pool" \
          APP_WORKERS="${APP_WORKERS:-4}" BASE_URL="$BASE_URL" BENCHMARK_PASSWORD="$BENCHMARK_PASSWORD" \
          ./scripts/run-scenario.sh "$backend" "$scenario" "$repetition"
        run_status=$?
        set -e

        ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && RESULTS_DIR='$results_root' ./scripts/monitor.sh stop '$label'"
        mkdir -p "$results_root/$label"
        scp "$SSH_TARGET:$REMOTE_DIR/$results_root/$label/server.csv" "$results_root/$label/" || true
        scp "$SSH_TARGET:$REMOTE_DIR/$results_root/$label/pg-stat-*.txt" "$results_root/$label/" || true
        echo "k6_exit_status=$run_status" >> "$results_root/$label/metadata.env"
      done
    done
  done
done

node scripts/report.mjs "$results_root/$campaign" "$results_root/$campaign/REPORT.md"
echo "Campaign complete: $results_root/$campaign/REPORT.md"
