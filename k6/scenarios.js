function rateScenario(executor, defaults, exec = 'arrivalAction') {
  return { executor, exec, timeUnit: '1s', preAllocatedVUs: Number(__ENV.PRE_VUS || 100), maxVUs: Number(__ENV.MAX_VUS || 1000), ...defaults }
}

export function scenarioOptions(name) {
  const rate = Number(__ENV.RATE || 0)
  const duration = __ENV.DURATION
  const scenarios = {
    mixed_steady: rateScenario('constant-arrival-rate', {
      rate: rate || 30,
      duration: duration || '30m',
    }),
    mixed_peak: rateScenario('constant-arrival-rate', {
      rate: rate || 80,
      duration: duration || '10m',
    }),
    write_ramp: rateScenario('ramping-arrival-rate', {
      startRate: Number(__ENV.RATE_START || 25),
      stages: [
        { target: Number(__ENV.RATE_1 || 50), duration: __ENV.STAGE_1 || '1m' },
        { target: Number(__ENV.RATE_2 || 100), duration: __ENV.STAGE_2 || '2m' },
        { target: Number(__ENV.RATE_3 || 200), duration: __ENV.STAGE_3 || '2m' },
      ],
    }, 'writeAction'),
    soak: rateScenario('constant-arrival-rate', {
      rate: rate || 20,
      duration: duration || '2h',
    }),
    login_burst: rateScenario('constant-arrival-rate', {
      rate: rate || 50,
      duration: duration || '1m',
    }, 'loginAction'),
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
