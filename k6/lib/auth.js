import http from 'k6/http'
import { check } from 'k6'
import exec from 'k6/execution'
import { config } from '../config.js'
import { userForVu } from './data.js'
import { record } from './metrics.js'

let session

export function currentUser() {
  return userForVu(exec.vu.idInTest)
}

export function login(force = false) {
  if (session && !force) return session
  const user = currentUser()
  const tags = { endpoint: 'auth.login', role: user.role }
  const response = http.post(
    `${config.baseUrl}/bench-v2/auth/login`,
    JSON.stringify({ email: user.email, password: config.password }),
    { headers: { 'Content-Type': 'application/json' }, tags }
  )
  const ok = record(response, 200, tags, 'login')
  check(response, { 'login returns user and csrf': (r) => ok && Boolean(r.json('data.csrf_token')) }, tags)
  if (!ok) throw new Error(`Login failed for ${user.email}: HTTP ${response.status}`)
  session = { user, csrf: response.json('data.csrf_token') }
  return session
}

export function writeParams(tags) {
  const auth = login()
  return {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': auth.csrf },
    tags: { ...tags, role: auth.user.role },
  }
}
