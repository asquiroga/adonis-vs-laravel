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
const BenchmarkAuthController = () => import('#controllers/benchmark_auth_controller')
const BenchmarkV2Controller = () => import('#controllers/benchmark_v2_controller')

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

router
  .group(() => {
    router.get('health', [BenchmarkV2Controller, 'health'])
    router.post('auth/login', [BenchmarkAuthController, 'login'])

    router
      .group(() => {
        router.get('auth/me', [BenchmarkAuthController, 'me'])
        router.post('auth/logout', [BenchmarkAuthController, 'logout'])
        router.get('patients', [BenchmarkV2Controller, 'patients'])
        router.get('patients/:id', [BenchmarkV2Controller, 'patient'])
        router.patch('patients/:id', [BenchmarkV2Controller, 'updatePatient'])
        router.get('visits/:id', [BenchmarkV2Controller, 'visit'])
        router.post('visits', [BenchmarkV2Controller, 'createVisit'])
        router.get('agenda', [BenchmarkV2Controller, 'agenda'])
        router.post('appointments', [BenchmarkV2Controller, 'createAppointment'])
      })
      .use(middleware.benchSession())
  })
  .prefix('/bench-v2')
