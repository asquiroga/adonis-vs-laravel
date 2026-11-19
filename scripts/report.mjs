import fs from 'node:fs'
import path from 'node:path'

const [root, output = path.join(root || '.', 'REPORT.md')] = process.argv.slice(2)
if (!root) throw new Error('Usage: node scripts/report.mjs CAMPAIGN_DIR [OUTPUT.md]')

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function summary(values, digits = 2) {
  if (!values.length) return 'n/a'
  return `${median(values).toFixed(digits)} (${Math.min(...values).toFixed(digits)}–${Math.max(...values).toFixed(digits)})`
}

const runs = []
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const directory = path.join(root, entry.name)
  const summaryPath = path.join(directory, 'summary.json')
  if (!fs.existsSync(summaryPath)) continue
  const match = entry.name.match(/^(.+)-(adonis|octane|fpm)-pool(\d+)-r(\d+)$/)
  if (!match) continue
  const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
  const metric = (name, field, fallback = 0) => {
    const entry = data.metrics?.[name]
    return entry?.values?.[field] ?? entry?.[field] ?? fallback
  }
  runs.push({
    scenario: match[1], backend: match[2], pool: Number(match[3]), repetition: Number(match[4]),
    throughput: metric('successful_requests', 'rate'),
    p50: metric('http_req_duration', 'med'), p95: metric('http_req_duration', 'p(95)'), p99: metric('http_req_duration', 'p(99)'),
    readP95: metric('read_duration', 'p(95)'), writeP95: metric('write_duration', 'p(95)'),
    errorRate: metric('benchmark_errors', 'rate', metric('benchmark_errors', 'value')) * 100,
    dropped: metric('dropped_iterations', 'count'), timeouts: metric('benchmark_timeouts', 'count'),
    vusMax: metric('vus_max', 'max', metric('vus_max', 'value')),
    checks: metric('checks', 'rate', metric('checks', 'value')) * 100,
  })
}

const groups = new Map()
for (const run of runs) {
  const key = `${run.scenario}|${run.backend}|${run.pool}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(run)
}

const lines = [
  '# Comparative benchmark report', '',
  'Values are median (minimum–maximum) across repetitions. Throughput is observed successful requests/s; no capacity is extrapolated.', '',
  '| Scenario | Backend | DB connection budget | Repeats | Successful req/s | p50 ms | p95 ms | p99 ms | Read p95 | Write p95 | Errors % | Timeouts | Dropped | Max VUs | Checks % |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
]
for (const [key, values] of [...groups].sort()) {
  const [scenario, backend, pool] = key.split('|')
  lines.push(`| ${scenario} | ${backend} | ${pool} | ${values.length} | ${summary(values.map((v) => v.throughput))} | ${summary(values.map((v) => v.p50))} | ${summary(values.map((v) => v.p95))} | ${summary(values.map((v) => v.p99))} | ${summary(values.map((v) => v.readP95))} | ${summary(values.map((v) => v.writeP95))} | ${summary(values.map((v) => v.errorRate), 3)} | ${summary(values.map((v) => v.timeouts), 0)} | ${summary(values.map((v) => v.dropped), 0)} | ${summary(values.map((v) => v.vusMax), 0)} | ${summary(values.map((v) => v.checks), 3)} |`)
}
lines.push('', '## Validity notes', '', '- Review each `metadata.env`, `generator-warning.txt`, server CSV, PostgreSQL snapshots, and k6 threshold exit status.', '- Octane/PHP uses at most one active PDO connection per worker; increasing the Node pool budget does not create a comparable PHP client-side pool. Keep worker count fixed and report this architectural difference.', '')
fs.writeFileSync(output, `${lines.join('\n')}\n`)
console.log(output)
