#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
mkdir -p database/baseline
target="database/baseline/medihome-benchmark.dump"
docker compose exec -T postgres pg_dump -U benchmark -d medihome_benchmark --format=custom --no-owner --no-privileges > "$target"
echo "Created $target"
