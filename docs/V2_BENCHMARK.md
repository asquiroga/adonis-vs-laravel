# Benchmark autenticado v2

Esta campaña compara el trabajo real de una aplicación clínica: autenticación con sesión, CSRF, autorización por rol/asignación, búsquedas, agenda y escrituras transaccionales. No reemplaza ni mezcla resultados con los scripts públicos archivados en `legacy/`.

## Supuestos y decisiones

- Un único esquema SQL y seed alimenta ambos ORMs. Hay 100.000 pacientes, 500.000 visitas, 200.000 turnos, 20 admins, 100 médicos y 100 recepcionistas.
- Todos los usuarios comparten sólo en este benchmark la contraseña `BENCHMARK_PASSWORD`; el seed guarda bcrypt, nunca texto plano.
- La mezcla de VUs es 10% admin, 40% médico y 50% recepción. Cada VU inicia sesión una vez y reutiliza cookie/CSRF; `login_burst` es la única excepción.
- Los médicos tienen 1.000 pacientes primarios y una asignación secundaria para cada décimo paciente. Los 403 esperados ocurren con 1% de las lecturas de médicos por defecto.
- La selección reproducible usa `SEED`. El 80% de las selecciones cae en el 20% inicial de pacientes; 85% de páginas cae entre 1 y 3.
- `APP_WORKERS=4` queda fijo. En Adonis `DB_CONNECTION_BUDGET=10`, por ejemplo, reparte pools 3/3/2/2 entre workers. Octane/PHP no tiene un pool cliente equivalente: cada worker usa como máximo una conexión PDO activa. El reporte conserva esta diferencia; no pretende que “pool 20” cree 20 conexiones en PHP.
- No hay caché de respuestas. Las cookies no se marcan `Secure` porque el benchmark puede usar HTTP directo; si se coloca TLS delante, cambiar esa opción en ambos backends antes de una campaña nueva.

## Preparar el VPS

```bash
git pull --ff-only
cp .env.example .env                 # si aún no existe
# editar .env y definir contraseñas reales de laboratorio
chmod +x scripts/*.sh scripts/db/*.sh
docker compose pull postgres
docker compose up -d postgres
BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' ./scripts/db/reset.sh
./scripts/db/create-baseline.sh
docker compose --profile octane build laravel-octane
docker compose --profile adonis build adonis
```

`reset.sh` sólo acepta la base exclusiva `medihome_benchmark`. `create-baseline.sh` produce `database/baseline/medihome-benchmark.dump`, ignorado por Git. No ejecutar contra otra base.

Iniciar un backend y verificarlo:

```bash
APP_WORKERS=4 DB_CONNECTION_BUDGET=4 ./scripts/backend.sh start octane
BASE_URL=http://127.0.0.1:8080 BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' ./scripts/verify-v2.sh
./scripts/backend.sh stop octane

APP_WORKERS=4 DB_CONNECTION_BUDGET=4 ./scripts/backend.sh start adonis
BASE_URL=http://127.0.0.1:8080 BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' ./scripts/verify-v2.sh
./scripts/backend.sh stop adonis
```

La verificación cubre login, cookie, CSRF fallido, listado/búsqueda, detalle autorizado, 403, agenda y las tres escrituras. Restaurar el baseline después, porque intencionalmente modifica datos:

```bash
./scripts/db/restore-baseline.sh
```

Para comparar además las respuestas deterministas byte a byte, restaurar antes de cada captura y ejecutar cada backend por separado:

```bash
BASE_URL=http://127.0.0.1:8080 BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' ./scripts/capture-v2-contract.sh octane
# restaurar baseline, cambiar a Adonis
BASE_URL=http://127.0.0.1:8080 BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' ./scripts/capture-v2-contract.sh adonis
./scripts/compare-v2-contracts.sh octane adonis
```

## Ejecutar desde la Mac

Clonar el repo e instalar k6. No hace falta `.env` local: pasar secretos por el entorno. Cada corrida mide 20 solicitudes a `/health` como latencia base, hace warm-up separado de 2 minutos y luego mide.

```bash
BASE_URL=http://IP_O_HOST_DEL_VPS \
BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' \
CAMPAIGN=clinica-v2 \
./scripts/run-scenario.sh adonis mixed_steady 1
```

Escenarios disponibles:

