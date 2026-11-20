import fs from 'node:fs'
import path from 'node:path'

const [root, output = path.join(root || '.', 'STRESS_REPORT.md')] = process.argv.slice(2)
if (!root) throw new Error('Usage: node scripts/stress-report.mjs CAMPAIGN_DIR [OUTPUT.md]')

const rows = []
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const match = entry.name.match(/^stress-(\d+)-(adonis|octane)-pool(\d+)-r(\d+)$/)
  if (!match) continue
  const verdictPath = path.join(root, entry.name, 'verdict.json')
  if (!fs.existsSync(verdictPath)) continue
  rows.push({
    rate: Number(match[1]),
    backend: match[2],
    pool: Number(match[3]),
    repetition: Number(match[4]),
    ...JSON.parse(fs.readFileSync(verdictPath, 'utf8')),
  })
}

rows.sort((a, b) => a.repetition - b.repetition || a.backend.localeCompare(b.backend) || a.rate - b.rate)
const lines = [
  '# Authenticated stress ladder',
  '',
  'Each row is an independent constant-arrival-rate step. PASS requires completion ≥99%, errors <0.5%, no timeouts, dropped iterations <1%, checks ≥99.5%, read p95 <500 ms, and write p95 <800 ms.',
  '',
  '| Rep | Backend | Offered req/s | Verdict | Completion % | Successful HTTP/s | Errors % | Timeouts | Dropped % | p50 ms | p95 ms | p99 ms | Read p95 | Write p95 |',
  '|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
]
for (const row of rows) {
  lines.push(
    `| ${row.repetition} | ${row.backend} | ${row.rate} | ${row.passed ? 'PASS' : 'FAIL'} | ${(row.completion_ratio * 100).toFixed(2)} | ${row.successful_http_requests_per_second.toFixed(2)} | ${(row.error_rate * 100).toFixed(3)} | ${row.timeouts} | ${(row.dropped_ratio * 100).toFixed(3)} | ${row.http_p50_ms.toFixed(2)} | ${row.http_p95_ms.toFixed(2)} | ${row.http_p99_ms.toFixed(2)} | ${row.read_p95_ms.toFixed(2)} | ${row.write_p95_ms.toFixed(2)} |`,
  )
}

lines.push('', '## Capacity bounds', '')
for (const backend of ['adonis', 'octane']) {
  const backendRows = rows.filter((row) => row.backend === backend)
  const repetitions = [...new Set(backendRows.map((row) => row.repetition))]
  if (!repetitions.length) continue
  for (const repetition of repetitions) {
    const repetitionRows = backendRows.filter((row) => row.repetition === repetition)
    const passedRates = repetitionRows.filter((row) => row.passed).map((row) => row.rate)
    const failedRates = repetitionRows.filter((row) => !row.passed).map((row) => row.rate)
    if (!passedRates.length) {
      lines.push(`- ${backend}, repetition ${repetition}: no passing step; first failure at ${Math.min(...failedRates)} req/s.`)
    } else if (failedRates.length) {
      lines.push(
        `- ${backend}, repetition ${repetition}: highest passing step ${Math.max(...passedRates)} req/s; first failure at ${Math.min(...failedRates)} req/s.`,
      )
    } else {
      lines.push(`- ${backend}, repetition ${repetition}: at least ${Math.max(...passedRates)} req/s; no failing step was observed.`)
    }
  }
}
lines.push('', 'These are observed bounds under this workload and SLO. A highest passing step without a subsequent failure is not a maximum.', '')

fs.writeFileSync(output, `${lines.join('\n')}\n`)
console.log(output)
