function rateScenario(executor, defaults, exec = 'arrivalAction') {
  return {
    executor,
    exec,
    timeUnit: '1s',
    preAllocatedVUs: Number(__ENV.PRE_VUS || 30),
    maxVUs: Number(__ENV.MAX_VUS || 300),
    ...defaults,
  }
}

function split(total) {
  const admin = Math.max(1, Math.floor(total * 0.1))
  const doctor = Math.max(1, Math.floor(total * 0.4))
  return { admin, doctor, reception: total - admin - doctor }
}

function stressScenarios(rate, duration) {
  if (rate < 10 || rate % 10 !== 0) {
    throw new Error('stress_step RATE must be a multiple of 10 and at least 10')
  }

  const rates = split(rate)
  const preAllocated = split(Number(__ENV.PRE_VUS || Math.max(10, Math.ceil(rate * 0.75))))
  const maximum = split(Number(__ENV.MAX_VUS || 300))
  const scenarios = {}

  for (const role of ['admin', 'doctor', 'reception']) {
    scenarios[`stress_${role}`] = {
      executor: 'constant-arrival-rate',
      exec: 'arrivalAction',
      rate: rates[role],
      duration,
      timeUnit: '1s',
      preAllocatedVUs: preAllocated[role],
      maxVUs: maximum[role],
      env: { BENCH_ROLE: role, PREAUTHENTICATED: '1' },
      tags: { workload: 'stress_step', role },
    }
  }

  return { scenarios }
}

export function scenarioOptions(name) {
  const rate = Number(__ENV.RATE || 0)
  const duration = __ENV.DURATION

  if (name === 'stress_step') return stressScenarios(rate || 20, duration || '3m')

  const scenarios = {
    mixed_steady: rateScenario('constant-arrival-rate', {
      rate: rate || 30,
      duration: duration || '30m',
    }),
    mixed_peak: rateScenario('constant-arrival-rate', {
      rate: rate || 80,
      duration: duration || '10m',
    }),
    write_ramp: rateScenario(
      'ramping-arrival-rate',
      {
        startRate: Number(__ENV.RATE_START || 25),
        stages: [
          {
            target: Number(__ENV.RATE_1 || 50),
            duration: __ENV.STAGE_1 || '1m',
          },
          {
            target: Number(__ENV.RATE_2 || 100),
            duration: __ENV.STAGE_2 || '2m',
          },
          {
            target: Number(__ENV.RATE_3 || 200),
            duration: __ENV.STAGE_3 || '2m',
          },
        ],
      },
      'writeAction',
    ),
    soak: rateScenario('constant-arrival-rate', {
      rate: rate || 20,
      duration: duration || '2h',
    }),
    login_burst: rateScenario(
      'constant-arrival-rate',
      {
        rate: rate || 50,
        duration: duration || '1m',
      },
      'loginAction',
    ),
    user_session: {
      executor: 'constant-vus',
      exec: 'userSession',
      vus: Number(__ENV.VUS || 30),
      duration: duration || '30m',
    },
  }
  if (!scenarios[name]) throw new Error(`Unknown SCENARIO=${name}`)
  return { scenarios: { [name]: scenarios[name] } }
}
