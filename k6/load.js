import http from 'k6/http'
import { check } from 'k6'
import { baseUrl, headers, prefix, record } from './lib/config.js'

const mode = __ENV.MODE || 'read'
const startRate = Number(__ENV.RATE_START || 25)
const preAllocatedVUs = Number(__ENV.PRE_ALLOCATED_VUS || 100)
const maxVUs = Number(__ENV.MAX_VUS || 1000)

export const options = {
  discardResponseBodies: false,
  scenarios: {
    measured: {
      executor: 'ramping-arrival-rate',
      startRate,
      timeUnit: '1s',
      preAllocatedVUs,
      maxVUs,
      stages: [
        { target: Number(__ENV.RATE_1 || 50), duration: __ENV.STAGE_1 || '1m' },
        { target: Number(__ENV.RATE_2 || 100), duration: __ENV.STAGE_2 || '2m' },
        { target: Number(__ENV.RATE_3 || 200), duration: __ENV.STAGE_3 || '2m' },
      ],
    },
  },
  thresholds: {
    application_errors: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
}

function readRequest() {
  const selector = Math.random()
  if (selector < 0.1) return [http.get(`${baseUrl}${prefix}/json`, { headers, tags: { endpoint: 'json' } }), 200]
  if (selector < 0.45) {
    const page = 1 + Math.floor(Math.random() * 2000)
    return [http.get(`${baseUrl}${prefix}/patients?page=${page}`, { headers, tags: { endpoint: 'patients' } }), 200]
  }
  const id = 1 + Math.floor(Math.random() * 100000)
  return [http.get(`${baseUrl}${prefix}/patients/${id}`, { headers, tags: { endpoint: 'patient_detail' } }), 200]
}

function writeRequest() {
  const patientId = 1 + Math.floor(Math.random() * 100000)
  const body = JSON.stringify({ patient_id: patientId, visited_at: '2026-01-15T12:30:45.123Z', type: 'consultation', notes: 'k6 benchmark write' })
  return [http.post(`${baseUrl}${prefix}/visits`, body, { headers, tags: { endpoint: 'create_visit' } }), 201]
}

export default function () {
  let request
  if (mode === 'write') request = writeRequest()
  else if (mode === 'mixed') request = Math.random() < 0.2 ? writeRequest() : readRequest()
  else request = readRequest()
  const ok = record(request[0], request[1])
  check(request[0], { 'expected status': () => ok })
}
