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
    const slot = hot ? integer(random, 0, 199) : integer(random, 200, 999)
    return doctorId + slot * 100
  }
  return hot ? integer(random, 1, 20000) : integer(random, 20001, 100000)
}

export function page(random, maximum = 2000) {
  return random() < 0.85 ? integer(random, 1, 3) : integer(random, 4, maximum)
}

export function visitId(random, doctorId = null) {
  if (!doctorId) return integer(random, 1, 500000)
  const residue = ((doctorId - 1) * 79) % 100 || 100
  return residue + 100 * integer(random, 0, 4999)
}

export function userForVu(vuId) {
  const bucket = (vuId - 1) % 10
  if (bucket === 0) {
    const number = Math.floor((vuId - 1) / 10) % 20 + 1
    return { role: 'admin', email: `admin${String(number).padStart(3, '0')}@benchmark.invalid`, doctorId: null }
  }
  if (bucket < 5) {
    const number = ((vuId - 1) * 7) % 100 + 1
    return { role: 'doctor', email: `doctor${String(number).padStart(3, '0')}@benchmark.invalid`, doctorId: number }
  }
  const number = ((vuId - 1) * 7) % 100 + 1
  return { role: 'reception', email: `reception${String(number).padStart(3, '0')}@benchmark.invalid`, doctorId: null }
}

export function isoAt(random, dayOffset = 0) {
  const hour = integer(random, 8, 18)
  const minute = integer(random, 0, 3) * 15
  return `2026-06-${String(10 + dayOffset).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`
}
