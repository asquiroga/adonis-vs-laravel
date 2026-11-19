# Medihome backend benchmark

Repositorio reproducible para comparar, sin inventar resultados:

1. Laravel 13 + Eloquent + Octane + FrankenPHP.
2. AdonisJS 7 + Lucid sobre Node.js 24.
3. Laravel 13 + PHP-FPM + nginx como referencia opcional.

Cada prueba ejecuta **un solo backend** en el puerto `8080`. PostgreSQL corre en el mismo host, como en el objetivo de producción, y k6 debe ejecutarse desde otra máquina para no consumir el presupuesto del VPS.

## Campaña realista autenticada (v2)

La campaña recomendada ahora usa sesiones opacas en PostgreSQL, cookies y CSRF, roles `admin`/`doctor`/`reception`, autorización por pacientes asignados, mezcla 90/10, acceso Pareto 80/20 y escenarios de tasa abierta. La guía completa y los comandos exactos están en [`docs/V2_BENCHMARK.md`](docs/V2_BENCHMARK.md).

Los scripts públicos anteriores se conservaron sin cambios funcionales en `legacy/`. No mezclar sus resultados con v2.

## Versiones fijadas

La selección se revisó contra la documentación oficial el 19 de noviembre de 2026:

| Componente | Versión fijada | Motivo / fuente oficial |
|---|---:|---|
| Laravel skeleton | 13.11.0 | Laravel 13 requiere PHP 8.3+ y recibe soporte de seguridad hasta marzo de 2028: https://laravel.com/docs/13.x/releases |
| `laravel/framework` | 13.43.0 (lockfile) | Última estable resuelta por Composer; `composer.lock` está versionado |
| Laravel Octane | 2.25.0 (lockfile) | Integración oficial con FrankenPHP: https://laravel.com/docs/13.x/octane |
| PHP | 8.4.27 | Rama soportada por Laravel 13; imagen oficial fijada |
| FrankenPHP | 1.13.5 | Release estable de seguridad e imagen oficial fijada: https://github.com/php/frankenphp/releases/tag/v1.13.5 |
| AdonisJS core | 7.7.0 (lockfile) | AdonisJS 7 requiere Node 24: https://docs.adonisjs.com/v6-to-v7 |
| Lucid | 22.5.0 (lockfile) | ORM oficial; `package-lock.json` está versionado |
| Node.js | 24.11.1 | Requisito de despliegue actual de AdonisJS: https://docs.adonisjs.com/deployment |
| PostgreSQL | 17.12 | Imagen oficial fijada; versión madura y soportada |
| nginx | 1.28.0 | Sólo para la referencia FPM |
| k6 | 2.3.0 | Release estable fijada para el generador: https://github.com/grafana/k6/releases/tag/v2.3.0 |

Los manifiestos directos y las imágenes fijan versiones; los lockfiles conservan además toda la resolución transitiva exacta. No ejecutar `composer update` ni `npm update` durante una campaña. Para máxima inmutabilidad en una campaña formal, registrar también los digests de `docker image inspect` en la plantilla.

## Aislamiento y seguridad

- La única base autorizada es `medihome_benchmark`, dentro del volumen Docker `medihome-benchmark-pgdata`.
- PostgreSQL se publica sólo en `127.0.0.1:54329`; los backends acceden por la red interna de Compose.
- `scripts/db/reset.sh` se niega a operar si `POSTGRES_DB` tiene otro nombre.
- No hay referencias a sockets, volúmenes o servicios PostgreSQL existentes del VPS.
- No se despliega nada automáticamente. Todos los comandos siguientes se ejecutan manualmente.
- `docker compose down` no borra datos. No usar `down -v` salvo que se quiera eliminar explícitamente el volumen exclusivo del benchmark.

## Preparación exacta en Ubuntu 24.04

Instalar Docker Engine con el plugin Compose siguiendo https://docs.docker.com/engine/install/ubuntu/. Para las comprobaciones locales hacen falta `curl` y `jq`. En la máquina generadora instalar k6 2.3.0 según https://grafana.com/docs/k6/latest/set-up/install-k6/ y confirmar con `k6 version`; no cambiarlo dentro de una campaña.

En el VPS:

```bash
git clone <URL_DEL_REPOSITORIO> medihome-backend-benchmark
cd medihome-backend-benchmark
cp .env.example .env
chmod +x scripts/*.sh scripts/db/*.sh
docker compose pull postgres
docker compose up -d postgres
./scripts/db/reset.sh
```

