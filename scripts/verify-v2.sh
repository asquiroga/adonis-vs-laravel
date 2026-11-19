#!/usr/bin/env bash
set -euo pipefail
: "${BASE_URL:?BASE_URL is required}"
: "${BENCHMARK_PASSWORD:?BENCHMARK_PASSWORD is required}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

login() {
  local role="$1" number="$2"
  local jar="$tmp_dir/$role.cookies" body="$tmp_dir/$role.json"
  curl -fsS -c "$jar" -H 'Content-Type: application/json' \
    -d "{\"email\":\"${role}$(printf '%03d' "$number")@benchmark.invalid\",\"password\":\"$BENCHMARK_PASSWORD\"}" \
    "$BASE_URL/bench-v2/auth/login" > "$body"
  jq -er '.data.csrf_token' "$body"
}

admin_csrf="$(login admin 1)"
doctor_csrf="$(login doctor 1)"
reception_csrf="$(login reception 1)"

curl -fsS "$BASE_URL/bench-v2/health" | jq -e '.version == 2 and .status == "ok"' >/dev/null
curl -fsS -b "$tmp_dir/admin.cookies" "$BASE_URL/bench-v2/patients?page=1&search=D00000001" | jq -e '.data[0].id == 1 and .meta.total == 1' >/dev/null
curl -fsS -b "$tmp_dir/doctor.cookies" "$BASE_URL/bench-v2/patients/1" | jq -e '.data.id == 1 and (.data.visits | length) <= 10' >/dev/null
status="$(curl -sS -o "$tmp_dir/forbidden.json" -w '%{http_code}' -b "$tmp_dir/doctor.cookies" "$BASE_URL/bench-v2/patients/2")"
[[ "$status" == 403 ]] && jq -e '.error.code == "forbidden"' "$tmp_dir/forbidden.json" >/dev/null
curl -fsS -b "$tmp_dir/admin.cookies" "$BASE_URL/bench-v2/agenda?date=2026-06-15&doctor_id=1" | jq -e '.meta.doctor_id == 1' >/dev/null

status="$(curl -sS -o "$tmp_dir/csrf.json" -w '%{http_code}' -b "$tmp_dir/admin.cookies" -H 'Content-Type: application/json' -d '{}' "$BASE_URL/bench-v2/visits")"
[[ "$status" == 419 ]] && jq -e '.error.code == "csrf_failed"' "$tmp_dir/csrf.json" >/dev/null

curl -fsS -b "$tmp_dir/doctor.cookies" -H "X-CSRF-TOKEN: $doctor_csrf" -H 'Content-Type: application/json' \
  -d '{"patient_id":1,"doctor_id":1,"visited_at":"2026-06-15T12:00:00.000Z","type":"consultation","notes":"contract"}' \
  "$BASE_URL/bench-v2/visits" | jq -e '.data.patient_id == 1 and .data.doctor_id == 1' >/dev/null
curl -fsS -X PATCH -b "$tmp_dir/reception.cookies" -H "X-CSRF-TOKEN: $reception_csrf" -H 'Content-Type: application/json' \
  -d '{"phone":"+5491112345678"}' "$BASE_URL/bench-v2/patients/1" | jq -e '.data.phone == "+5491112345678"' >/dev/null
curl -fsS -b "$tmp_dir/admin.cookies" -H "X-CSRF-TOKEN: $admin_csrf" -H 'Content-Type: application/json' \
  -d '{"patient_id":1,"doctor_id":1,"scheduled_at":"2026-06-16T10:00:00.000Z","reason":"contract"}' \
  "$BASE_URL/bench-v2/appointments" | jq -e '.data.patient_id == 1 and .data.status == "scheduled"' >/dev/null

echo 'v2 contract, authentication, CSRF, authorization, reads and writes: OK'