| `SCENARIO` | Modelo por defecto |
|---|---|
| `mixed_steady` | 30 acciones/s, 30 min, 90/10 |
| `mixed_peak` | 80 acciones/s, 10 min, 90/10 |
| `write_ramp` | escrituras 25→50 (1 min), 100 (2 min), 200 (2 min) |
| `soak` | 20 acciones/s, 2 h, 90/10 |
| `login_burst` | 50 logins/s, 1 min |
| `user_session` | 30 VUs con think time determinista de 1–5 s |

Sobrescrituras útiles:

```bash
RATE=10 DURATION=2m WRITE_RATIO=0.2 SEED=42 WARMUP_DURATION=30s \
BASE_URL=http://IP_O_HOST_DEL_VPS BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' \
./scripts/run-scenario.sh octane mixed_peak 1
```

`run-scenario.sh` no restaura la base ni cambia backends: para corridas manuales, detener la app, restaurar, iniciar la app, arrancar el monitor del VPS, correr k6 y detener el monitor:

```bash
# VPS
./scripts/db/restore-baseline.sh
APP_WORKERS=4 DB_CONNECTION_BUDGET=4 ./scripts/backend.sh start adonis
./scripts/monitor.sh start clinica-v2/mixed_peak-adonis-pool4-r1 adonis

# Mac
BASE_URL=http://IP_O_HOST_DEL_VPS BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' \
CAMPAIGN=clinica-v2 ./scripts/run-scenario.sh adonis mixed_peak 1

# VPS
./scripts/monitor.sh stop clinica-v2/mixed_peak-adonis-pool4-r1
```

El monitor muestrea cada 5 s CPU, memoria de cgroup y suma de RSS de los procesos para app/PostgreSQL, conexiones, actividad y locks; al final captura `pg_stat_statements` y `pg_stat_database`. La Mac registra CPU/RSS de k6 y avisa si supera 70% CPU.

## Matriz automatizada

El alias SSH debe entrar sin interacción. La matriz predeterminada ejecuta `write_ramp` y `mixed_peak`, presupuestos 4/10/20, tres repeticiones y alterna Adonis→Octane / Octane→Adonis. Son 36 corridas largas; empezar con una campaña reducida.

```bash
SSH_TARGET=vpsMedihome \
REMOTE_DIR=/ruta/absoluta/adonis-vs-laravel \
BASE_URL=http://IP_O_HOST_DEL_VPS \
BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' \
CAMPAIGN=clinica-v2 \
./scripts/run-matrix.sh
```

Prueba reducida:

```bash
REPETITIONS=1 POOLS='4' SCENARIOS='mixed_peak' DURATION=1m WARMUP_DURATION=20s \
SSH_TARGET=vpsMedihome REMOTE_DIR=/ruta/absoluta/adonis-vs-laravel \
BASE_URL=http://IP_O_HOST_DEL_VPS BENCHMARK_PASSWORD='PASSWORD_DE_BENCHMARK' \
CAMPAIGN=smoke-v2 ./scripts/run-matrix.sh
```

Los resultados quedan en `results/campaigns/<campaña>/`. Regenerar el informe:

```bash
node scripts/report.mjs results/campaigns/clinica-v2 results/campaigns/clinica-v2/REPORT.md
```

El informe muestra mediana y rango de throughput exitoso, p50/p95/p99, errores, dropped iterations y checks. Los thresholds (`read p95 < 300 ms`, `write p95 < 600 ms`, errores `< 0,1%`) hacen fallar k6, pero no abortan anticipadamente. No interpretar la tasa ofrecida como capacidad si hay errores o iteraciones descartadas.

## Archivos y parametrización

- `k6/main.js`: acciones y escenarios v2.
- `k6/lib/`: sesión, selección determinista y métricas.
- `scripts/verify-v2.sh`: contrato funcional.
- `scripts/run-scenario.sh`: warm-up, latencia base, k6 y monitor de la Mac.
- `scripts/monitor.sh`: monitor persistente del VPS, con `start`/`stop` recuperable tras cortar SSH.
- `scripts/run-matrix.sh`: alternancia/restauración/orquestación.
- `scripts/report.mjs`: mediana y rango.
- `results/V2_RESULTS_TEMPLATE.md`: checklist manual de campaña.

Variables principales: `BASE_URL`, `BENCHMARK_PASSWORD`, `SCENARIO`, `RATE`, `DURATION`, `WRITE_RATIO`, `SEED`, `APP_WORKERS`, `DB_CONNECTION_BUDGET`, `PRE_VUS`, `MAX_VUS`, `WARMUP_RATE`, `WARMUP_DURATION`, `NEGATIVE_RATIO`.
