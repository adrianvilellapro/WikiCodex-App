const { prisma } = require('../lib/prisma')

let tableReadyPromise = null

async function ensureAdminAuditTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS admin_auditoria (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          actor_usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
          accion text NOT NULL,
          entidad_tipo text,
          entidad_id uuid,
          resumen text,
          detalles jsonb,
          creado_en timestamptz NOT NULL DEFAULT now()
        )
      `)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_admin_auditoria_creado_en
          ON admin_auditoria (creado_en DESC)
      `)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_admin_auditoria_actor
          ON admin_auditoria (actor_usuario_id, creado_en DESC)
      `)
    })()
  }

  await tableReadyPromise
}

async function logAdminAction({
  actorUsuarioId,
  accion,
  entidadTipo = null,
  entidadId = null,
  resumen = null,
  detalles = null,
}) {
  await ensureAdminAuditTable()

  const entidadUuid = entidadId ? String(entidadId) : null
  const detallesJson = detalles ? JSON.stringify(detalles) : null

  await prisma.$executeRaw`
    INSERT INTO admin_auditoria (
      actor_usuario_id,
      accion,
      entidad_tipo,
      entidad_id,
      resumen,
      detalles
    )
    VALUES (
      ${actorUsuarioId}::uuid,
      ${accion},
      ${entidadTipo},
      ${entidadUuid}::uuid,
      ${resumen},
      ${detallesJson}::jsonb
    )
  `
}

async function listRecentAdminAudit({ limit = 8 } = {}) {
  await ensureAdminAuditTable()
  const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 50))

  const rows = await prisma.$queryRaw`
    SELECT
      aa.id,
      aa.actor_usuario_id,
      aa.accion,
      aa.entidad_tipo,
      aa.entidad_id,
      aa.resumen,
      aa.detalles,
      aa.creado_en,
      u.nombre_usuario AS actor_nombre_usuario
    FROM admin_auditoria aa
    LEFT JOIN usuarios u ON u.id = aa.actor_usuario_id
    ORDER BY aa.creado_en DESC
    LIMIT ${safeLimit}
  `

  return rows.map((row) => ({
    id: row.id,
    actorUsuarioId: row.actor_usuario_id,
    actorNombreUsuario: row.actor_nombre_usuario,
    accion: row.accion,
    entidadTipo: row.entidad_tipo,
    entidadId: row.entidad_id,
    resumen: row.resumen,
    detalles: row.detalles,
    creadoEn: row.creado_en,
  }))
}

module.exports = {
  ensureAdminAuditTable,
  listRecentAdminAudit,
  logAdminAction,
}
