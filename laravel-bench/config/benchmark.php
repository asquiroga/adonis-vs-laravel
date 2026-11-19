<?php

return [
    'read_token' => env('BENCH_READ_TOKEN', 'bench-read-token'),
    'write_token' => env('BENCH_WRITE_TOKEN', 'bench-write-token'),
    'session_ttl_seconds' => (int) env('BENCH_SESSION_TTL_SECONDS', 14400),
];
