import { Counter, Rate } from 'k6/metrics'

export const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '')
export const authenticated = (__ENV.AUTH || 'false') === 'true'
export const prefix = authenticated ? '/bench-auth' : '/bench'
export const headers = authenticated
  ? { Authorization: `Bearer ${__ENV.BENCH_TOKEN || 'bench-write-token'}`, 'Content-Type': 'application/json' }
  : { 'Content-Type': 'application/json' }
export const successfulRequests = new Counter('successful_requests')
export const applicationErrors = new Rate('application_errors')
export const timeouts = new Counter('timeouts')

export function record(response, expectedStatus) {
  const ok = response.status === expectedStatus
  if (ok) successfulRequests.add(1)
  applicationErrors.add(!ok)
  const timedOut = response.error_code === 1050 || response.error === 'request timeout'
  timeouts.add(timedOut ? 1 : 0)
  return ok
}
