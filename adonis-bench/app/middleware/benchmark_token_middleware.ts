import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class BenchmarkTokenMiddleware {
  async handle(
    { request, response }: HttpContext,
    next: NextFn,
    options: { scope: 'read' | 'write' }
  ) {
    const authorization = request.header('authorization') ?? ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) {
      return response.status(401).send({
        error: { code: 'unauthorized', message: 'Missing bearer token' },
      })
    }

    const readToken = env.get('BENCH_READ_TOKEN')
    const writeToken = env.get('BENCH_WRITE_TOKEN')
    const valid =
      options.scope === 'write' ? token === writeToken : token === readToken || token === writeToken

    if (!valid) {
      return response.status(403).send({
        error: { code: 'forbidden', message: 'Insufficient scope' },
      })
    }
    return next()
  }
}
