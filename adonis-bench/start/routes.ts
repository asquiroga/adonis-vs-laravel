/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

const BenchmarkController = () => import('#controllers/benchmark_controller')

router
  .group(() => {
    router.get('json', [BenchmarkController, 'json']).as('bench_json')
    router.get('patients', [BenchmarkController, 'patients']).as('bench_patients')
    router.get('patients/:id', [BenchmarkController, 'patient']).as('bench_patient')
    router.post('visits', [BenchmarkController, 'createVisit']).as('bench_visits_create')
  })
  .prefix('/bench')

router
  .group(() => {
    router
      .get('json', [BenchmarkController, 'json'])
      .as('bench_auth_json')
      .use(middleware.benchToken({ scope: 'read' }))
    router
      .get('patients', [BenchmarkController, 'patients'])
      .as('bench_auth_patients')
      .use(middleware.benchToken({ scope: 'read' }))
    router
      .get('patients/:id', [BenchmarkController, 'patient'])
      .as('bench_auth_patient')
      .use(middleware.benchToken({ scope: 'read' }))
    router
      .post('visits', [BenchmarkController, 'createVisit'])
      .as('bench_auth_visits_create')
      .use(middleware.benchToken({ scope: 'write' }))
  })
  .prefix('/bench-auth')
