import type BenchmarkSession from '#models/benchmark_session'
import type BenchmarkUser from '#models/benchmark_user'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    benchmarkUser?: BenchmarkUser
    benchmarkSession?: BenchmarkSession
  }
}
