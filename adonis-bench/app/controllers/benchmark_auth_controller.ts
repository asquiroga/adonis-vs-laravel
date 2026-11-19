import BenchmarkSession from '#models/benchmark_session'
import BenchmarkUser from '#models/benchmark_user'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import { compare } from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'

export default class BenchmarkAuthController {
  async login({ request, response }: HttpContext) {
    const email = request.input('email')
    const password = request.input('password')
    const fields: string[] = []
    if (typeof email !== 'string' || email.length > 254 || !email.includes('@'))
      fields.push('email')
    if (typeof password !== 'string' || password.length === 0 || password.length > 200)
      fields.push('password')
    if (fields.length) return this.validation(response, fields)

    const user = await BenchmarkUser.query().where('email', email).preload('doctor').first()
    if (!user || !(await compare(password, user.passwordHash))) {
      return response
        .status(401)
        .send({ error: { code: 'invalid_credentials', message: 'Invalid credentials' } })
    }

    const token = randomBytes(32).toString('hex')
    const csrfToken = randomBytes(32).toString('hex')
    const ttl = env.get('BENCH_SESSION_TTL_SECONDS')
    const now = DateTime.utc()
    await BenchmarkSession.create({
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: user.id,
      csrfToken,
      expiresAt: now.plus({ seconds: ttl }),
      createdAt: now,
      lastSeenAt: now,
    })

    const cookieOptions = {
      path: '/bench-v2',
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: false,
      maxAge: `${ttl}s`,
    }
    response.plainCookie('bench_session', token, cookieOptions)
    response.plainCookie('XSRF-TOKEN', csrfToken, { ...cookieOptions, httpOnly: false })
    return response.send({ data: { user: this.userData(user), csrf_token: csrfToken } })
  }

  async me({ benchmarkUser, response }: HttpContext) {
    return response.send({ data: { user: this.userData(benchmarkUser!) } })
  }

  async logout({ benchmarkSession, response }: HttpContext) {
    await benchmarkSession!.delete()
    response.clearCookie('bench_session', { path: '/bench-v2' })
    response.clearCookie('XSRF-TOKEN', { path: '/bench-v2' })
    return response.send({ data: { logged_out: true } })
  }

  private userData(user: BenchmarkUser) {
    return {
      id: Number(user.id),
      email: user.email,
      role: user.role,
      display_name: user.displayName,
      doctor_id: user.doctor ? Number(user.doctor.id) : null,
    }
  }

  private validation(response: HttpContext['response'], fields: string[]) {
    return response.status(422).send({
      error: { code: 'validation_error', message: 'Invalid request', fields: [...new Set(fields)] },
    })
  }
}
