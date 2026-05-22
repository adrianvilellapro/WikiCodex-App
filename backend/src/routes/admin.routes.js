const { Router } = require('express')
const { z } = require('zod')

const { prisma } = require('../lib/prisma')
const { hashValue } = require('../lib/password')
const { asyncHandler } = require('../lib/async-handler')
const { createHttpError } = require('../lib/errors')
const { requireAuth, requireRoles } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const {
  getRegistrationCapacity,
} = require('../services/registration-config.service')
const {
  ensureAdminSessionTable,
  revokeAllAdminSessions,
  unlockAdminZone,
  validateAdminZone,
} = require('../services/admin-session.service')
const {
  ensureAdminAuditTable,
  listRecentAdminAudit,
  logAdminAction,
} = require('../services/admin-audit.service')
const {
  deleteCampaignAsAdmin,
  deleteUserAsAdmin,
  listAdminCampaigns,
} = require('../services/admin-destruction.service')

const adminRouter = Router()

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(
    /^[A-Za-z0-9_ñÑ]+$/u,
    'El nombre de usuario solo puede contener letras, numeros, ñ y guiones bajos.'
  )

const passwordSchema = z.string().min(10).max(100)
const roleCodeSchema = z.enum(['jugador'])

const createUserSchema = z.object({
  body: z
    .object({
      nombreUsuario: usernameSchema,
      contrasena: passwordSchema,
      rolCodigo: roleCodeSchema.optional().default('jugador'),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const unlockAdminZoneSchema = z.object({
  body: z
    .object({
      claveZonaAdmin: z.string().min(10).max(200),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
})

const campaignIdParamsSchema = z.object({
  campaignId: z.string().uuid(),
})

const destructivePasswordBodySchema = z
  .object({
    claveDestructiva: z.string().min(1).max(200),
  })
  .strict()

const userIdSchema = z.object({
  body: z.object({}).strict(),
  params: userIdParamsSchema,
  query: z.object({}).strict(),
})

const resetPasswordSchema = z.object({
  body: z
    .object({
      nuevaContrasena: passwordSchema,
    })
    .strict(),
  params: userIdSchema.shape.params,
  query: z.object({}).strict(),
})

const deleteUserSchema = z.object({
  body: destructivePasswordBodySchema,
  params: userIdParamsSchema,
  query: z.object({}).strict(),
})

const deleteCampaignSchema = z.object({
  body: destructivePasswordBodySchema,
  params: campaignIdParamsSchema,
  query: z.object({}).strict(),
})

function serializeAdminUser(user) {
  return {
    id: user.id,
    nombreUsuario: user.nombre_usuario,
    imagenPerfilUrl: user.imagen_perfil_url,
    creadoEn: user.creado_en,
    actualizadoEn: user.actualizado_en,
    rol: user.roles
      ? {
          id: user.roles.id,
          codigo: user.roles.codigo,
          nombre: user.roles.nombre,
        }
      : null,
    conteos: user.conteos || null,
  }
}

function userInclude() {
  return {
    roles: {
      select: {
        id: true,
        codigo: true,
        nombre: true,
      },
    },
  }
}

async function getUserBlockers(userId) {
  const [
    personajesCreados,
    personajesPropios,
    objetos,
    lugares,
    hechizos,
    poderes,
    campanasCreadas,
    campanasMaster,
    comentarios,
    relacionesWiki,
  ] = await Promise.all([
    prisma.personajes.count({
      where: { creado_por_usuario_id: userId },
    }),
    prisma.personajes.count({
      where: { propietario_usuario_id: userId },
    }),
    prisma.objetos.count({ where: { creado_por_usuario_id: userId } }),
    prisma.lugares.count({ where: { creado_por_usuario_id: userId } }),
    prisma.hechizos.count({ where: { creado_por_usuario_id: userId } }),
    prisma.poderes.count({ where: { creado_por_usuario_id: userId } }),
    prisma.campanas.count({ where: { creado_por_usuario_id: userId } }),
    prisma.campanas.count({ where: { master_usuario_id: userId } }),
    prisma.comentarios.count({ where: { usuario_id: userId } }),
    prisma.relaciones_wiki.count({ where: { creado_por_usuario_id: userId } }),
  ])

  return {
    personajesCreados,
    personajesPropios,
    objetos,
    lugares,
    hechizos,
    poderes,
    campanasCreadas,
    campanasMaster,
    comentarios,
    relacionesWiki,
  }
}

async function attachUserCounts(users) {
  const rows = await Promise.all(
    users.map(async (user) => ({
      ...user,
      conteos: await getUserBlockers(user.id),
    }))
  )

  return rows
}

adminRouter.use(requireAuth, requireRoles('administrador'))

adminRouter.post(
  '/zone/unlock',
  validate(unlockAdminZoneSchema),
  asyncHandler(async (req, res) => {
    const zone = await unlockAdminZone(
      req.auth.tokenPayload,
      req.auth.userId,
      req.validated.body.claveZonaAdmin
    )

    await logAdminAction({
      actorUsuarioId: req.auth.userId,
      accion: 'desbloquear_zona_admin',
      entidadTipo: 'sistema',
      resumen: 'Zona administrativa desbloqueada.',
      detalles: { expiraEn: zone.expiresAt },
    })

    res.json({
      zonaAdmin: {
        desbloqueada: true,
        expiraEn: zone.expiresAt,
        ttlMs: zone.ttlMs,
      },
    })
  })
)

adminRouter.use(
  asyncHandler(async (req, _res, next) => {
    await validateAdminZone(req.auth.tokenPayload, req.auth.userId)
    next()
  })
)

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    await Promise.all([ensureAdminSessionTable(), ensureAdminAuditTable()])

    const [
      usuarios,
      administradores,
      campanas,
      personajes,
      criaturas,
      objetos,
      lugares,
      hechizos,
      poderes,
      comentarios,
      favoritos,
      sesionesAdminRows,
      registration,
      recentUsers,
      recentAudit,
    ] = await Promise.all([
      prisma.usuarios.count(),
      prisma.usuarios.count({
        where: { roles: { codigo: 'administrador' } },
      }),
      prisma.campanas.count(),
      prisma.personajes.count(),
      prisma.personajes.count({ where: { es_criatura: true } }),
      prisma.objetos.count(),
      prisma.lugares.count(),
      prisma.hechizos.count(),
      prisma.poderes.count(),
      prisma.comentarios.count(),
      prisma.favoritos_usuario.count(),
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM admin_sesiones
        WHERE activo = true AND expira_en > now()
      `,
      getRegistrationCapacity(),
      prisma.usuarios.findMany({
        take: 8,
        orderBy: { creado_en: 'desc' },
        include: userInclude(),
      }),
      listRecentAdminAudit({ limit: 8 }),
    ])
    const recentUsersWithCounts = await attachUserCounts(recentUsers)

    res.json({
      estadisticas: {
        usuarios,
        administradores,
        campanas,
        personajes,
        criaturas,
        objetos,
        lugares,
        hechizos,
        poderes,
        comentarios,
        favoritos,
        sesionesAdminActivas: sesionesAdminRows[0]?.total || 0,
      },
      registro: {
        configuracion: {
          id: registration.config.id,
          maxUsuarios: registration.config.max_usuarios,
          registroHabilitado: registration.config.registro_habilitado,
          actualizadoEn: registration.config.actualizado_en,
        },
        capacidad: {
          totalUsuarios: registration.totalUsuarios,
          plazasRestantes: registration.plazasRestantes,
          limiteAlcanzado: registration.limiteAlcanzado,
        },
      },
      usuariosRecientes: recentUsersWithCounts.map(serializeAdminUser),
      auditoriaReciente: recentAudit,
    })
  })
)

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.usuarios.findMany({
      orderBy: [{ creado_en: 'desc' }, { nombre_usuario: 'asc' }],
      include: userInclude(),
    })

    const usersWithCounts = await attachUserCounts(users)

    res.json({
      items: usersWithCounts.map(serializeAdminUser),
    })
  })
)

adminRouter.get(
  '/campaigns',
  asyncHandler(async (_req, res) => {
    res.json({
      items: await listAdminCampaigns(),
    })
  })
)

adminRouter.post(
  '/users',
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const { nombreUsuario, contrasena, rolCodigo } = req.validated.body

    const existingUser = await prisma.usuarios.findUnique({
      where: { nombre_usuario: nombreUsuario.trim() },
      select: { id: true },
    })

    if (existingUser) {
      throw createHttpError(409, 'Ese nombre de usuario ya esta en uso.')
    }

    const role = await prisma.roles.findUnique({
      where: { codigo: rolCodigo },
    })

    if (!role) {
      throw createHttpError(400, 'El rol indicado no existe.')
    }

    const user = await prisma.usuarios.create({
      data: {
        rol_id: role.id,
        nombre_usuario: nombreUsuario.trim(),
        hash_contrasena: await hashValue(contrasena),
      },
      include: userInclude(),
    })

    await logAdminAction({
      actorUsuarioId: req.auth.userId,
      accion: 'crear_usuario',
      entidadTipo: 'usuario',
      entidadId: user.id,
      resumen: `Usuario ${user.nombre_usuario} creado desde administracion.`,
      detalles: { rolCodigo },
    })

    res.status(201).json({
      item: serializeAdminUser(user),
    })
  })
)

adminRouter.patch(
  '/users/:userId/password',
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.validated.params
    const { nuevaContrasena } = req.validated.body

    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre_usuario: true,
        roles: { select: { codigo: true } },
      },
    })

    if (!user) {
      throw createHttpError(404, 'Usuario no encontrado.')
    }

    await prisma.usuarios.update({
      where: { id: userId },
      data: {
        hash_contrasena: await hashValue(nuevaContrasena),
      },
    })

    if (user.roles?.codigo === 'administrador') {
      await revokeAllAdminSessions(userId)
    }

    await logAdminAction({
      actorUsuarioId: req.auth.userId,
      accion: 'cambiar_contrasena_usuario',
      entidadTipo: 'usuario',
      entidadId: userId,
      resumen: `Contrasena de ${user.nombre_usuario} cambiada por administracion.`,
    })

    res.json({
      message: 'Contrasena de usuario actualizada correctamente.',
    })
  })
)

adminRouter.delete(
  '/users/:userId',
  validate(deleteUserSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.validated.params
    const { claveDestructiva } = req.validated.body
    const result = await deleteUserAsAdmin({
      userId,
      actorUserId: req.auth.userId,
      claveDestructiva,
    })

    await logAdminAction({
      actorUsuarioId: req.auth.userId,
      accion: 'borrar_usuario',
      entidadTipo: 'usuario',
      entidadId: userId,
      resumen: `Usuario ${result.user.nombre_usuario} borrado desde administracion.`,
      detalles: result.summary,
    })

    res.json({
      message: 'Usuario y contenido vinculado borrados correctamente.',
      resumen: result.summary,
    })
  })
)

adminRouter.delete(
  '/campaigns/:campaignId',
  validate(deleteCampaignSchema),
  asyncHandler(async (req, res) => {
    const { campaignId } = req.validated.params
    const { claveDestructiva } = req.validated.body
    const result = await deleteCampaignAsAdmin({
      campaignId,
      claveDestructiva,
    })

    await logAdminAction({
      actorUsuarioId: req.auth.userId,
      accion: 'borrar_campana',
      entidadTipo: 'campana',
      entidadId: campaignId,
      resumen: `Campana ${result.campaign.nombre} borrada desde administracion.`,
      detalles: result.summary,
    })

    res.json({
      message: 'Campana y contenido interno borrados correctamente.',
      resumen: result.summary,
    })
  })
)

module.exports = {
  adminRouter,
}
