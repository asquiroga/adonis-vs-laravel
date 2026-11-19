#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U benchmark -d medihome_benchmark < database/reset-writes.sql
