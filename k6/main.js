import http from 'k6/http'
import { check, sleep } from 'k6'
import exec from 'k6/execution'
import { config, options as configuredOptions } from './config.js'
import { currentUser, login, readParams, writeParams } from './lib/auth.js'
import { expectedForbidden, record } from './lib/metrics.js'
import { integer, isoAt, page, patientId, rng, visitId } from './lib/data.js'

export const options = configuredOptions

function randomForIteration() {
  const role = __ENV.BENCH_ROLE || currentUser().role
  const roleSalt = role === 'admin' ? 1000003 : role === 'doctor' ? 2000003 : 3000017
  return rng(config.seed + roleSalt + exec.scenario.iterationInTest * 9176)
}

function get(path, endpoint, role, expected = 200) {
  const tags = { endpoint, role }
  const params = readParams(tags)
  const response = http.get(`${config.baseUrl}${path}`, {
    ...params,
    responseCallback: http.expectedStatuses(expected),
  })
  const ok = record(response, expected, tags, 'read')
  check(response, { [`${endpoint} status ${expected}`]: () => ok }, tags)
  return response
}

function send(method, path, endpoint, body, expected = 200) {
  const auth = login()
  const tags = { endpoint, role: auth.user.role }
  const params = writeParams(tags)
  params.responseCallback = http.expectedStatuses(expected)
  const response = http.request(method, `${config.baseUrl}${path}`, JSON.stringify(body), params)
  const ok = record(response, expected, tags, 'write')
  check(response, { [`${endpoint} status ${expected}`]: () => ok }, tags)
  return response
}

export function readAction(random = randomForIteration()) {
  const auth = login()
  const { user } = auth
  if (user.role === 'doctor' && random() < config.negativeRatio) {
    let forbiddenPatient = (user.doctorId % 150) + 1
    if (forbiddenPatient % 10 === 0) forbiddenPatient += 1
    const response = get(`/bench-v2/patients/${forbiddenPatient}`, 'patients.detail.forbidden', user.role, 403)
    if (response.status === 403)
      expectedForbidden.add(1, {
        endpoint: 'patients.detail.forbidden',
        role: user.role,
      })
    return
  }

  const choice = random()
  if (choice < 0.35) {
    const selectedPage = page(random, user.role === 'doctor' ? 20 : 2000)
    let search = ''
    if (random() < 0.35) {
      const id = patientId(random, user.doctorId)
      search = random() < 0.5 ? `&search=D${String(id).padStart(8, '0')}` : `&search=Apellido${String(id % 5000).padStart(4, '0')}`
    }
    get(`/bench-v2/patients?page=${selectedPage}${search}`, 'patients.list', user.role)
  } else if (choice < 0.68) {
    get(`/bench-v2/patients/${patientId(random, user.doctorId)}`, 'patients.detail', user.role)
  } else if (choice < 0.88) {
    const doctor = user.doctorId || integer(random, 1, 150)
    get(`/bench-v2/agenda?date=2026-06-15&doctor_id=${doctor}`, 'agenda', user.role)
  } else {
    get(`/bench-v2/visits/${visitId(random, user.doctorId)}`, 'visits.detail', user.role)
  }
}

export function writeAction(random = randomForIteration()) {
  const { user } = login()
  const selectedPatient = patientId(random, user.doctorId)
  if (user.role !== 'admin' && random() < config.negativeRatio) {
    if (user.role === 'doctor') {
      const response = send(
        'PATCH',
        `/bench-v2/patients/${selectedPatient}`,
        'patients.update.forbidden',
        {
          phone: '+5491112345678',
        },
        403,
      )
      if (response.status === 403)
        expectedForbidden.add(1, {
          endpoint: 'patients.update.forbidden',
          role: user.role,
        })
    } else {
      const response = send(
        'POST',
        '/bench-v2/visits',
        'visits.create.forbidden',
        {
          patient_id: selectedPatient,
          doctor_id: ((selectedPatient - 1) % 150) + 1,
          visited_at: isoAt(random),
          type: 'consultation',
          notes: 'expected forbidden',
        },
        403,
      )
      if (response.status === 403)
        expectedForbidden.add(1, {
          endpoint: 'visits.create.forbidden',
          role: user.role,
        })
    }
    return
  }
  if (user.role === 'doctor' || (user.role === 'admin' && random() < 0.4)) {
    const doctor = user.doctorId || ((selectedPatient - 1) % 150) + 1
    send(
      'POST',
      '/bench-v2/visits',
      'visits.create',
      {
        patient_id: selectedPatient,
        doctor_id: doctor,
        visited_at: isoAt(random),
        type: ['consultation', 'follow_up', 'emergency', 'telemedicine'][integer(random, 0, 3)],
        notes: `k6 seed ${config.seed}`,
      },
      201,
    )
    return
  }

  if (random() < 0.5) {
    send('PATCH', `/bench-v2/patients/${selectedPatient}`, 'patients.update', {
      phone: `+54911${String(integer(random, 10000000, 99999999))}`,
    })
  } else {
    const doctor = ((selectedPatient - 1) % 150) + 1
    send(
      'POST',
      '/bench-v2/appointments',
      'appointments.create',
      {
        patient_id: selectedPatient,
        doctor_id: doctor,
        scheduled_at: isoAt(random, 1),
        reason: `Control k6 ${config.seed}`,
      },
      201,
    )
  }
}

export function arrivalAction() {
  const random = randomForIteration()
  const roleOffset = __ENV.BENCH_ROLE === 'doctor' ? 3 : __ENV.BENCH_ROLE === 'reception' ? 7 : 0
  const deterministicWrite = (exec.scenario.iterationInTest + roleOffset) % 10 === 0
  const shouldWrite = __ENV.BENCH_ROLE ? deterministicWrite : random() < config.writeRatio
  if (shouldWrite) writeAction(random)
  else readAction(random)
}

export function loginAction() {
  login(true)
}

export function userSession() {
  const random = randomForIteration()
  if (random() < config.writeRatio) writeAction(random)
  else readAction(random)
  sleep(integer(random, 1, 5))
}

export default arrivalAction
