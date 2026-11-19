import BenchmarkSession from '#models/benchmark_session'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { createHash, timingSafeEqual } from 'node:crypto'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export default class BenchmarkSessionMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const token = ctx.request.plainCookie('bench_session')
    if (typeof token !== 'string' || token.length === 0) return this.unauthorized(ctx)

    const session = await BenchmarkSession.query()
      .where('tokenHash', createHash('sha256').update(token).digest('hex'))
      .where('expiresAt', '>', new Date())
      .preload('user', (query) => query.preload('doctor'))
      .first()

    if (!session?.user) return this.unauthorized(ctx)

    if (WRITE_METHODS.has(ctx.request.method())) {
      const supplied = ctx.request.header('x-csrf-token')
      if (!this.tokensMatch(session.csrfToken, supplied)) {
        return ctx.response
          .status(419)
          .send({ error: { code: 'csrf_failed', message: 'Invalid CSRF token' } })
      }
    }

    ctx.benchmarkUser = session.user
    ctx.benchmarkSession = session
    return next()
  }

  private tokensMatch(expected: string, supplied?: string) {
    if (!supplied || expected.length !== supplied.length) return false
    return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  }

  private unauthorized({ response }: HttpContext) {
    return response
      .status(401)
      .send({ error: { code: 'unauthenticated', message: 'Authentication required' } })
  }
}
