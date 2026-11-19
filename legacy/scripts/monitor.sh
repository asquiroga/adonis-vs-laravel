#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
label="${1:-run}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p monitoring
stats="monitoring/${timestamp}-${label}-containers.csv"
pg="monitoring/${timestamp}-${label}-postgres.log"
echo 'timestamp,name,cpu_percent,mem_usage,net_io,block_io,pids' > "$stats"
trap 'exit 0' INT TERM
while true; do
  now="$(date -u +%FT%TZ)"
  docker stats --no-stream --format "${now},{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}" >> "$stats"
  {
    echo "timestamp=$now"
    docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -X -At -c "SELECT json_build_object('connections',count(*),'active',count(*) FILTER (WHERE state='active'),'waiting',count(*) FILTER (WHERE wait_event IS NOT NULL)) FROM pg_stat_activity WHERE datname=current_database();"
    docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -X -At -c "SELECT json_build_object('commits',xact_commit,'rollbacks',xact_rollback,'reads',blks_read,'hits',blks_hit,'temp_bytes',temp_bytes,'deadlocks',deadlocks) FROM pg_stat_database WHERE datname=current_database();"
  } >> "$pg"
  sleep 5
done
