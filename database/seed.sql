\set ON_ERROR_STOP on

INSERT INTO patients (id, external_id, first_name, last_name, birth_date, email, created_at, updated_at)
SELECT
    n,
    (substr(md5('patient-' || n), 1, 8) || '-' || substr(md5('patient-' || n), 9, 4) || '-4' || substr(md5('patient-' || n), 14, 3) || '-a' || substr(md5('patient-' || n), 18, 3) || '-' || substr(md5('patient-' || n), 21, 12))::uuid,
    'Nombre' || n,
    'Apellido' || lpad((n % 5000)::text, 4, '0'),
    DATE '1940-01-01' + ((n * 37) % 28000)::integer,
    'patient' || n || '@benchmark.invalid',
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 31536000) * INTERVAL '1 second'),
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 31536000) * INTERVAL '1 second')
FROM generate_series(1, 100000) AS s(n);

INSERT INTO visits (id, patient_id, visited_at, type, notes, created_at, updated_at)
SELECT
    n,
    (((n::bigint * 7919) % 100000) + 1)::bigint,
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 63072000) * INTERVAL '1 second'),
    (ARRAY['consultation', 'follow_up', 'emergency', 'telemedicine'])[(n % 4) + 1],
    'Visita ficticia ' || n,
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 63072000) * INTERVAL '1 second'),
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 63072000) * INTERVAL '1 second')
FROM generate_series(1, 500000) AS s(n);

SELECT setval(pg_get_serial_sequence('patients', 'id'), 100000, true);
SELECT setval(pg_get_serial_sequence('visits', 'id'), 500000, true);
ANALYZE patients;
ANALYZE visits;
