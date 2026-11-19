#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
if [[ -f .env ]]; then
  source .env
fi
: "${POSTGRES_DB:=medihome_benchmark}"
if [[ "$POSTGRES_DB" != "medihome_benchmark" ]]; then
  echo "Refusing to reset unexpected database: $POSTGRES_DB" >&2
  exit 1
fi
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U benchmark -d medihome_benchmark < database/schema.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U benchmark -d medihome_benchmark < database/seed.sql
docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -c "SELECT (SELECT count(*) FROM patients) patients, (SELECT count(*) FROM visits) visits;"
