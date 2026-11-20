import { Counter, Rate, Trend } from 'k6/metrics'

export const readDuration = new Trend('read_duration', true)
export const writeDuration = new Trend('write_duration', true)
export const loginDuration = new Trend('login_duration', true)
export const errors = new Rate('benchmark_errors')
export const successful = new Counter('successful_requests')
export const expectedForbidden = new Counter('expected_forbidden')
export const timeouts = new Counter('benchmark_timeouts')

const endpointDurations = {
  'patients.list': new Trend('endpoint_patients_list_duration', true),
  'patients.detail': new Trend('endpoint_patients_detail_duration', true),
  'patients.detail.forbidden': new Trend('endpoint_patients_detail_forbidden_duration', true),
  agenda: new Trend('endpoint_agenda_duration', true),
  'visits.detail': new Trend('endpoint_visits_detail_duration', true),
  'visits.create': new Trend('endpoint_visits_create_duration', true),
  'visits.create.forbidden': new Trend('endpoint_visits_create_forbidden_duration', true),
  'patients.update': new Trend('endpoint_patients_update_duration', true),
  'patients.update.forbidden': new Trend('endpoint_patients_update_forbidden_duration', true),
  'appointments.create': new Trend('endpoint_appointments_create_duration', true),
  'auth.login': new Trend('endpoint_auth_login_duration', true),
}

export function record(response, expectedStatus, tags, kind) {
  const ok = response.status === expectedStatus
  errors.add(!ok, tags)
  if (response.status === 0 && /timeout/i.test(response.error || '')) timeouts.add(1, tags)
  if (ok) successful.add(1, tags)
  if (kind === 'read') readDuration.add(response.timings.duration, tags)
  if (kind === 'write') writeDuration.add(response.timings.duration, tags)
  if (kind === 'login') loginDuration.add(response.timings.duration, tags)
  endpointDurations[tags.endpoint]?.add(response.timings.duration, tags)
  return ok
}
