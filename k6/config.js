import { scenarioOptions } from './scenarios.js'

export const config = {
  baseUrl: (__ENV.BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, ''),
  password: __ENV.BENCHMARK_PASSWORD || '',
  seed: Number(__ENV.SEED || 20261119),
  writeRatio: Number(__ENV.WRITE_RATIO || 0.1),
  negativeRatio: Number(__ENV.NEGATIVE_RATIO || 0.01),
  maxVus: Number(__ENV.MAX_VUS || 1000),
}

if (!config.password) throw new Error('BENCHMARK_PASSWORD is required')
if (config.writeRatio < 0 || config.writeRatio > 1) throw new Error('WRITE_RATIO must be 0..1')

const stress = __ENV.SCENARIO === 'stress_step'

export const options = {
  ...scenarioOptions(__ENV.SCENARIO || 'mixed_steady'),
  thresholds: {
    read_duration: [stress ? 'p(95)<500' : 'p(95)<300'],
    write_duration: [stress ? 'p(95)<800' : 'p(95)<600'],
    benchmark_errors: [stress ? 'rate<0.005' : 'rate<0.001'],
    checks: [stress ? 'rate>0.995' : 'rate>0.999'],
  },
  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max'],
  discardResponseBodies: false,
  noConnectionReuse: false,
  noCookiesReset: true,
  userAgent: 'medihome-k6-v2',
}