La carga crea exactamente 100.000 pacientes y 500.000 visitas ficticias mediante `generate_series`. El esquema, restricciones e índices viven únicamente en `database/schema.sql`; ni Laravel ni Adonis ejecutan migraciones. Esto evita divergencias entre ORMs.

Verificación rápida:

```bash
docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -c '\d patients'
docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -c '\d visits'
docker compose exec -T postgres psql -U benchmark -d medihome_benchmark -c 'SELECT count(*) FROM patients; SELECT count(*) FROM visits;'
```

## Iniciar exactamente un backend

Octane + FrankenPHP:

```bash
docker compose --profile octane build laravel-octane
docker compose --profile octane up -d laravel-octane
curl -fsS http://127.0.0.1:8080/bench/json | jq
```

Detenerlo antes de cambiar:

```bash
docker compose --profile octane stop laravel-octane
docker compose --profile octane rm -f laravel-octane
```

AdonisJS:

```bash
docker compose --profile adonis build adonis
docker compose --profile adonis up -d adonis
curl -fsS http://127.0.0.1:8080/bench/json | jq
```

Referencia PHP-FPM:

```bash
docker compose --profile fpm build laravel-fpm
docker compose --profile fpm up -d laravel-fpm nginx
curl -fsS http://127.0.0.1:8080/bench/json | jq
```

Compose impedirá normalmente iniciar dos perfiles porque todos publican el mismo puerto. Antes de cada cambio comprobar `docker compose ps`.

## Presupuesto comparable

Los defaults son:

- 4 workers de aplicación (`APP_WORKERS=4`).
- Una conexión por worker para Adonis (`DB_POOL_MAX=1`); cada worker PHP atiende una solicitud y conserva como máximo su conexión activa.
- 4 vCPU y 4 GB para cada backend. En FPM, nginx recibe 0,25 vCPU/256 MB y PHP 3,75 vCPU/3.840 MB: el total sigue siendo 4 vCPU/4 GB.
- PostgreSQL comparte los 4 vCPU del VPS y tiene límite de 3 GB, `shared_buffers=1GB`, `max_connections=100` y `track_io_timing=on`.
- OPcache activo, validación de timestamps desactivada y JIT desactivado.
- Laravel usa config/route cache y sin debug ni logs de request. Adonis se compila y ejecuta en producción con logger `silent`.

Cambiar workers/pool sólo en `.env`, reconstruir/recrear los servicios y registrar el cambio. Debe mantenerse el mismo presupuesto para ambos. En un VPS de 8 GB vigilar swap y OOM; los límites dejan aproximadamente 1 GB para SO y Docker.

## Contrato HTTP común

| Método | Ruta pública | Resultado |
|---|---|---|
| GET | `/bench/json` | JSON fijo, sin DB |
| GET | `/bench/patients?page=N` | 50 filas ordenadas por `id`, páginas 1–2000 |
| GET | `/bench/patients/:id` | Paciente y hasta 10 visitas, `visited_at DESC, id DESC` |
| POST | `/bench/visits` | Validación, comprobación de paciente e inserción transaccional; HTTP 201 |

Payload de escritura:

```json
{"patient_id":42,"visited_at":"2026-01-15T12:30:45.123Z","type":"consultation","notes":"texto o null"}
```

Las fechas son UTC ISO-8601 con exactamente milisegundos (`YYYY-MM-DDTHH:mm:ss.SSSZ`). Tipos válidos: `consultation`, `follow_up`, `emergency`, `telemedicine`. Ambos ORMs ejecutan las mismas selecciones, orden, límites y validación de existencia. El detalle usa dos consultas constantes (paciente + visitas), sin N+1. No hay cache de respuestas.

## Verificación funcional antes de medir

Con el backend activo, desde la máquina generadora:

```bash
BASE_URL=http://IP_DEL_VPS:8080 ./legacy/scripts/verify-contract.sh
```

Para demostrar equivalencia byte a byte de las respuestas deterministas, resetear las escrituras, iniciar cada backend por separado y capturar:

```bash
./scripts/db/reset-writes.sh
BASE_URL=http://127.0.0.1:8080 ./legacy/scripts/capture-contract.sh octane
# detener Octane, iniciar Adonis
./scripts/db/reset-writes.sh
BASE_URL=http://127.0.0.1:8080 ./legacy/scripts/capture-contract.sh adonis
./legacy/scripts/compare-contracts.sh octane adonis
```

La captura compara JSON fijo, listado, detalle y error de validación. `legacy/k6/verify.js` además verifica creación, HTTP 201 y forma de respuesta. Ejecutar la misma secuencia para FPM si se incluye.

## Fase 2: autenticación y autorización

