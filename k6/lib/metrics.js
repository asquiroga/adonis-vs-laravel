import { Counter, Rate, Trend } from 'k6/metrics'

export const readDuration = new Trend('read_duration', true)
export const writeDuration = new Trend('write_duration', true)
export const loginDuration = new Trend('login_duration', true)
export const errors = new Rate('benchmark_errors')
export const successful = new Counter('successful_requests')
export const expectedForbidden = new Counter('expected_forbidden')
export const timeouts = new Counter('benchmark_timeouts')

export function record(response, expectedStatus, tags, kind) {
  const ok = response.status === expectedStatus
  errors.add(!ok, tags)
  if (response.status === 0 && /timeout/i.test(response.error || '')) timeouts.add(1, tags)
  if (ok) successful.add(1, tags)
  if (kind === 'read') readDuration.add(response.timings.duration, tags)
  if (kind === 'write') writeDuration.add(response.timings.duration, tags)
  if (kind === 'login') loginDuration.add(response.timings.duration, tags)
  return ok
}
