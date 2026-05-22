const failedAttempts = new Map()

const MAX_FAILED_ATTEMPTS = 5
const LOCK_TIME_MS = 15 * 60 * 1000

function buildAttemptKey(req, username) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip'
  return `${String(ip).trim()}::${String(username).trim().toLowerCase()}`
}

function getAttemptState(req, username) {
  const key = buildAttemptKey(req, username)
  const current = failedAttempts.get(key)

  if (!current) {
    return {
      key,
      isLocked: false,
      remainingMs: 0,
    }
  }

  if (current.lockedUntil && current.lockedUntil > Date.now()) {
    return {
      key,
      isLocked: true,
      remainingMs: current.lockedUntil - Date.now(),
    }
  }

  if (current.lockedUntil && current.lockedUntil <= Date.now()) {
    failedAttempts.delete(key)
  }

  return {
    key,
    isLocked: false,
    remainingMs: 0,
  }
}

function registerFailedAttempt(req, username) {
  const key = buildAttemptKey(req, username)
  const current = failedAttempts.get(key) || {
    count: 0,
    lockedUntil: null,
  }

  current.count += 1

  if (current.count >= MAX_FAILED_ATTEMPTS) {
    current.lockedUntil = Date.now() + LOCK_TIME_MS
  }

  failedAttempts.set(key, current)

  return {
    failedCount: current.count,
    lockedUntil: current.lockedUntil,
  }
}

function clearFailedAttempts(req, username) {
  const key = buildAttemptKey(req, username)
  failedAttempts.delete(key)
}

module.exports = {
  getAttemptState,
  registerFailedAttempt,
  clearFailedAttempts,
}
