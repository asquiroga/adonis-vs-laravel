#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

backend="${1:-}"
scenario="${2:-}"
repetition="${3:-1}"
[[ "$backend" =~ ^(adonis|octane|fpm)$ && -n "$scenario" ]] || {
  echo "Usage: BASE_URL=... BENCHMARK_PASSWORD=... $0 <adonis|octane|fpm> SCENARIO [REPETITION]" >&2
  exit 2
}
: "${BASE_URL:?BASE_URL is required}"
: "${BENCHMARK_PASSWORD:?BENCHMARK_PASSWORD is required}"
command -v k6 >/dev/null || { echo 'k6 is required' >&2; exit 1; }

campaign="${CAMPAIGN:-$(date -u +%Y%m%dT%H%M%SZ)}"
pool="${DB_CONNECTION_BUDGET:-4}"
label="${campaign}/${scenario}-${backend}-pool${pool}-r${repetition}"
run_dir="${RESULTS_DIR:-results/campaigns}/$label"
mkdir -p "$run_dir"

curl_samples="$run_dir/network-baseline.csv"
echo 'sample,time_total_seconds,http_code' > "$curl_samples"
for sample in $(seq 1 20); do
  curl -sS -o /dev/null -w "$sample,%{time_total},%{http_code}\n" "$BASE_URL/bench-v2/health" >> "$curl_samples"
done
network_median_ms="$(tail -n +2 "$curl_samples" | cut -d, -f2 | sort -n | awk 'NR == 10 {lower=$1} NR == 11 {printf "%.3f", (lower + $1) * 500}')"

if [[ "${SKIP_WARMUP:-0}" != 1 && "$scenario" != login_burst ]]; then
  echo "Warm-up ${WARMUP_DURATION:-2m} at ${WARMUP_RATE:-30} req/s"
  k6 run --quiet --no-thresholds \
    -e SCENARIO=mixed_steady -e RATE="${WARMUP_RATE:-30}" -e DURATION="${WARMUP_DURATION:-2m}" \
    -e BASE_URL="$BASE_URL" -e BENCHMARK_PASSWORD="$BENCHMARK_PASSWORD" -e WRITE_RATIO="${WRITE_RATIO:-0.1}" \
    -e SEED="${SEED:-20261119}" k6/main.js >/dev/null
fi

cat > "$run_dir/metadata.env" <<EOF
timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
git_commit=$(git rev-parse HEAD)
backend=$backend
scenario=$scenario
repetition=$repetition
base_url=$BASE_URL
seed=${SEED:-20261119}
write_ratio=${WRITE_RATIO:-0.1}
workers=${APP_WORKERS:-4}
db_connection_budget=$pool
k6_version=$(k6 version | head -1)
generator=$(uname -a)
network_baseline_median_ms=$network_median_ms
EOF

args=(run --summary-export "$run_dir/summary.json"
  -e SCENARIO="$scenario" -e BASE_URL="$BASE_URL" -e BENCHMARK_PASSWORD="$BENCHMARK_PASSWORD"
  -e WRITE_RATIO="${WRITE_RATIO:-0.1}" -e SEED="${SEED:-20261119}")
[[ -n "${RATE:-}" ]] && args+=(-e RATE="$RATE")
[[ -n "${DURATION:-}" ]] && args+=(-e DURATION="$DURATION")
if [[ "${K6_RAW_OUTPUT:-0}" == 1 ]]; then args+=(--out "json=$run_dir/samples.json"); fi
echo "Running $scenario against $backend; results: $run_dir"
k6 "${args[@]}" k6/main.js >"$run_dir/k6.log" 2>&1 &
k6_pid=$!
./scripts/generator-monitor.sh "$k6_pid" "$run_dir/generator.csv" &
generator_pid=$!
set +e
wait "$k6_pid"
status=$?
set -e
wait "$generator_pid" 2>/dev/null || true

max_generator_cpu="$(awk -F, 'NR>1 && $2+0>max {max=$2+0} END {print max+0}' "$run_dir/generator.csv")"
echo "max_generator_cpu_percent=$max_generator_cpu" >> "$run_dir/metadata.env"
if awk "BEGIN {exit !($max_generator_cpu > 70)}"; then
  echo "WARNING: k6 generator exceeded 70% CPU ($max_generator_cpu%)." | tee "$run_dir/generator-warning.txt"
fi
cat "$run_dir/k6.log"
exit "$status"
