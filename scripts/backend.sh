#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

action="${1:-}"
backend="${2:-}"
case "$backend" in
  octane) profile=octane; services=(laravel-octane) ;;
  adonis) profile=adonis; services=(adonis) ;;
  fpm) profile=fpm; services=(laravel-fpm nginx) ;;
  *) echo "Usage: $0 <start|stop> <octane|adonis|fpm>" >&2; exit 2 ;;
esac

case "$action" in
  start)
    docker compose --profile octane --profile adonis --profile fpm stop laravel-octane adonis laravel-fpm nginx >/dev/null 2>&1 || true
    docker compose --profile "$profile" up -d --force-recreate "${services[@]}"
    port="${APP_PORT:-8080}"
    for _ in $(seq 1 60); do
      if curl -fsS "http://127.0.0.1:${port}/bench-v2/health" | grep -q '"version":2'; then
        echo "$backend ready on port $port"
        exit 0
      fi
      sleep 1
    done
    echo "$backend failed its health check" >&2
    docker compose --profile "$profile" logs --tail=100 "${services[@]}" >&2
    exit 1
    ;;
  stop) docker compose --profile "$profile" stop "${services[@]}" ;;
  *) echo "Usage: $0 <start|stop> <octane|adonis|fpm>" >&2; exit 2 ;;
esac
