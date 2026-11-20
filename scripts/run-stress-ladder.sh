#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

: "${SSH_TARGET:?SSH_TARGET is required, for example vps-medihome}"
: "${REMOTE_DIR:?REMOTE_DIR is required}"
: "${BASE_URL:?BASE_URL is required}"
: "${BENCHMARK_PASSWORD:?BENCHMARK_PASSWORD is required}"

campaign="${CAMPAIGN:-stress-auth-$(date -u +%Y%m%dT%H%M%SZ)}"
rates="${RATES:-20 40 80 120 160 200}"
duration="${STEP_DURATION:-3m}"
warmup_duration="${WARMUP_DURATION:-30s}"
repetitions="${REPETITIONS:-1}"
pool="${DB_CONNECTION_BUDGET:-4}"
workers="${APP_WORKERS:-4}"
max_vus="${MAX_VUS:-300}"
results_root="${RESULTS_DIR:-results/campaigns}"
active_label=""
active_backend=""

cleanup() {
  set +e
  if [[ -n "$active_label" ]]; then
    ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && sudo env RESULTS_DIR='$results_root' ./scripts/monitor.sh stop '$active_label'"
  fi
  if [[ -n "$active_backend" ]]; then
    ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && sudo ./scripts/backend.sh stop '$active_backend'"
  fi
}
trap cleanup EXIT

ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && sudo docker compose up -d --wait postgres"

for repetition in $(seq 1 "$repetitions"); do
  if (( repetition % 2 == 1 )); then backends=(adonis octane); else backends=(octane adonis); fi

  for backend in "${backends[@]}"; do
    for rate in $rates; do
      pre_vus=$(( (rate * 3 + 3) / 4 ))
      (( pre_vus < 10 )) && pre_vus=10
      run_name="stress-$rate"
      label="$campaign/$run_name-$backend-pool$pool-r$repetition"
      run_dir="$results_root/$label"
      echo "=== $label (preVUs=$pre_vus, maxVUs=$max_vus) ==="

      # Every measured step starts from the same database and fresh backend.
      ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && \
        sudo docker compose --profile octane --profile adonis --profile fpm stop laravel-octane adonis laravel-fpm nginx >/dev/null 2>&1 || true; \
        sudo ./scripts/db/restore-baseline.sh; \
        sudo env APP_WORKERS='$workers' DB_CONNECTION_BUDGET='$pool' ./scripts/backend.sh start '$backend'"
      active_backend="$backend"

      ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && \
        sudo docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -c 'SELECT pg_stat_statements_reset();' >/dev/null; \
        sudo env RESULTS_DIR='$results_root' ./scripts/monitor.sh start '$label' '$backend'"
      active_label="$label"

      set +e
      CAMPAIGN="$campaign" RUN_NAME="$run_name" RESULTS_DIR="$results_root" \
        DB_CONNECTION_BUDGET="$pool" APP_WORKERS="$workers" BASE_URL="$BASE_URL" \
        BENCHMARK_PASSWORD="$BENCHMARK_PASSWORD" RATE="$rate" DURATION="$duration" \
        WARMUP_RATE="$rate" WARMUP_DURATION="$warmup_duration" PRE_VUS="$pre_vus" MAX_VUS="$max_vus" \
        ./scripts/run-scenario.sh "$backend" stress_step "$repetition"
      k6_status=$?
      set -e

      ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && sudo env RESULTS_DIR='$results_root' ./scripts/monitor.sh stop '$label'"
      active_label=""
      mkdir -p "$run_dir"
      scp "$SSH_TARGET:$REMOTE_DIR/$results_root/$label/server.csv" "$run_dir/" || true
      scp "$SSH_TARGET:$REMOTE_DIR/$results_root/$label/pg-stat-*.txt" "$run_dir/" || true
      echo "k6_exit_status=$k6_status" >> "$run_dir/metadata.env"

      set +e
      node scripts/evaluate-stress.mjs "$run_dir/summary.json" "$rate" "$duration" "$run_dir/verdict.json"
      verdict_status=$?
      set -e
      if (( verdict_status != 0 )); then
        echo "Step failed at $rate req/s; continuing so an isolated tail-latency breach cannot truncate the comparison."
      fi

      ssh "$SSH_TARGET" "cd '$REMOTE_DIR' && sudo ./scripts/backend.sh stop '$backend'"
      active_backend=""
    done
  done
done

node scripts/stress-report.mjs "$results_root/$campaign" "$results_root/$campaign/STRESS_REPORT.md"
echo "Stress campaign complete: $results_root/$campaign/STRESS_REPORT.md"
