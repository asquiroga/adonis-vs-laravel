#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
dump="database/baseline/medihome-benchmark.dump"
if [[ ! -f "$dump" ]]; then
  echo "Missing $dump. Run scripts/db/create-baseline.sh after scripts/db/reset.sh." >&2
  exit 1
fi
if [[ "${POSTGRES_DB:-medihome_benchmark}" != "medihome_benchmark" ]]; then
  echo "Refusing to restore an unexpected database." >&2
  exit 1
fi
docker compose exec -T postgres pg_restore -U benchmark -d medihome_benchmark --clean --if-exists --no-owner --no-privileges < "$dump"
docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -c 'ANALYZE;'
echo "Restored benchmark baseline."
