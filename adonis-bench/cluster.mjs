import cluster from 'node:cluster'

const workers = Number(process.env.APP_WORKERS || 4)
const connectionBudget = Number(process.env.DB_CONNECTION_BUDGET || workers)
if (cluster.isPrimary) {
  if (connectionBudget < workers)
    throw new Error('DB_CONNECTION_BUDGET must be at least APP_WORKERS')
  const workerEnvironments = new Map()
  for (let index = 0; index < workers; index++) {
    const poolSize =
      Math.floor(connectionBudget / workers) + (index < connectionBudget % workers ? 1 : 0)
    const environment = { DB_POOL_MAX: String(poolSize) }
    const worker = cluster.fork(environment)
    workerEnvironments.set(worker.id, environment)
  }
  cluster.on('exit', (worker, code) => {
    const environment = workerEnvironments.get(worker.id)
    workerEnvironments.delete(worker.id)
    if (code !== 0 && environment) {
      const replacement = cluster.fork(environment)
      workerEnvironments.set(replacement.id, environment)
    }
  })
} else {
  await import('./bin/server.js')
}
