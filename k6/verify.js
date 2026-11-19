import http from 'k6/http'
import { check } from 'k6'
import { baseUrl, headers, prefix } from './lib/config.js'

export const options = { vus: 1, iterations: 1, thresholds: { checks: ['rate==1'] } }

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 404, 422))

export default function () {
  let response = http.get(`${baseUrl}${prefix}/json`, { headers })
  check(response, { 'json 200 and fixed body': (r) => r.status === 200 && r.json('service') === 'medihome-benchmark' && r.json('version') === 1 })

  response = http.get(`${baseUrl}${prefix}/patients?page=2`, { headers })
  check(response, {
    'patients 200': (r) => r.status === 200,
    'patients exactly 50': (r) => r.json('data').length === 50,
    'patients stable order': (r) => r.json('data.0.id') === 51 && r.json('data.49.id') === 100,
    'pagination metadata': (r) => r.json('meta.page') === 2 && r.json('meta.total') === 100000,
  })

  response = http.get(`${baseUrl}${prefix}/patients/42`, { headers })
  check(response, {
    'patient detail 200': (r) => r.status === 200 && r.json('data.id') === 42,
    'latest visits capped': (r) => r.json('data.visits').length <= 10,
  })

  response = http.get(`${baseUrl}${prefix}/patients/999999`, { headers })
  check(response, { 'not found contract': (r) => r.status === 404 && r.json('error.code') === 'not_found' })

  response = http.post(`${baseUrl}${prefix}/visits`, JSON.stringify({ patient_id: 42, visited_at: '2026-01-15T12:30:45.123Z', type: 'consultation', notes: 'k6 functional check' }), { headers })
  check(response, { 'create 201': (r) => r.status === 201, 'created shape': (r) => r.json('data.patient_id') === 42 && r.json('data.type') === 'consultation' })

  response = http.post(`${baseUrl}${prefix}/visits`, JSON.stringify({ patient_id: 0, visited_at: 'bad', type: 'bad' }), { headers })
  check(response, { 'validation contract': (r) => r.status === 422 && r.json('error.code') === 'validation_error' })
}
