import fs from 'node:fs'

const [summaryPath, rateInput, durationInput, outputPath] = process.argv.slice(2)
if (!summaryPath || !rateInput || !durationInput || !outputPath) {
  throw new Error('Usage: node scripts/evaluate-stress.mjs SUMMARY RATE DURATION OUTPUT')
}

function durationSeconds(value) {
  const match = value.match(/^(\d+(?:\.\d+)?)(s|m|h)$/)
  if (!match) throw new Error(`Unsupported duration: ${value}`)
  const factor = match[2] === 'h' ? 3600 : match[2] === 'm' ? 60 : 1
  return Number(match[1]) * factor
}

const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
const metric = (name, field, fallback = 0) => {
  const entry = data.metrics?.[name]
  return entry?.values?.[field] ?? entry?.[field] ?? fallback
}
const rate = Number(rateInput)
const seconds = durationSeconds(durationInput)
const expectedIterations = rate * seconds
const iterations = metric('iterations', 'count')
const dropped = metric('dropped_iterations', 'count')
const errorRate = metric('benchmark_errors', 'rate', metric('benchmark_errors', 'value'))
const checksRate = metric('checks', 'rate', metric('checks', 'value'))
const timeouts = metric('benchmark_timeouts', 'count')
const readP95 = metric('read_duration', 'p(95)', Number.POSITIVE_INFINITY)
const writeP95 = metric('write_duration', 'p(95)', Number.POSITIVE_INFINITY)
const completionRatio = iterations / expectedIterations
const droppedRatio = dropped / Math.max(1, iterations + dropped)
const endpointP95 = Object.fromEntries(
  Object.entries(data.metrics || {})
    .filter(([name]) => name.startsWith('endpoint_') && name.endsWith('_duration'))
    .map(([name, entry]) => [name.replace(/^endpoint_/, '').replace(/_duration$/, '').replaceAll('_', '.'), entry.values?.['p(95)'] ?? entry['p(95)']])
    .filter(([, value]) => Number.isFinite(value)),
)
const worstEndpoint = Object.entries(endpointP95).sort((a, b) => b[1] - a[1])[0] || [null, null]

const criteria = {
  completion_ratio_at_least_99_percent: completionRatio >= 0.99,
  error_rate_below_0_5_percent: errorRate < 0.005,
  no_timeouts: timeouts === 0,
  dropped_ratio_below_1_percent: droppedRatio < 0.01,
  checks_at_least_99_5_percent: checksRate >= 0.995,
  read_p95_below_500_ms: readP95 < 500,
  write_p95_below_800_ms: writeP95 < 800,
}
const passed = Object.values(criteria).every(Boolean)
const verdict = {
  passed,
  rate,
  duration: durationInput,
  expected_iterations: expectedIterations,
  iterations,
  completion_ratio: completionRatio,
  successful_http_requests_per_second: metric('successful_requests', 'rate'),
  error_rate: errorRate,
  timeouts,
  dropped_iterations: dropped,
  dropped_ratio: droppedRatio,
  checks_rate: checksRate,
  http_p50_ms: metric('http_req_duration', 'med'),
  http_p95_ms: metric('http_req_duration', 'p(95)'),
  http_p99_ms: metric('http_req_duration', 'p(99)'),
  read_p95_ms: readP95,
  write_p95_ms: writeP95,
  endpoint_p95_ms: endpointP95,
  worst_endpoint: worstEndpoint[0],
  worst_endpoint_p95_ms: worstEndpoint[1],
  criteria,
}

fs.writeFileSync(outputPath, `${JSON.stringify(verdict, null, 2)}\n`)
console.log(
  `${passed ? 'PASS' : 'FAIL'} rate=${rate} req/s completion=${(completionRatio * 100).toFixed(2)}% errors=${(errorRate * 100).toFixed(3)}% timeouts=${timeouts} dropped=${dropped} read_p95=${readP95.toFixed(2)}ms write_p95=${writeP95.toFixed(2)}ms`,
)
process.exitCode = passed ? 0 : 1
