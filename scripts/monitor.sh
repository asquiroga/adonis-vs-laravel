#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

action="${1:-}"
label="${2:-}"
backend="${3:-}"
root="${RESULTS_DIR:-results/campaigns}"
run_dir="$root/$label"
pid_file="$run_dir/monitor.pid"

case "$action" in
  start)
    [[ -n "$label" && -n "$backend" ]] || { echo "Usage: $0 start LABEL BACKEND" >&2; exit 2; }
    mkdir -p "$run_dir"
    if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      echo "Monitor already running: $(cat "$pid_file")" >&2
      exit 1
    fi
    nohup ./scripts/monitor-worker.sh "$backend" "$run_dir" >"$run_dir/monitor.log" 2>&1 </dev/null &
    echo $! > "$pid_file"
    echo "Monitor PID $(cat "$pid_file"); output: $run_dir"
    ;;
  stop)
    [[ -n "$label" ]] || { echo "Usage: $0 stop LABEL" >&2; exit 2; }
    if [[ -f "$pid_file" ]]; then
      pid="$(cat "$pid_file")"
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      rm -f "$pid_file"
    fi
    docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -c \
      "SELECT calls, rows, round(total_exec_time::numeric,2) total_ms, round(mean_exec_time::numeric,2) mean_ms, left(query,300) query FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 25;" \
      > "$run_dir/pg-stat-statements.txt" 2>&1 || true
    docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -c \
      "SELECT now(), datname, numbackends, xact_commit, xact_rollback, blks_read, blks_hit, temp_files, temp_bytes, deadlocks FROM pg_stat_database WHERE datname=current_database();" \
      > "$run_dir/pg-stat-database.txt" 2>&1 || true
    echo "Monitor stopped; output: $run_dir"
    ;;
  *) echo "Usage: $0 <start LABEL BACKEND|stop LABEL>" >&2; exit 2 ;;
esac
