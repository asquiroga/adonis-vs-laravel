#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

backend="$1"
output="$2"
interval="${MONITOR_INTERVAL:-5}"
case "$backend" in
  octane) app_service=laravel-octane ;;
  adonis) app_service=adonis ;;
  fpm) app_service=laravel-fpm ;;
  *) echo "Unknown backend: $backend" >&2; exit 2 ;;
esac

mkdir -p "$output"
csv="$output/server.csv"
echo 'timestamp,app_cpu_percent,app_memory_usage,app_memory_percent,app_rss_bytes,postgres_cpu_percent,postgres_memory_usage,postgres_memory_percent,postgres_rss_bytes,db_connections,db_active,db_waiting,locks_waiting' > "$csv"

container_stats() {
  local container_id="$1"
  docker stats --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}' "$container_id" 2>/dev/null | tr -d '%'
}

container_rss() {
  docker exec "$1" sh -c "awk '\$1 == \"VmRSS:\" {sum += \$2} END {print sum * 1024}' /proc/[0-9]*/status" 2>/dev/null || echo 0
}

while true; do
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  app_id="$(docker compose ps -q "$app_service")"
  postgres_id="$(docker compose ps -q postgres)"
  app_stats="$(container_stats "$app_id")"
  pg_stats="$(container_stats "$postgres_id")"
  IFS='|' read -r app_cpu app_mem app_mem_percent <<< "$app_stats"
  IFS='|' read -r pg_cpu pg_mem pg_mem_percent <<< "$pg_stats"
  app_rss="$(container_rss "$app_id")"
  pg_rss="$(container_rss "$postgres_id")"
  db_values="$(docker compose exec -T postgres psql -At -U benchmark -d medihome_benchmark -c \
    "SELECT count(*), count(*) FILTER (WHERE state='active'), count(*) FILTER (WHERE state='active' AND wait_event_type IS NOT NULL), (SELECT count(*) FROM pg_locks WHERE NOT granted) FROM pg_stat_activity WHERE datname=current_database();" 2>/dev/null || echo '0|0|0|0')"
  IFS='|' read -r connections active waiting locks <<< "$db_values"
  printf '%s,%s,"%s",%s,%s,%s,"%s",%s,%s,%s,%s,%s,%s\n' \
    "$timestamp" "${app_cpu:-0}" "${app_mem:-0}" "${app_mem_percent:-0}" "$app_rss" \
    "${pg_cpu:-0}" "${pg_mem:-0}" "${pg_mem_percent:-0}" "$pg_rss" \
    "${connections:-0}" "${active:-0}" "${waiting:-0}" "${locks:-0}" >> "$csv"
  sleep "$interval"
done
