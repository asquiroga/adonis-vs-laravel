# Resultados de campaña v2

## Identidad y entorno

- Campaña:
- Fecha UTC:
- Commit Git:
- Orden de backends por repetición:
- VPS / CPU / RAM / swap:
- SO / kernel:
- Docker / Compose:
- Mac generadora / k6:
- Red Mac→VPS y mediana `/bench-v2/health`:
- Digests de imágenes:

## Configuración fijada

- Laravel / Octane / FrankenPHP / PHP:
- AdonisJS / Lucid / Node:
- PostgreSQL:
- `APP_WORKERS`:
- `DB_CONNECTION_BUDGET` y reparto real por worker:
- Límites CPU/RAM:
- `SEED` / `WRITE_RATIO` / `NEGATIVE_RATIO`:
- Hash del baseline:

## Validez

- [ ] `verify-v2.sh` pasó en ambos backends antes de medir.
- [ ] Baseline restaurado antes de cada corrida.
- [ ] Warm-up completo y fuera de la medición.
- [ ] Sin reinicios, OOM ni swap fuerte.
- [ ] CPU de k6 no superó 70% (o se documentó).
- [ ] Sin saturación de red ni límite de VUs.
- [ ] Se revisaron dropped iterations, errores, timeouts y checks.
- [ ] Tres repeticiones y orden alternado.

## Comparación

Pegar aquí la tabla generada por `scripts/report.mjs`. Reportar mediana (mín–máx), nunca extrapolar capacidad.

## PostgreSQL y recursos

- CPU/RSS de app:
- CPU/RSS PostgreSQL:
- Conexiones máximas / activas:
- Locks en espera:
- Consultas dominantes de `pg_stat_statements`:
- Tendencia de memoria del soak:

## Incidentes y observaciones

- Corridas inválidas/excluidas y motivo:
- Diferencias arquitectónicas relevantes:
- Conclusiones limitadas a los datos observados:
