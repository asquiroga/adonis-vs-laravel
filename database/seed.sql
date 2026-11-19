\set ON_ERROR_STOP on

SELECT crypt(:'benchmark_password', gen_salt('bf', 10)) AS benchmark_password_hash \gset

INSERT INTO patients (id, external_id, document, first_name, last_name, birth_date, email, phone, created_at, updated_at)
SELECT
    n,
    (substr(md5('patient-' || n), 1, 8) || '-' || substr(md5('patient-' || n), 9, 4) || '-4' || substr(md5('patient-' || n), 14, 3) || '-a' || substr(md5('patient-' || n), 18, 3) || '-' || substr(md5('patient-' || n), 21, 12))::uuid,
    'D' || lpad(n::text, 8, '0'),
    'Nombre' || n,
    'Apellido' || lpad((n % 5000)::text, 4, '0'),
    DATE '1940-01-01' + ((n * 37) % 28000)::integer,
    'patient' || n || '@benchmark.invalid',
    '+54911' || lpad((10000000 + n)::text, 8, '0'),
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 31536000) * INTERVAL '1 second'),
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 31536000) * INTERVAL '1 second')
FROM generate_series(1, 100000) AS s(n);

INSERT INTO benchmark_users (id, email, password_hash, role, display_name)
SELECT n, 'admin' || lpad(n::text, 3, '0') || '@benchmark.invalid', :'benchmark_password_hash', 'admin', 'Administrador ' || n
FROM generate_series(1, 20) AS s(n);

INSERT INTO benchmark_users (id, email, password_hash, role, display_name)
SELECT 20 + n, 'doctor' || lpad(n::text, 3, '0') || '@benchmark.invalid', :'benchmark_password_hash', 'doctor', 'Médico ' || n
FROM generate_series(1, 100) AS s(n);

INSERT INTO benchmark_users (id, email, password_hash, role, display_name)
SELECT 120 + n, 'reception' || lpad(n::text, 3, '0') || '@benchmark.invalid', :'benchmark_password_hash', 'reception', 'Recepción ' || n
FROM generate_series(1, 100) AS s(n);

INSERT INTO doctors (id, user_id, license_number, specialty)
SELECT n, 20 + n, 'MN-' || lpad(n::text, 6, '0'), (ARRAY['Clínica', 'Cardiología', 'Pediatría', 'Dermatología'])[(n % 4) + 1]
FROM generate_series(1, 100) AS s(n);

INSERT INTO doctor_patients (doctor_id, patient_id, assigned_at)
SELECT ((n - 1) % 100) + 1, n, TIMESTAMPTZ '2025-01-01 00:00:00+00'
FROM generate_series(1, 100000) AS s(n);

INSERT INTO doctor_patients (doctor_id, patient_id, assigned_at)
SELECT ((n + 36) % 100) + 1, n, TIMESTAMPTZ '2025-06-01 00:00:00+00'
FROM generate_series(10, 100000, 10) AS s(n)
ON CONFLICT DO NOTHING;

INSERT INTO visits (id, patient_id, doctor_id, visited_at, type, notes, created_at, updated_at)
SELECT
    n,
    (((n::bigint * 7919) % 100000) + 1)::bigint,
    (((n::bigint * 7919) % 100) + 1)::bigint,
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 63072000) * INTERVAL '1 second'),
    (ARRAY['consultation', 'follow_up', 'emergency', 'telemedicine'])[(n % 4) + 1],
    'Visita ficticia ' || n,
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 63072000) * INTERVAL '1 second'),
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + ((n % 63072000) * INTERVAL '1 second')
FROM generate_series(1, 500000) AS s(n);

INSERT INTO appointments (id, patient_id, doctor_id, scheduled_at, status, reason, created_at, updated_at)
SELECT
    n,
    (((n::bigint * 3571) % 100000) + 1)::bigint,
    (((n::bigint * 3571) % 100) + 1)::bigint,
    TIMESTAMPTZ '2026-01-01 08:00:00+00' + ((n % 365) * INTERVAL '1 day') + ((n % 36) * INTERVAL '15 minutes'),
    (ARRAY['scheduled', 'confirmed', 'completed', 'cancelled'])[(n % 4) + 1],
    'Turno ficticio ' || n,
    TIMESTAMPTZ '2025-12-01 00:00:00+00' + ((n % 2592000) * INTERVAL '1 second'),
    TIMESTAMPTZ '2025-12-01 00:00:00+00' + ((n % 2592000) * INTERVAL '1 second')
FROM generate_series(1, 200000) AS s(n);

SELECT setval(pg_get_serial_sequence('patients', 'id'), 100000, true);
SELECT setval(pg_get_serial_sequence('benchmark_users', 'id'), 220, true);
SELECT setval(pg_get_serial_sequence('doctors', 'id'), 100, true);
SELECT setval(pg_get_serial_sequence('visits', 'id'), 500000, true);
SELECT setval(pg_get_serial_sequence('appointments', 'id'), 200000, true);

ANALYZE patients;
ANALYZE benchmark_users;
ANALYZE doctors;
ANALYZE doctor_patients;
ANALYZE visits;
ANALYZE appointments;
