import http from 'k6/http'
import { check } from 'k6'
import exec from 'k6/execution'
import encoding from 'k6/encoding'
import { config } from '../config.js'
import { userForVu } from './data.js'
import { record } from './metrics.js'

let session

function fixtureSession(user) {
  return {
    user,
    csrf: `csrf-${String(user.id).padStart(59, '0')}`,
    token: `benchmark-session:${user.email}:${config.password}`,
  }
}

export function currentUser() {
  return userForVu(exec.vu.idInTest, __ENV.BENCH_ROLE || null)
}

export function login(force = false) {
  if (session && !force) return session
  const user = currentUser()
  if (__ENV.PREAUTHENTICATED === '1' && !force) {
    session = fixtureSession(user)
    return session
  }
  const tags = { endpoint: 'auth.login', role: user.role }
  const response = http.post(`${config.baseUrl}/bench-v2/auth/login`, JSON.stringify({ email: user.email, password: config.password }), {
    headers: { 'Content-Type': 'application/json' },
    tags,
  })
  const ok = record(response, 200, tags, 'login')
  check(
    response,
    {
      'login returns user and csrf': (r) => ok && Boolean(r.json('data.csrf_token')),
    },
    tags,
  )
  if (!ok) throw new Error(`Login failed for ${user.email}: HTTP ${response.status}`)
  session = { user, csrf: response.json('data.csrf_token'), token: null }
  return session
}

function cookieHeader(auth) {
  if (!auth.token) return {}
  const token = __ENV.BACKEND === 'adonis' ? encoding.b64encode(JSON.stringify({ message: auth.token }), 'rawurl') : auth.token
  return { Cookie: `bench_session=${token}` }
}

export function readParams(tags) {
  const auth = login()
  return {
    headers: cookieHeader(auth),
    tags: { ...tags, role: auth.user.role },
  }
}

export function writeParams(tags) {
  const auth = login()
  return {
    headers: { ...cookieHeader(auth), 'Content-Type': 'application/json', 'X-CSRF-TOKEN': auth.csrf },
    tags: { ...tags, role: auth.user.role },
  }
}