No mezclar con la fase pública. Las rutas son idénticas bajo `/bench-auth`. El token de lectura autoriza sólo GET; el de escritura autoriza GET y POST. Defaults de laboratorio: `bench-read-token` y `bench-write-token`; cambiarlos en `.env` antes de exponer el puerto.

```bash
AUTH=true BENCH_TOKEN=bench-write-token BASE_URL=http://IP_DEL_VPS:8080 ./legacy/scripts/verify-contract.sh
```

El middleware es equivalente en ambos proyectos y devuelve el mismo 401 (sin bearer) o 403 (token/scope incorrecto). Esta fase mide el costo del control bearer/scope, no un proveedor OAuth externo.

## Campaña k6

`legacy/scripts/k6-run.sh` hace un calentamiento separado y luego una prueba de tasa de llegada creciente. Ejecutarlo **desde otra máquina**:

```bash
BASE_URL=http://IP_DEL_VPS:8080 ./legacy/scripts/k6-run.sh octane read public
BASE_URL=http://IP_DEL_VPS:8080 ./legacy/scripts/k6-run.sh octane write public
BASE_URL=http://IP_DEL_VPS:8080 ./legacy/scripts/k6-run.sh octane mixed public
```

Antes de cada prueba de escritura o mixta comparable, en el VPS:

```bash
./scripts/db/reset-writes.sh
```

Para fase autenticada:

```bash
BASE_URL=http://IP_DEL_VPS:8080 BENCH_TOKEN=bench-write-token ./legacy/scripts/k6-run.sh octane read auth
```

Defaults: warmup 50 req/s durante 30 s; medición con 25→50 req/s (1 min), 100 req/s (2 min) y 200 req/s (2 min). Son tasas ofrecidas iniciales, no estimaciones de capacidad. Ajustar con variables, por ejemplo:

```bash
RATE_START=50 RATE_1=100 RATE_2=250 RATE_3=500 STAGE_1=2m STAGE_2=3m STAGE_3=3m MAX_VUS=2000 BASE_URL=http://IP_DEL_VPS:8080 ./legacy/scripts/k6-run.sh adonis mixed public
```

Los artefactos JSON incluyen throughput exitoso (`successful_requests`), p50 (`med`), p95, p99, errores de aplicación/HTTP, timeouts y `dropped_iterations`. Confirmar que la propia máquina k6 no satura CPU, red ni VUs. Una tasa con iteraciones descartadas no equivale a throughput alcanzado.

Hacer al menos tres repeticiones y alternar el orden para reducir sesgo térmico/temporal, por ejemplo:

1. Repetición 1: Octane → Adonis → FPM.
2. Repetición 2: Adonis → FPM → Octane.
3. Repetición 3: FPM → Octane → Adonis.

Aplicar el mismo orden rotado por separado a lectura, escritura, mixta y luego a la fase autenticada. No promediar fases ni workloads diferentes.

## CPU, memoria y PostgreSQL

Justo antes de lanzar k6, en el VPS:

```bash
./legacy/scripts/monitor.sh octane-read-r1 &
MONITOR_PID=$!
```

Al terminar:

```bash
kill "$MONITOR_PID"
wait "$MONITOR_PID" 2>/dev/null || true
```

Se generan `monitoring/*-containers.csv` (CPU, memoria, I/O, PIDs cada 5 s) y `monitoring/*-postgres.log` (conexiones, sesiones activas/en espera, commits, rollbacks, lecturas, cache hits, temporales y deadlocks). Para inspección puntual:

```bash
docker stats
docker compose exec postgres psql -U benchmark -d medihome_benchmark -c "SELECT pid,application_name,state,wait_event_type,wait_event,query FROM pg_stat_activity WHERE datname=current_database();"
docker compose exec postgres psql -U benchmark -d medihome_benchmark -c "SELECT * FROM pg_stat_database WHERE datname=current_database();"
```

Registrar también `lscpu`, `free -h`, `swapon --show`, `docker version`, `docker compose version`, los digests de imágenes, latencia entre generador/VPS y commit Git.

## Resultados

Copiar `results/RESULTS_TEMPLATE.md` por campaña. Completar configuración y resultados observados; no extrapolar requests por segundo, no ocultar errores, timeouts o iteraciones descartadas y marcar inválida cualquier ejecución con reinicios, OOM, swapping fuerte o saturación del generador.

## Limpieza segura

```bash
docker compose --profile octane --profile adonis --profile fpm down
```

Esto conserva el volumen exclusivo. Si se desea eliminarlo deliberadamente, verificar primero el nombre exacto `medihome-benchmark-pgdata` y usar `docker volume rm medihome-benchmark-pgdata`.
