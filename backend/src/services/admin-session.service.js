const crypto = require('crypto')

const { env } = require('../config/env')
const { prisma } = require('../lib/prisma')
const { createHttpError } = require('../lib/errors')

const ADMIN_TOKEN_TTL_MS = 5 * 60 * 1000
const ADMIN_ROTATION_INTERVAL_MS = 2 * 60 * 1000
const ADMIN_ABSOLUTE_SESSION_TTL_MS = 8 * 60 * 60 * 1000
const ADMIN_ZONE_TTL_MS = 30 * 60 * 1000

let tableReadyPromise = null

function nowPlus(ms) {
  return new Date(Date.now() + ms)
}

function createTokenId() {
  return crypto.randomUUID()
}

function safeCompareSecret(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8')
  const rightBuffer = Buffer.from(String(right || ''), 'utf8')

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

async function ensureAdminSessionTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS admin_sesiones (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          token_id text NOT NULL,
          activo boolean NOT NULL DEFAULT true,
          creado_en timestamptz NOT NULL DEFAULT now(),
          ultimo_rotado_en timestamptz NOT NULL DEFAULT now(),
          expira_en timestamptz NOT NULL
        )
      `)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_admin_sesiones_usuario_activo
          ON admin_sesiones (usuario_id, activo)
      `)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE admin_sesiones
          ADD COLUMN IF NOT EXISTS zona_desbloqueada_en timestamptz
      `)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE admin_sesiones
          ADD COLUMN IF NOT EXISTS zona_expira_en timestamptz
      `)
    })()
  }

  await tableReadyPromise
}

async function createAdminSession(userId) {
  await ensureAdminSessionTable()

  const tokenId = createTokenId()
  const expiresAt = nowPlus(ADMIN_ABSOLUTE_SESSION_TTL_MS)
  const rows = await prisma.$queryRaw`
    INSERT INTO admin_sesiones (usuario_id, token_id, expira_en)
    VALUES (${userId}::uuid, ${tokenId}, ${expiresAt})
    RETURNING id, token_id, expira_en
  `

  const session = rows[0]
  return {
    sessionId: session.id,
    tokenId: session.token_id,
    expiresAt: session.expira_en,
    tokenTtlMs: ADMIN_TOKEN_TTL_MS,
    rotationIntervalMs: ADMIN_ROTATION_INTERVAL_MS,
  }
}

async function validateAdminSession(payload, userId) {
  await ensureAdminSessionTable()

  if (!payload.adminSessionId || !payload.adminTokenId) {
    throw createHttpError(401, 'La sesion de administrador no es valida.')
  }

  const rows = await prisma.$queryRaw`
    SELECT id, token_id, activo, expira_en, zona_desbloqueada_en, zona_expira_en
    FROM admin_sesiones
    WHERE id = ${payload.adminSessionId}::uuid
      AND usuario_id = ${userId}::uuid
    LIMIT 1
  `
  const session = rows[0]

  if (
    !session ||
    !session.activo ||
    session.token_id !== payload.adminTokenId ||
    new Date(session.expira_en).getTime() <= Date.now()
  ) {
    throw createHttpError(
      401,
      'La sesion de administrador ha expirado o fue reemplazada.'
    )
  }

  return session
}

async function unlockAdminZone(payload, userId, password) {
  await validateAdminSession(payload, userId)

  if (!safeCompareSecret(password, env.ADMIN_ZONE_PASSWORD)) {
    throw createHttpError(
      403,
      'La clave de zona administrativa no es correcta.'
    )
  }

  const zoneExpiresAt = nowPlus(ADMIN_ZONE_TTL_MS)
  const rows = await prisma.$queryRaw`
    UPDATE admin_sesiones
    SET zona_desbloqueada_en = now(),
        zona_expira_en = ${zoneExpiresAt}
    WHERE id = ${payload.adminSessionId}::uuid
      AND usuario_id = ${userId}::uuid
      AND activo = true
      AND expira_en > now()
    RETURNING zona_expira_en
  `

  const session = rows[0]
  if (!session) {
    throw createHttpError(401, 'No se pudo desbloquear la zona administrativa.')
  }

  return {
    expiresAt: session.zona_expira_en,
    ttlMs: ADMIN_ZONE_TTL_MS,
  }
}

async function validateAdminZone(payload, userId) {
  const session = await validateAdminSession(payload, userId)

  if (
    !session.zona_expira_en ||
    new Date(session.zona_expira_en).getTime() <= Date.now()
  ) {
    throw createHttpError(
      403,
      'Debes desbloquear la zona administrativa antes de continuar.'
    )
  }

  return session
}

async function rotateAdminSession(payload, userId) {
  await validateAdminSession(payload, userId)

  const tokenId = createTokenId()
  const rows = await prisma.$queryRaw`
    UPDATE admin_sesiones
    SET token_id = ${tokenId},
        ultimo_rotado_en = now()
    WHERE id = ${payload.adminSessionId}::uuid
      AND usuario_id = ${userId}::uuid
      AND activo = true
      AND expira_en > now()
    RETURNING id, token_id, expira_en
  `

  const session = rows[0]
  if (!session) {
    throw createHttpError(401, 'No se pudo rotar la sesion de administrador.')
  }

  return {
    sessionId: session.id,
    tokenId: session.token_id,
    expiresAt: session.expira_en,
    tokenTtlMs: ADMIN_TOKEN_TTL_MS,
    rotationIntervalMs: ADMIN_ROTATION_INTERVAL_MS,
  }
}

async function revokeAdminSession(payload, userId) {
  if (!payload?.adminSessionId) {
    return
  }

  await ensureAdminSessionTable()
  await prisma.$executeRaw`
    UPDATE admin_sesiones
    SET activo = false
    WHERE id = ${payload.adminSessionId}::uuid
      AND usuario_id = ${userId}::uuid
  `
}

async function revokeAllAdminSessions(userId) {
  await ensureAdminSessionTable()

  await prisma.$executeRaw`
    UPDATE admin_sesiones
    SET activo = false
    WHERE usuario_id = ${userId}::uuid
  `
}

module.exports = {
  ADMIN_TOKEN_TTL_MS,
  ADMIN_ROTATION_INTERVAL_MS,
  ADMIN_ZONE_TTL_MS,
  createAdminSession,
  ensureAdminSessionTable,
  revokeAllAdminSessions,
  rotateAdminSession,
  revokeAdminSession,
  unlockAdminZone,
  validateAdminZone,
  validateAdminSession,
}
