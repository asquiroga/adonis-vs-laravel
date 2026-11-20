export function rng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function integer(random, min, max) {
  return min + Math.floor(random() * (max - min + 1))
}

export function patientId(random, doctorId = null) {
  const hot = random() < 0.8
  if (doctorId) {
    const hotMaximum = Math.floor((20000 - doctorId) / 150)
    const maximum = Math.floor((100000 - doctorId) / 150)
    const slot = hot ? integer(random, 0, hotMaximum) : integer(random, hotMaximum + 1, maximum)
    return doctorId + slot * 150
  }
  return hot ? integer(random, 1, 20000) : integer(random, 20001, 100000)
}

export function page(random, maximum = 2000) {
  return random() < 0.85 ? integer(random, 1, 3) : integer(random, 4, maximum)
}

export function visitId(random, doctorId = null) {
  if (!doctorId) return integer(random, 1, 500000)
  const patient = patientId(random, doctorId)
  const residue = ((patient - 1) * 17679) % 100000 || 100000
  const maximumSlot = Math.floor((500000 - residue) / 100000)
  return residue + 100000 * integer(random, 0, maximumSlot)
}

export function userForVu(vuId, forcedRole = null) {
  if (forcedRole === 'admin') {
    const number = ((vuId - 1) % 20) + 1
    return {
      role: 'admin',
      email: `admin${String(number).padStart(3, '0')}@benchmark.invalid`,
      doctorId: null,
    }
  }
  if (forcedRole === 'doctor') {
    const number = ((vuId - 1) % 150) + 1
    return {
      role: 'doctor',
      email: `doctor${String(number).padStart(3, '0')}@benchmark.invalid`,
      doctorId: number,
    }
  }
  if (forcedRole === 'reception') {
    const number = ((vuId - 1) % 100) + 1
    return {
      role: 'reception',
      email: `reception${String(number).padStart(3, '0')}@benchmark.invalid`,
      doctorId: null,
    }
  }

  const bucket = (vuId - 1) % 10
  if (bucket === 0) {
    const number = (Math.floor((vuId - 1) / 10) % 20) + 1
    return {
      role: 'admin',
      email: `admin${String(number).padStart(3, '0')}@benchmark.invalid`,
      doctorId: null,
    }
  }
  if (bucket < 5) {
    const number = (((vuId - 1) * 7) % 150) + 1
    return {
      role: 'doctor',
      email: `doctor${String(number).padStart(3, '0')}@benchmark.invalid`,
      doctorId: number,
    }
  }
  const number = (((vuId - 1) * 7) % 100) + 1
  return {
    role: 'reception',
    email: `reception${String(number).padStart(3, '0')}@benchmark.invalid`,
    doctorId: null,
  }
}

export function isoAt(random, dayOffset = 0) {
  const hour = integer(random, 8, 18)
  const minute = integer(random, 0, 3) * 15
  return `2026-06-${String(10 + dayOffset).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`
}
