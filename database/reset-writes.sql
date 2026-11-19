\set ON_ERROR_STOP on
DELETE FROM visits WHERE id > 500000;
SELECT setval(pg_get_serial_sequence('visits', 'id'), 500000, true);
VACUUM (ANALYZE) visits;
