const { Router } = require('express')
const { z } = require('zod')

const { requireAuth, requireRoles } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const { asyncHandler } = require('../lib/async-handler')
const { prisma } = require('../lib/prisma')
const {
  getRegistrationCapacity,
  getRegistrationConfig,
  updateRegistrationCode,
} = require('../services/registration-config.service')
const { logEntityChange } = require('../lib/audit')
const { logAdminAction } = require('../services/admin-audit.service')
const { validateAdminZone } = require('../services/admin-session.service')
const { passwordSchema } = require('./users.routes')

const settingsRouter = Router()

const updateRegistrationSettingsSchema = z.object({
  body: z
    .object({
      maxUsuarios: z.number().int().min(1).max(500).optional(),
      registroHabilitado: z.boolean().optional(),
    })
    .strict()
    .refine(
      (value) =>
        value.maxUsuarios !== undefined ||
        value.registroHabilitado !== undefined,
      'Debes indicar al menos un campo a actualizar.'
    ),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const updateRegistrationCodeSchema = z.object({
  body: z
    .object({
      nuevaClaveRegistro: passwordSchema,
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

function serializeRegistrationConfig(config) {
  return {
    id: config.id,
    maxUsuarios: config.max_usuarios,
    registroHabilitado: config.registro_habilitado,
    creadoEn: config.creado_en,
    actualizadoEn: config.actualizado_en,
  }
}

settingsRouter.use(requireAuth, requireRoles('administrador'))
settingsRouter.use(
  asyncHandler(async (req, _res, next) => {
    await validateAdminZone(req.auth.tokenPayload, req.auth.userId)
    next()
  })
)

settingsRouter.get(
  '/registration',
  asyncHandler(async (_req, res) => {
    const { config, totalUsuarios, plazasRestantes, limiteAlcanzado } =
      await getRegistrationCapacity()

    res.json({
      configuracion: serializeRegistrationConfig(config),
      capacidad: {
        totalUsuarios,
        plazasRestantes,
        limiteAlcanzado,
      },
    })
  })
)

settingsRouter.patch(
  '/registration',
  validate(updateRegistrationSettingsSchema),
  asyncHandler(async (req, res) => {
    const currentConfig = await getRegistrationConfig()
    const { maxUsuarios, registroHabilitado } = req.validated.body

    const updatedConfig = await prisma.configuracionRegistro.update({
      where: { id: currentConfig.id },
      data: {
        max_usuarios: maxUsuarios,
        registro_habilitado: registroHabilitado,
      },
    })

    await logEntityChange({
      tipoEntidadCodigo: 'configuracion',
      entidadPk: currentConfig.id,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'update',
      resumen: 'Configuracion de registro actualizada.',
      valorNuevo: {
        maxUsuarios,
        registroHabilitado,
      },
    })
    await logAdminAction({
      actorUsuarioId: req.auth.userId,
      accion: 'actualizar_configuracion_registro',
      entidadTipo: 'configuracion',
      entidadId: currentConfig.id,
      resumen: 'Configuracion de registro actualizada.',
      detalles: { maxUsuarios, registroHabilitado },
    })

    res.json({
      configuracion: serializeRegistrationConfig(updatedConfig),
    })
  })
)

settingsRouter.patch(
  '/registration/code',
  validate(updateRegistrationCodeSchema),
  asyncHandler(async (req, res) => {
    const currentConfig = await getRegistrationConfig()
    await updateRegistrationCode(req.validated.body.nuevaClaveRegistro)

    await logEntityChange({
      tipoEntidadCodigo: 'configuracion',
      entidadPk: currentConfig.id,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'permission_change',
      nombreCampo: 'hash_clave_registro',
      resumen: 'La clave de registro ha sido actualizada.',
    })
    await logAdminAction({
      actorUsuarioId: req.auth.userId,
      accion: 'cambiar_clave_registro',
      entidadTipo: 'configuracion',
      entidadId: currentConfig.id,
      resumen: 'Clave de registro actualizada.',
    })

    res.json({
      message: 'Clave de registro actualizada correctamente.',
    })
  })
)

module.exports = {
  settingsRouter,
}
