\set ON_ERROR_STOP on

DELETE FROM benchmark_sessions;
DELETE FROM appointments WHERE id > 200000;
DELETE FROM visits WHERE id > 500000;
UPDATE patients
SET phone = '+54911' || lpad((10000000 + id)::text, 8, '0'),
    updated_at = TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((id % 31536000) * INTERVAL '1 second')
WHERE updated_at >= TIMESTAMPTZ '2026-01-01 00:00:00+00';
SELECT setval(pg_get_serial_sequence('visits', 'id'), 500000, true);
SELECT setval(pg_get_serial_sequence('appointments', 'id'), 200000, true);
VACUUM (ANALYZE) patients;
VACUUM (ANALYZE) visits;
VACUUM (ANALYZE) appointments;
