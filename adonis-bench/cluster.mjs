import cluster from 'node:cluster'

const workers = Number(process.env.APP_WORKERS || 4)
if (cluster.isPrimary) {
  for (let index = 0; index < workers; index++) cluster.fork()
  cluster.on('exit', (worker, code) => {
    if (code !== 0) cluster.fork()
  })
} else {
  await import('./bin/server.js')
}
