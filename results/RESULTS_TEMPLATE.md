# Medihome backend benchmark — run report

Never combine public and authenticated results in the same table.

## Run metadata

| Field | Value |
|---|---|
| UTC date/time | |
| Operator / commit | |
| VPS provider / instance | 4 vCPU, 8 GB RAM, Ubuntu 24.04 |
| Load generator | Separate host; specs and network path: |
| Backend | Laravel Octane + FrankenPHP / AdonisJS / Laravel FPM |
| Phase | Public / authenticated |
| Test order | |
| Repetition | 1 / 2 / 3 |
| Laravel / Octane / PHP / FrankenPHP | |
| AdonisJS / Lucid / Node.js | |
| PostgreSQL | |
| k6 | |
| Workers / DB connections per worker | 4 / 1 |
| CPU / memory limits | 4 vCPU / 4 GB backend; PostgreSQL 3 GB |
| Git commit and dirty state | |

## Configuration

Record all non-default environment variables, PostgreSQL settings, exact k6 stages, dataset counts, network latency, and whether write data was reset immediately before the run.

## Public results

| Backend | Workload | Repetition | Offered rate | Successful req/s | p50 | p95 | p99 | Errors | Timeouts | Dropped iterations | CPU avg/max | RSS avg/max | PG connections avg/max |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| | | | | | | | | | | | | | |

## Authenticated results

| Backend | Workload | Repetition | Offered rate | Successful req/s | p50 | p95 | p99 | Errors | Timeouts | Dropped iterations | CPU avg/max | RSS avg/max | PG connections avg/max |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| | | | | | | | | | | | | | |

## Observations and invalid runs

Document throttling, swapping, OOM/restarts, generator saturation, noisy neighbors, database checkpoints, connection waits, errors, and every discarded run. Do not extrapolate missing throughput.
