import http from 'k6/http'
import { baseUrl, headers, prefix, record } from './lib/config.js'

export const options = {
  scenarios: { warmup: { executor: 'constant-arrival-rate', rate: Number(__ENV.WARMUP_RATE || 50), timeUnit: '1s', duration: __ENV.WARMUP_DURATION || '30s', preAllocatedVUs: 20, maxVUs: 200 } },
}

export default function () {
  const id = 1 + Math.floor(Math.random() * 100000)
  record(http.get(`${baseUrl}${prefix}/patients/${id}`, { headers, tags: { endpoint: 'patient_detail', phase: 'warmup' } }), 200)
}
