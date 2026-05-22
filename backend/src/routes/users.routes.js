const { Router } = require('express')
const { z } = require('zod')

const { prisma } = require('../lib/prisma')
const { verifyValue, hashValue } = require('../lib/password')
const { asyncHandler } = require('../lib/async-handler')
const { createHttpError } = require('../lib/errors')
const { requireAuth, requireRoles } = require('../middlewares/auth.middleware')
const { validate } = require('../middlewares/validate.middleware')
const { logEntityChange } = require('../lib/audit')
const {
  assertManagedImageUrl,
  cleanupCloudinaryAssets,
} = require('../lib/media')
const {
  buildVisibleCharacterWhere,
  decodeCharacterCursor,
  listVisibleCharactersPage,
} = require('../services/character-list.service')
const { listVisibleObjects } = require('../services/object.service')
const { listVisiblePlaces } = require('../services/place.service')
const { listPowers } = require('../services/power.service')
const { listSpells } = require('../services/spell.service')
const { isAdminUser } = require('../lib/user-visibility')

const usersRouter = Router()
const deprecatedCharacterTraitTypeNames = ['Pruebas Wiki']

function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

function isDeprecatedCharacterTraitTypeName(name) {
  const normalizedName = normalizeLooseText(name)

  return deprecatedCharacterTraitTypeNames.some(
    (deprecatedName) => normalizeLooseText(deprecatedName) === normalizedName
  )
}

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
const themeModeSchema = z.enum(['light', 'dark'])
const themeColorSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
const SHEET_VISUAL_MODES = [
  'wikicodex',
  'legacy',
  'arcane-night',
  'ancient-parchment',
  'ink-paper',
  'grimoire',
  'high-contrast',
]
const sheetVisualModeSchema = z.enum(SHEET_VISUAL_MODES)

const updateProfileSchema = z.object({
  body: z
    .object({
      nombreUsuario: usernameSchema.optional(),
      imagenPerfilUrl: z.string().url().nullable().optional(),
      temaModo: themeModeSchema.optional(),
      temaColorHex: themeColorSchema.optional(),
      modoVisualFichas: sheetVisualModeSchema.optional(),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const changePasswordSchema = z.object({
  body: z
    .object({
      contrasenaActual: z.string().min(1),
      nuevaContrasena: passwordSchema,
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const listMyCharactersSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
      cursor: z.string().min(1).optional(),
      all: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
    })
    .strict(),
})

const traitIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    traitId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const savedTraitBodySchema = z.object({
  tipoRasgoId: z.string().uuid().optional(),
  nombre: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().min(1),
  origenTipo: z.enum(['usuario', 'clase', 'subclase', 'dote']).optional(),
  origenEntidadId: z.string().uuid().nullable().optional(),
  origenEntidadNombre: z.string().trim().max(200).nullable().optional(),
  origenGrupoId: z.string().trim().max(240).nullable().optional(),
  origenRasgoClave: z.string().trim().max(240).nullable().optional(),
  origenRasgoNombre: z.string().trim().max(200).nullable().optional(),
  origenDatos: z.record(z.string(), z.unknown()).optional(),
})

const savedTraitBulkSchema = z.object({
  body: z
    .object({
      traits: z.array(savedTraitBodySchema.strict()).min(1).max(120),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const removeSavedTraitSourceSchema = z.object({
  body: z
    .object({
      origenTipo: z.enum(['clase', 'subclase', 'dote']),
      origenEntidadId: z.string().uuid().optional(),
      origenGrupoId: z.string().trim().max(240).optional(),
    })
    .strict()
    .refine(
      (value) => Boolean(value.origenEntidadId || value.origenGrupoId),
      'Indica una entidad o grupo de origen.'
    ),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const publicProfileBodySchema = z.object({
  descripcion: z.string().trim().max(4000).nullable().optional(),
  personajeDestacadoId: z
    .preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.string().uuid().nullable()
    )
    .optional(),
  objetoDestacadoId: z
    .preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.string().uuid().nullable()
    )
    .optional(),
  lugarDestacadoId: z
    .preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.string().uuid().nullable()
    )
    .optional(),
  partidaDestacadaId: z
    .preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.string().uuid().nullable()
    )
    .optional(),
  hechizoDestacadoId: z
    .preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.string().uuid().nullable()
    )
    .optional(),
  poderDestacadoId: z
    .preprocess(
      (value) => (value === '' || value === undefined ? null : value),
      z.string().uuid().nullable()
    )
    .optional(),
})

const createSavedTraitSchema = z.object({
  body: savedTraitBodySchema.strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const updateSavedTraitSchema = z.object({
  body: savedTraitBodySchema.partial().strict(),
  params: z.object({
    traitId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const updatePublicProfileSchema = z.object({
  body: publicProfileBodySchema.strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
})

const publicProfileUserIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

const publicProfileCharactersSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      cursor: z.string().min(1).optional(),
    })
    .strict(),
})

const publicProfileObjectsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      cursor: z.coerce.number().int().min(0).optional(),
    })
    .strict(),
})

const publicProfilePlacesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      cursor: z.coerce.number().int().min(0).optional(),
    })
    .strict(),
})

const publicProfileSpellsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      cursor: z.coerce.number().int().min(0).optional(),
    })
    .strict(),
})

const publicProfilePowersSchema = publicProfileSpellsSchema

const listMyObjectsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      cursor: z.coerce.number().int().min(0).optional(),
      all: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
    })
    .strict(),
})

const listMyPlacesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      cursor: z.coerce.number().int().min(0).optional(),
      all: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
    })
    .strict(),
})

const listMySpellsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      cursor: z.coerce.number().int().min(0).optional(),
      all: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
    })
    .strict(),
})

const listMyPowersSchema = listMySpellsSchema

const updateRoleSchema = z.object({
  body: z
    .object({
      rolCodigo: z.never(),
    })
    .strict(),
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z.object({}).strict(),
})

function serializeUser(user) {
  return {
    id: user.id,
    nombreUsuario: user.nombre_usuario,
    imagenPerfilUrl: user.imagen_perfil_url,
    temaModo: user.tema_modo || 'light',
    temaColorHex: user.tema_color_hex || '#026b00',
    modoVisualFichas: user.modo_visual_fichas || 'wikicodex',
    creadoEn: user.creado_en,
    actualizadoEn: user.actualizado_en,
    rol: user.roles
      ? {
          id: user.roles.id,
          codigo: user.roles.codigo,
          nombre: user.roles.nombre,
        }
      : null,
  }
}

function normalizeSheetVisualMode(mode) {
  return SHEET_VISUAL_MODES.includes(mode) ? mode : 'wikicodex'
}

async function getUserSheetVisualMode(userId) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT modo_visual_fichas AS "modoVisualFichas"
      FROM usuarios
      WHERE id = CAST(${userId} AS uuid)
      LIMIT 1
    `

    return normalizeSheetVisualMode(rows[0]?.modoVisualFichas)
  } catch {
    return 'wikicodex'
  }
}

async function updateUserSheetVisualMode(userId, mode) {
  const safeMode = normalizeSheetVisualMode(mode)

  await prisma.$executeRaw`
    UPDATE usuarios
    SET modo_visual_fichas = ${safeMode},
        actualizado_en = now()
    WHERE id = CAST(${userId} AS uuid)
  `

  return safeMode
}

function serializeProfileCharacter(character) {
  return {
    id: character.id,
    nombre: character.nombre,
    titulo: character.titulo,
    imagenPrincipalUrl: character.imagen_principal_url,
    creadoEn: character.creado_en,
    actualizadoEn: character.actualizado_en,
    modoVista: 'full',
  }
}

function serializeProfileCharacterPage(items) {
  return items.map(serializeProfileCharacter)
}

function serializeProfileObject(object) {
  return {
    id: object.id,
    nombre: object.nombre,
    descripcion: object.descripcion,
    imagenPrincipalUrl: object.imagen_url,
    tier: object.tiers_objeto
      ? {
          id: object.tiers_objeto.id,
          nombre: object.tiers_objeto.nombre,
          ordenVisualizacion: object.tiers_objeto.orden_visualizacion,
        }
      : null,
    tipoMagicoCodigo: object.tipo_magico_codigo,
    creadoEn: object.creado_en,
    actualizadoEn: object.actualizado_en,
    modoVista: 'full',
  }
}

function serializeProfileObjectPage(items) {
  return items.map(serializeProfileObject)
}

function serializeProfilePlace(place) {
  return {
    id: place.id,
    nombre: place.nombre,
    descripcion: place.descripcion,
    imagenPrincipalUrl: place.imagen_url,
    tipo: place.tipos_lugar
      ? {
          id: place.tipos_lugar.id,
          nombre: place.tipos_lugar.nombre,
          ordenVisualizacion: place.tipos_lugar.orden_visualizacion,
        }
      : null,
    lugarPadreId: place.lugar_padre_id,
    creadoEn: place.creado_en,
    actualizadoEn: place.actualizado_en,
    modoVista: 'full',
  }
}

function serializeProfilePlacePage(items) {
  return items.map(serializeProfilePlace)
}

function serializeProfileCampaign(campaign, userId) {
  const isMaster = campaign.master_usuario_id === userId

  return {
    id: campaign.id,
    nombre: campaign.nombre,
    descripcion: campaign.descripcion,
    imagenUrl: campaign.imagen_url,
    rolEnCampana: isMaster ? 'Master' : 'Jugador',
    totalJugadores: campaign.campana_jugadores?.length || 0,
    totalAventuras: campaign.aventuras?.length || 0,
    creadoEn: campaign.creado_en,
    actualizadoEn: campaign.actualizado_en,
  }
}

function serializeSavedTrait(trait) {
  return {
    id: trait.id,
    tipoRasgoId: trait.tipo_rasgo_id,
    nombre: trait.nombre,
    descripcion: trait.descripcion,
    origenTipo: trait.origen_tipo || 'usuario',
    origenEntidadId: trait.origen_entidad_id,
    origenEntidadNombre: trait.origen_entidad_nombre,
    origenGrupoId: trait.origen_grupo_id,
    origenRasgoClave: trait.origen_rasgo_clave,
    origenRasgoNombre: trait.origen_rasgo_nombre,
    origenDatos: trait.origen_datos || {},
    creadoEn: trait.creado_en,
    actualizadoEn: trait.actualizado_en,
    tipoRasgo: trait.tipos_rasgo
      ? {
          id: trait.tipos_rasgo.id,
          nombre: trait.tipos_rasgo.nombre,
          ordenVisualizacion: trait.tipos_rasgo.orden_visualizacion,
        }
      : null,
  }
}

async function resolveSavedTraitTypeId(tipoRasgoId, origenTipo = 'usuario') {
  if (tipoRasgoId) {
    const traitType = await prisma.tipos_rasgo.findUnique({
      where: { id: tipoRasgoId },
      select: { id: true, nombre: true },
    })

    if (!traitType || isDeprecatedCharacterTraitTypeName(traitType.nombre)) {
      throw createHttpError(400, 'Tipo de rasgo no valido.')
    }

    return traitType.id
  }

  const fallbackTypes = await prisma.tipos_rasgo.findMany({
    orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true },
  })
  const preferredName = origenTipo === 'dote' ? 'dote' : 'habilidades'
  const preferred = fallbackTypes.find(
    (item) =>
      normalizeLooseText(item.nombre) === preferredName &&
      !isDeprecatedCharacterTraitTypeName(item.nombre)
  )
  const fallback =
    preferred ||
    fallbackTypes.find(
      (item) => !isDeprecatedCharacterTraitTypeName(item.nombre)
    )

  if (!fallback) {
    throw createHttpError(400, 'No hay tipos de rasgo disponibles.')
  }

  return fallback.id
}

function buildSavedTraitSourceData(data) {
  const origenTipo = data.origenTipo || 'usuario'

  return {
    origen_tipo: origenTipo,
    origen_entidad_id: data.origenEntidadId || null,
    origen_entidad_nombre: data.origenEntidadNombre || null,
    origen_grupo_id: data.origenGrupoId || null,
    origen_rasgo_clave: data.origenRasgoClave || null,
    origen_rasgo_nombre: data.origenRasgoNombre || data.nombre || null,
    origen_datos: data.origenDatos || {},
  }
}

async function findDuplicateSavedTrait(userId, data, tipoRasgoId) {
  const hasSourceIdentity =
    data.origenTipo &&
    data.origenTipo !== 'usuario' &&
    data.origenEntidadId &&
    data.origenRasgoClave

  if (hasSourceIdentity) {
    return prisma.rasgos.findFirst({
      where: {
        creador_usuario_id: userId,
        es_reutilizable: true,
        origen_tipo: data.origenTipo,
        origen_entidad_id: data.origenEntidadId,
        origen_rasgo_clave: data.origenRasgoClave,
      },
      include: {
        tipos_rasgo: true,
      },
    })
  }

  return prisma.rasgos.findFirst({
    where: {
      creador_usuario_id: userId,
      tipo_rasgo_id: tipoRasgoId,
      nombre: data.nombre,
      descripcion: data.descripcion,
      es_reutilizable: true,
    },
    include: {
      tipos_rasgo: true,
    },
  })
}

async function createReusableTraitFromPayload(userId, data) {
  const tipoRasgoId = await resolveSavedTraitTypeId(
    data.tipoRasgoId,
    data.origenTipo
  )
  const duplicate = await findDuplicateSavedTrait(userId, data, tipoRasgoId)

  if (duplicate) {
    return { trait: duplicate, created: false }
  }

  const trait = await prisma.rasgos.create({
    data: {
      creador_usuario_id: userId,
      tipo_rasgo_id: tipoRasgoId,
      nombre: data.nombre,
      descripcion: data.descripcion,
      es_reutilizable: true,
      ...buildSavedTraitSourceData(data),
    },
    include: {
      tipos_rasgo: true,
    },
  })

  return { trait, created: true }
}

async function deleteOrHideSavedTraits(traitIds) {
  if (!traitIds.length) {
    return { removed: 0 }
  }

  const linkedRows = await prisma.personaje_rasgos.findMany({
    where: { rasgo_id: { in: traitIds } },
    select: { rasgo_id: true },
  })
  const linkedIds = new Set(linkedRows.map((item) => item.rasgo_id))
  const unlinkableIds = traitIds.filter((id) => !linkedIds.has(id))
  const linkedTraitIds = traitIds.filter((id) => linkedIds.has(id))

  if (linkedTraitIds.length) {
    await prisma.rasgos.updateMany({
      where: { id: { in: linkedTraitIds } },
      data: { es_reutilizable: false },
    })
  }

  if (unlinkableIds.length) {
    await prisma.rasgos.deleteMany({
      where: { id: { in: unlinkableIds } },
    })
  }

  return { removed: traitIds.length }
}

function serializePublicProfileFeaturedCharacter(character) {
  if (!character) {
    return null
  }

  return {
    id: character.id,
    nombre: character.nombre,
    titulo: character.titulo,
    imagenPrincipalUrl: character.imagen_principal_url,
    tier: character.tiers_personaje
      ? {
          id: character.tiers_personaje.id,
          nombre: character.tiers_personaje.nombre,
          ordenVisualizacion: character.tiers_personaje.orden_visualizacion,
        }
      : null,
    ambitoVisibilidadCodigo: character.ambito_visibilidad_codigo,
    creadoEn: character.creado_en,
  }
}

function serializePublicProfileFeaturedObject(object) {
  if (!object) {
    return null
  }

  return {
    id: object.id,
    nombre: object.nombre,
    descripcion: object.descripcion,
    imagenPrincipalUrl: object.imagen_url,
    tier: object.tiers_objeto
      ? {
          id: object.tiers_objeto.id,
          nombre: object.tiers_objeto.nombre,
          ordenVisualizacion: object.tiers_objeto.orden_visualizacion,
        }
      : null,
    tipoMagicoCodigo: object.tipo_magico_codigo,
    ambitoVisibilidadCodigo: object.ambito_visibilidad_codigo,
    creadoEn: object.creado_en,
  }
}

function serializePublicProfileFeaturedPlace(place) {
  if (!place) {
    return null
  }

  return {
    id: place.id,
    nombre: place.nombre,
    descripcion: place.descripcion,
    imagenPrincipalUrl: place.imagen_url,
    tipo: place.tipos_lugar
      ? {
          id: place.tipos_lugar.id,
          nombre: place.tipos_lugar.nombre,
          ordenVisualizacion: place.tipos_lugar.orden_visualizacion,
        }
      : null,
    ambitoVisibilidadCodigo: place.ambito_visibilidad_codigo,
    creadoEn: place.creado_en,
  }
}

function serializePublicProfileFeaturedSession(session) {
  if (!session) {
    return null
  }

  return {
    id: session.id,
    campanaId: session.campana_id,
    nombre: session.nombre,
    descripcion: session.descripcion,
    imagenUrl: session.imagen_url,
    jugadaEn: session.jugada_en,
    campana: session.campanas
      ? {
          id: session.campanas.id,
          nombre: session.campanas.nombre,
        }
      : null,
    creadoEn: session.creado_en,
  }
}

function serializePublicProfileFeaturedSpell(spell) {
  if (!spell) {
    return null
  }

  return {
    id: spell.id,
    nombre: spell.nombre,
    nivel: spell.nivel,
    escuela: spell.escuela,
    clases: spell.clases || [],
    esPublico: spell.es_publico,
    descripcion: spell.descripcion,
    creadoEn: spell.creado_en,
  }
}

function serializePublicProfileFeaturedPower(power) {
  if (!power) {
    return null
  }

  return {
    id: power.id,
    nombre: power.nombre,
    descripcion: power.descripcion,
    imagenUrl: power.imagen_url,
    ambitoVisibilidadCodigo: power.ambito_visibilidad_codigo,
    categorias: (power.asignaciones_categoria_poder || [])
      .map((item) => item.categorias_poder)
      .filter(Boolean)
      .map((category) => ({
        id: category.id,
        nombre: category.nombre,
      })),
    campanas: (power.poder_campanas || [])
      .map((item) => item.campanas)
      .filter(Boolean)
      .map((campaign) => ({
        id: campaign.id,
        nombre: campaign.nombre,
      })),
    creadoEn: power.creado_en,
  }
}

function serializePublicProfileItem({
  user,
  publicProfile,
  featuredCharacter,
  featuredObject,
  featuredPlace,
  featuredSession,
  featuredSpell,
  featuredPower,
  stats,
}) {
  return {
    usuario: serializeUser(user),
    perfil: {
      descripcion: publicProfile?.descripcion || '',
      personajeDestacado:
        serializePublicProfileFeaturedCharacter(featuredCharacter),
      objetoDestacado: serializePublicProfileFeaturedObject(featuredObject),
      lugarDestacado: serializePublicProfileFeaturedPlace(featuredPlace),
      partidaDestacada: serializePublicProfileFeaturedSession(featuredSession),
      hechizoDestacado: serializePublicProfileFeaturedSpell(featuredSpell),
      poderDestacado: serializePublicProfileFeaturedPower(featuredPower),
      actualizadoEn:
        publicProfile?.actualizado_en || user.actualizado_en || user.creado_en,
    },
    estadisticas: {
      personajesPublicos: stats?.personajesPublicos || 0,
      campanasComoMaster: stats?.campanasComoMaster || 0,
      campanasComoJugador: stats?.campanasComoJugador || 0,
    },
  }
}

function serializePublicProfileEditorItem({
  publicProfile,
  featuredCharacter,
  featuredObject,
  featuredPlace,
  featuredSession,
  featuredSpell,
  featuredPower,
}) {
  return {
    descripcion: publicProfile?.descripcion || '',
    personajeDestacadoId: publicProfile?.personaje_destacado_id || null,
    personajeDestacado:
      serializePublicProfileFeaturedCharacter(featuredCharacter),
    objetoDestacadoId: publicProfile?.objeto_destacado_id || null,
    objetoDestacado: serializePublicProfileFeaturedObject(featuredObject),
    lugarDestacadoId: publicProfile?.lugar_destacado_id || null,
    lugarDestacado: serializePublicProfileFeaturedPlace(featuredPlace),
    partidaDestacadaId: publicProfile?.partida_destacada_id || null,
    partidaDestacada: serializePublicProfileFeaturedSession(featuredSession),
    hechizoDestacadoId: publicProfile?.hechizo_destacado_id || null,
    hechizoDestacado: serializePublicProfileFeaturedSpell(featuredSpell),
    poderDestacadoId: publicProfile?.poder_destacado_id || null,
    poderDestacado: serializePublicProfileFeaturedPower(featuredPower),
    actualizadoEn: publicProfile?.actualizado_en || null,
  }
}

function serializePublicProfileSelectableCharacter(character) {
  return {
    id: character.id,
    nombre: character.nombre,
    titulo: character.titulo,
    imagenPrincipalUrl: character.imagen_principal_url,
    ambitoVisibilidadCodigo: character.ambito_visibilidad_codigo,
    creadoEn: character.creado_en,
  }
}

function serializePublicProfileSelectableObject(object) {
  return serializePublicProfileFeaturedObject(object)
}

function serializePublicProfileSelectablePlace(place) {
  return serializePublicProfileFeaturedPlace(place)
}

function serializePublicProfileSelectableSession(session) {
  return serializePublicProfileFeaturedSession(session)
}

function serializePublicProfileSelectableSpell(spell) {
  const item = serializePublicProfileFeaturedSpell(spell)

  if (!item) {
    return null
  }

  return {
    ...item,
    creadoPorUsuarioId: spell.creado_por_usuario_id,
    estaGuardado: Boolean(spell.hechizos_guardados_usuario?.length),
  }
}

function serializePublicProfileSelectablePower(power) {
  return serializePublicProfileFeaturedPower(power)
}

function buildPublicFeaturedCharacterWhere(userId) {
  return {
    propietario_usuario_id: userId,
    ambito_visibilidad_codigo: 'campana_completo',
  }
}

function buildPublicFeaturedObjectWhere(userId) {
  return {
    creado_por_usuario_id: userId,
    ambito_visibilidad_codigo: 'campana_completo',
  }
}

async function findPublicProfileByUserId(userId) {
  const profiles = await prisma.$queryRaw`
    SELECT
      id,
      usuario_id,
      personaje_destacado_id,
      objeto_destacado_id,
      lugar_destacado_id,
      partida_destacada_id,
      hechizo_destacado_id,
      poder_destacado_id,
      descripcion,
      creado_en,
      actualizado_en
    FROM perfiles_publicos_usuario
    WHERE usuario_id = ${userId}::uuid
    LIMIT 1
  `

  return profiles[0] || null
}

async function listVisibleCharactersCreatedByUser(
  targetUserId,
  req,
  options = {}
) {
  return listVisibleCharactersPage({
    req,
    baseWhere: {
      propietario_usuario_id: targetUserId,
    },
    limit: options.limit || 10,
    cursor: options.cursor || null,
  })
}

async function listVisibleObjectsCreatedByUser(
  targetUserId,
  req,
  options = {}
) {
  return listVisibleObjects({
    req,
    baseWhere: {
      creado_por_usuario_id: targetUserId,
    },
    limit: options.limit || 10,
    cursor: options.cursor || 0,
  })
}

async function listVisiblePlacesCreatedByUser(targetUserId, req, options = {}) {
  return listVisiblePlaces({
    req,
    baseWhere: {
      creado_por_usuario_id: targetUserId,
    },
    limit: options.limit || 10,
    cursor: options.cursor || 0,
  })
}

function buildPublicFeaturedPlaceWhere(userId) {
  return {
    creado_por_usuario_id: userId,
    ambito_visibilidad_codigo: 'campana_completo',
  }
}

function buildCampaignMembershipWhere(userId) {
  return {
    OR: [
      { master_usuario_id: userId },
      {
        campana_jugadores: {
          some: {
            usuario_id: userId,
          },
        },
      },
    ],
  }
}

function buildCampaignReadWhere(req) {
  if (req.auth.roleCode === 'administrador') {
    return {}
  }

  return {
    OR: [
      { privacidad_codigo: { not: 'privada' } },
      { master_usuario_id: req.auth.userId },
      {
        campana_jugadores: {
          some: {
            usuario_id: req.auth.userId,
          },
        },
      },
    ],
  }
}

function buildPublicFeaturedSessionWhere(userId, req) {
  return {
    campanas: {
      AND: [buildCampaignMembershipWhere(userId), buildCampaignReadWhere(req)],
    },
  }
}

function buildPublicFeaturedSpellWhere(userId) {
  return {
    es_publico: true,
    OR: [
      { creado_por_usuario_id: userId },
      { hechizos_guardados_usuario: { some: { usuario_id: userId } } },
    ],
  }
}

function buildPublicFeaturedPowerWhere(userId) {
  return {
    creado_por_usuario_id: userId,
    ambito_visibilidad_codigo: 'campana_completo',
  }
}

async function listVisibleSpellsCreatedByUser(targetUserId, req, options = {}) {
  return listSpells({
    req,
    limit: options.limit || 10,
    cursor: options.cursor || 0,
    filters: {
      createdByUserId: targetUserId,
    },
  })
}

async function listVisiblePowersCreatedByUser(targetUserId, req, options = {}) {
  return listPowers({
    req,
    limit: options.limit || 10,
    cursor: options.cursor || 0,
    filters: {
      createdByUserId: targetUserId,
    },
  })
}

usersRouter.use(requireAuth)

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const sheetVisualMode = await getUserSheetVisualMode(req.auth.userId)

    res.json({
      usuario: serializeUser({
        ...req.user,
        modo_visual_fichas: sheetVisualMode,
      }),
    })
  })
)

usersRouter.get(
  '/me/public-profile/editor',
  asyncHandler(async (req, res) => {
    const [
      publicProfile,
      availableCharacters,
      availableObjects,
      availablePlaces,
      availableSessions,
      availableSpells,
      availablePowers,
    ] = await Promise.all([
      findPublicProfileByUserId(req.auth.userId),
      prisma.personajes.findMany({
        where: buildPublicFeaturedCharacterWhere(req.auth.userId),
        select: {
          id: true,
          nombre: true,
          titulo: true,
          imagen_principal_url: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          tiers_personaje: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
        orderBy: [{ creado_en: 'desc' }, { nombre: 'asc' }],
      }),
      prisma.objetos.findMany({
        where: buildPublicFeaturedObjectWhere(req.auth.userId),
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          tipo_magico_codigo: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          tiers_objeto: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
        orderBy: [{ creado_en: 'desc' }, { nombre: 'asc' }],
      }),
      prisma.lugares.findMany({
        where: buildPublicFeaturedPlaceWhere(req.auth.userId),
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          tipos_lugar: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
        orderBy: [{ creado_en: 'desc' }, { nombre: 'asc' }],
      }),
      prisma.partidas.findMany({
        where: buildPublicFeaturedSessionWhere(req.auth.userId, req),
        select: {
          id: true,
          campana_id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          jugada_en: true,
          creado_en: true,
          campanas: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
        orderBy: [{ jugada_en: 'desc' }, { nombre: 'asc' }],
      }),
      prisma.hechizos.findMany({
        where: buildPublicFeaturedSpellWhere(req.auth.userId),
        select: {
          id: true,
          nombre: true,
          nivel: true,
          escuela: true,
          clases: true,
          creado_por_usuario_id: true,
          es_publico: true,
          descripcion: true,
          creado_en: true,
          hechizos_guardados_usuario: {
            where: { usuario_id: req.auth.userId },
            select: { id: true },
          },
        },
        orderBy: [{ creado_en: 'desc' }, { nombre: 'asc' }],
      }),
      prisma.poderes.findMany({
        where: buildPublicFeaturedPowerWhere(req.auth.userId),
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          asignaciones_categoria_poder: {
            select: {
              categorias_poder: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          poder_campanas: {
            select: {
              campanas: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
        orderBy: [{ creado_en: 'desc' }, { nombre: 'asc' }],
      }),
    ])

    const featuredCharacter =
      publicProfile?.personaje_destacado_id && availableCharacters.length
        ? availableCharacters.find(
            (character) => character.id === publicProfile.personaje_destacado_id
          ) || null
        : null
    const featuredObject =
      publicProfile?.objeto_destacado_id && availableObjects.length
        ? availableObjects.find(
            (object) => object.id === publicProfile.objeto_destacado_id
          ) || null
        : null
    const featuredPlace =
      publicProfile?.lugar_destacado_id && availablePlaces.length
        ? availablePlaces.find(
            (place) => place.id === publicProfile.lugar_destacado_id
          ) || null
        : null
    const featuredSession =
      publicProfile?.partida_destacada_id && availableSessions.length
        ? availableSessions.find(
            (session) => session.id === publicProfile.partida_destacada_id
          ) || null
        : null
    const featuredSpell =
      publicProfile?.hechizo_destacado_id && availableSpells.length
        ? availableSpells.find(
            (spell) => spell.id === publicProfile.hechizo_destacado_id
          ) || null
        : null
    const featuredPower =
      publicProfile?.poder_destacado_id && availablePowers.length
        ? availablePowers.find(
            (power) => power.id === publicProfile.poder_destacado_id
          ) || null
        : null

    res.json({
      item: serializePublicProfileEditorItem({
        publicProfile,
        featuredCharacter,
        featuredObject,
        featuredPlace,
        featuredSession,
        featuredSpell,
        featuredPower,
      }),
      personajesDisponibles: availableCharacters.map(
        serializePublicProfileSelectableCharacter
      ),
      objetosDisponibles: availableObjects.map(
        serializePublicProfileSelectableObject
      ),
      lugaresDisponibles: availablePlaces.map(
        serializePublicProfileSelectablePlace
      ),
      partidasDisponibles: availableSessions.map(
        serializePublicProfileSelectableSession
      ),
      hechizosDisponibles: availableSpells.map(
        serializePublicProfileSelectableSpell
      ),
      poderesDisponibles: availablePowers.map(
        serializePublicProfileSelectablePower
      ),
    })
  })
)

usersRouter.patch(
  '/me',
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const data = req.validated.body
    const currentUser = await prisma.usuarios.findUnique({
      where: { id: req.auth.userId },
      select: {
        imagen_perfil_url: true,
      },
    })

    if (data.nombreUsuario) {
      const existingUser = await prisma.usuarios.findFirst({
        where: {
          nombre_usuario: data.nombreUsuario,
          NOT: {
            id: req.auth.userId,
          },
        },
        select: { id: true },
      })

      if (existingUser) {
        throw createHttpError(409, 'Ese nombre de usuario ya esta en uso.')
      }
    }

    if (data.imagenPerfilUrl !== undefined) {
      await assertManagedImageUrl(data.imagenPerfilUrl, {
        entityLabel: 'La imagen de perfil',
      })
    }

    const updatedUser = await prisma.usuarios.update({
      where: { id: req.auth.userId },
      data: {
        nombre_usuario: data.nombreUsuario,
        imagen_perfil_url: data.imagenPerfilUrl,
        tema_modo: data.temaModo,
        tema_color_hex: data.temaColorHex,
      },
      include: {
        roles: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
          },
        },
      },
    })
    const sheetVisualMode =
      data.modoVisualFichas !== undefined
        ? await updateUserSheetVisualMode(
            req.auth.userId,
            data.modoVisualFichas
          )
        : await getUserSheetVisualMode(req.auth.userId)

    if (
      data.imagenPerfilUrl !== undefined &&
      currentUser?.imagen_perfil_url &&
      currentUser.imagen_perfil_url !== updatedUser.imagen_perfil_url
    ) {
      await cleanupCloudinaryAssets([currentUser.imagen_perfil_url])
    }

    await logEntityChange({
      tipoEntidadCodigo: 'usuario',
      entidadPk: req.auth.userId,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'update',
      resumen: 'Perfil de usuario actualizado desde la API.',
      valorNuevo: data,
    })

    res.json({
      usuario: serializeUser({
        ...updatedUser,
        modo_visual_fichas: sheetVisualMode,
      }),
    })
  })
)

usersRouter.patch(
  '/me/public-profile',
  validate(updatePublicProfileSchema),
  asyncHandler(async (req, res) => {
    const data = req.validated.body
    let featuredCharacter = null
    let featuredObject = null
    let featuredPlace = null
    let featuredSession = null
    let featuredSpell = null
    let featuredPower = null

    if (data.personajeDestacadoId) {
      featuredCharacter = await prisma.personajes.findFirst({
        where: {
          id: data.personajeDestacadoId,
          ...buildPublicFeaturedCharacterWhere(req.auth.userId),
        },
        select: {
          id: true,
          nombre: true,
          titulo: true,
          imagen_principal_url: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          tiers_personaje: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
      })

      if (!featuredCharacter) {
        throw createHttpError(
          400,
          'El personaje destacado debe ser tuyo y completamente público.'
        )
      }
    }

    if (data.objetoDestacadoId) {
      featuredObject = await prisma.objetos.findFirst({
        where: {
          id: data.objetoDestacadoId,
          ...buildPublicFeaturedObjectWhere(req.auth.userId),
        },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          tipo_magico_codigo: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          tiers_objeto: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
      })

      if (!featuredObject) {
        throw createHttpError(
          400,
          'El objeto destacado debe ser tuyo y completamente público.'
        )
      }
    }

    if (data.lugarDestacadoId) {
      featuredPlace = await prisma.lugares.findFirst({
        where: {
          id: data.lugarDestacadoId,
          ...buildPublicFeaturedPlaceWhere(req.auth.userId),
        },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          tipos_lugar: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
      })

      if (!featuredPlace) {
        throw createHttpError(
          400,
          'El lugar destacado debe ser tuyo y completamente público.'
        )
      }
    }

    if (data.partidaDestacadaId) {
      featuredSession = await prisma.partidas.findFirst({
        where: {
          id: data.partidaDestacadaId,
          ...buildPublicFeaturedSessionWhere(req.auth.userId, req),
        },
        select: {
          id: true,
          campana_id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          jugada_en: true,
          creado_en: true,
          campanas: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      })

      if (!featuredSession) {
        throw createHttpError(
          400,
          'La partida destacada debe pertenecer a una campaña en la que participes y que puedas ver.'
        )
      }
    }

    if (data.hechizoDestacadoId) {
      featuredSpell = await prisma.hechizos.findFirst({
        where: {
          id: data.hechizoDestacadoId,
          ...buildPublicFeaturedSpellWhere(req.auth.userId),
        },
        select: {
          id: true,
          nombre: true,
          nivel: true,
          escuela: true,
          clases: true,
          es_publico: true,
          descripcion: true,
          creado_en: true,
        },
      })

      if (!featuredSpell) {
        throw createHttpError(
          400,
          'El hechizo destacado debe ser público y estar creado o guardado por ti.'
        )
      }
    }

    if (data.poderDestacadoId) {
      featuredPower = await prisma.poderes.findFirst({
        where: {
          id: data.poderDestacadoId,
          ...buildPublicFeaturedPowerWhere(req.auth.userId),
        },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          asignaciones_categoria_poder: {
            select: {
              categorias_poder: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          poder_campanas: {
            select: {
              campanas: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
      })

      if (!featuredPower) {
        throw createHttpError(
          400,
          'El poder destacado debe ser tuyo y completamente público.'
        )
      }
    }

    let savedPublicProfile = await prisma.perfiles_publicos_usuario.upsert({
      where: {
        usuario_id: req.auth.userId,
      },
      create: {
        usuario_id: req.auth.userId,
        descripcion: data.descripcion || null,
        personaje_destacado_id: data.personajeDestacadoId || null,
        objeto_destacado_id: data.objetoDestacadoId || null,
        lugar_destacado_id: data.lugarDestacadoId || null,
        partida_destacada_id: data.partidaDestacadaId || null,
        hechizo_destacado_id: data.hechizoDestacadoId || null,
        poder_destacado_id: data.poderDestacadoId || null,
      },
      update: {
        descripcion: data.descripcion || null,
        personaje_destacado_id: data.personajeDestacadoId || null,
        objeto_destacado_id: data.objetoDestacadoId || null,
        lugar_destacado_id: data.lugarDestacadoId || null,
        partida_destacada_id: data.partidaDestacadaId || null,
        hechizo_destacado_id: data.hechizoDestacadoId || null,
        poder_destacado_id: data.poderDestacadoId || null,
        actualizado_en: new Date(),
      },
    })

    res.json({
      item: serializePublicProfileEditorItem({
        publicProfile: savedPublicProfile,
        featuredCharacter,
        featuredObject,
        featuredPlace,
        featuredSession,
        featuredSpell,
        featuredPower,
      }),
    })
  })
)

usersRouter.get(
  '/me/campaigns',
  asyncHandler(async (req, res) => {
    const where =
      req.auth.roleCode === 'administrador'
        ? {}
        : {
            OR: [
              { master_usuario_id: req.auth.userId },
              {
                campana_jugadores: {
                  some: {
                    usuario_id: req.auth.userId,
                  },
                },
              },
            ],
          }

    const campaigns = await prisma.campanas.findMany({
      where,
      include: {
        campana_jugadores: {
          select: {
            id: true,
          },
        },
        aventuras: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ actualizado_en: 'desc' }, { nombre: 'asc' }],
    })

    res.json({
      items: campaigns.map((campaign) =>
        serializeProfileCampaign(campaign, req.auth.userId)
      ),
    })
  })
)

usersRouter.get(
  '/:userId/public-profile/characters',
  validate(publicProfileCharactersSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.validated.params
    const limit = req.validated.query.limit || 10
    const cursor = req.validated.query.cursor || null

    const user = await prisma.usuarios.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        roles: {
          select: {
            codigo: true,
          },
        },
      },
    })

    if (!user || isAdminUser(user)) {
      throw createHttpError(404, 'El usuario indicado no existe.')
    }

    const [page, totalVisible] = await Promise.all([
      listVisibleCharactersCreatedByUser(userId, req, { limit, cursor }),
      req.auth.roleCode === 'administrador'
        ? prisma.personajes.count({
            where: {
              propietario_usuario_id: userId,
            },
          })
        : prisma.personajes.count({
            where: buildVisibleCharacterWhere(req.auth.userId, {
              propietario_usuario_id: userId,
            }),
          }),
    ])

    res.json({
      items: page.items,
      meta: {
        totalVisible,
        limit,
        returned: page.items.length,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
    })
  })
)

usersRouter.get(
  '/:userId/public-profile/objects',
  validate(publicProfileObjectsSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.validated.params
    const limit = req.validated.query.limit || 10
    const cursor = req.validated.query.cursor || 0

    const user = await prisma.usuarios.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        roles: {
          select: {
            codigo: true,
          },
        },
      },
    })

    if (!user || isAdminUser(user)) {
      throw createHttpError(404, 'El usuario indicado no existe.')
    }

    const page = await listVisibleObjectsCreatedByUser(userId, req, {
      limit,
      cursor,
    })

    res.json({
      items: page.items,
      meta: {
        totalVisible: page.meta.totalVisible,
        limit,
        returned: page.items.length,
        nextCursor: page.meta.nextCursor,
        hasMore: Boolean(page.meta.nextCursor),
      },
    })
  })
)

usersRouter.get(
  '/:userId/public-profile/places',
  validate(publicProfilePlacesSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.validated.params
    const limit = req.validated.query.limit || 10
    const cursor = req.validated.query.cursor || 0

    const user = await prisma.usuarios.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        roles: {
          select: {
            codigo: true,
          },
        },
      },
    })

    if (!user || isAdminUser(user)) {
      throw createHttpError(404, 'El usuario indicado no existe.')
    }

    const page = await listVisiblePlacesCreatedByUser(userId, req, {
      limit,
      cursor,
    })

    res.json({
      items: page.items,
      meta: {
        totalVisible: page.meta.totalVisible,
        limit,
        returned: page.items.length,
        nextCursor: page.meta.nextCursor,
        hasMore: Boolean(page.meta.nextCursor),
      },
    })
  })
)

usersRouter.get(
  '/:userId/public-profile',
  validate(publicProfileUserIdSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.validated.params

    const [
      user,
      publicProfile,
      stats,
      visibleCharactersPage,
      totalVisible,
      visibleObjectsPage,
      visiblePlacesPage,
      visibleSpellsPage,
      visiblePowersPage,
    ] = await Promise.all([
      prisma.usuarios.findUnique({
        where: {
          id: userId,
        },
        include: {
          roles: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
            },
          },
        },
      }),
      findPublicProfileByUserId(userId),
      Promise.all([
        prisma.personajes.count({
          where: buildPublicFeaturedCharacterWhere(userId),
        }),
        prisma.campanas.count({
          where: {
            master_usuario_id: userId,
          },
        }),
        prisma.campana_jugadores.count({
          where: {
            usuario_id: userId,
          },
        }),
      ]).then(
        ([personajesPublicos, campanasComoMaster, campanasComoJugador]) => ({
          personajesPublicos,
          campanasComoMaster,
          campanasComoJugador,
        })
      ),
      listVisibleCharactersCreatedByUser(userId, req, { limit: 10 }),
      req.auth.roleCode === 'administrador'
        ? prisma.personajes.count({
            where: {
              propietario_usuario_id: userId,
            },
          })
        : prisma.personajes.count({
            where: buildVisibleCharacterWhere(req.auth.userId, {
              propietario_usuario_id: userId,
            }),
          }),
      listVisibleObjectsCreatedByUser(userId, req, { limit: 10 }),
      listVisiblePlacesCreatedByUser(userId, req, { limit: 10 }),
      listVisibleSpellsCreatedByUser(userId, req, { limit: 10 }),
      listVisiblePowersCreatedByUser(userId, req, { limit: 10 }),
    ])

    if (!user || isAdminUser(user)) {
      throw createHttpError(404, 'El usuario indicado no existe.')
    }

    let featuredCharacter = null
    let featuredObject = null
    let featuredPlace = null
    let featuredSession = null
    let featuredSpell = null
    let featuredPower = null

    if (publicProfile?.personaje_destacado_id) {
      featuredCharacter = await prisma.personajes.findFirst({
        where: {
          id: publicProfile.personaje_destacado_id,
          ...buildPublicFeaturedCharacterWhere(userId),
        },
        select: {
          id: true,
          nombre: true,
          titulo: true,
          imagen_principal_url: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          tiers_personaje: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
      })
    }

    if (publicProfile?.objeto_destacado_id) {
      featuredObject = await prisma.objetos.findFirst({
        where: {
          id: publicProfile.objeto_destacado_id,
          ...buildPublicFeaturedObjectWhere(userId),
        },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          tipo_magico_codigo: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          tiers_objeto: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
      })
    }

    if (publicProfile?.lugar_destacado_id) {
      featuredPlace = await prisma.lugares.findFirst({
        where: {
          id: publicProfile.lugar_destacado_id,
          ...buildPublicFeaturedPlaceWhere(userId),
        },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          tipos_lugar: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
      })
    }

    if (publicProfile?.partida_destacada_id) {
      featuredSession = await prisma.partidas.findFirst({
        where: {
          id: publicProfile.partida_destacada_id,
          ...buildPublicFeaturedSessionWhere(userId, req),
        },
        select: {
          id: true,
          campana_id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          jugada_en: true,
          creado_en: true,
          campanas: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      })
    }

    if (publicProfile?.hechizo_destacado_id) {
      featuredSpell = await prisma.hechizos.findFirst({
        where: {
          id: publicProfile.hechizo_destacado_id,
          ...buildPublicFeaturedSpellWhere(userId),
        },
        select: {
          id: true,
          nombre: true,
          nivel: true,
          escuela: true,
          clases: true,
          es_publico: true,
          descripcion: true,
          creado_en: true,
        },
      })
    }

    if (publicProfile?.poder_destacado_id) {
      featuredPower = await prisma.poderes.findFirst({
        where: {
          id: publicProfile.poder_destacado_id,
          ...buildPublicFeaturedPowerWhere(userId),
        },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          ambito_visibilidad_codigo: true,
          creado_en: true,
          asignaciones_categoria_poder: {
            select: {
              categorias_poder: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          poder_campanas: {
            select: {
              campanas: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
        },
      })
    }

    res.json({
      item: serializePublicProfileItem({
        user,
        publicProfile,
        featuredCharacter,
        featuredObject,
        featuredPlace,
        featuredSession,
        featuredSpell,
        featuredPower,
        stats,
      }),
      entradas: {
        personajes: {
          items: visibleCharactersPage.items,
          totalVisible,
          nextCursor: visibleCharactersPage.nextCursor,
          hasMore: visibleCharactersPage.hasMore,
        },
        objetos: {
          items: visibleObjectsPage.items,
          totalVisible: visibleObjectsPage.meta.totalVisible,
          nextCursor: visibleObjectsPage.meta.nextCursor,
          hasMore: Boolean(visibleObjectsPage.meta.nextCursor),
        },
        lugares: {
          items: visiblePlacesPage.items,
          totalVisible: visiblePlacesPage.meta.totalVisible,
          nextCursor: visiblePlacesPage.meta.nextCursor,
          hasMore: Boolean(visiblePlacesPage.meta.nextCursor),
        },
        hechizos: {
          items: visibleSpellsPage.items,
          totalVisible: visibleSpellsPage.meta.totalVisible,
          nextCursor: visibleSpellsPage.meta.nextCursor,
          hasMore: Boolean(visibleSpellsPage.meta.nextCursor),
        },
        poderes: {
          items: visiblePowersPage.items,
          totalVisible: visiblePowersPage.meta.totalVisible,
          nextCursor: visiblePowersPage.meta.nextCursor,
          hasMore: Boolean(visiblePowersPage.meta.nextCursor),
        },
      },
    })
  })
)

usersRouter.get(
  '/:userId/public-profile/spells',
  validate(publicProfileSpellsSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.validated.params
    const limit = req.validated.query.limit || 10
    const cursor = req.validated.query.cursor || 0

    const user = await prisma.usuarios.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        roles: {
          select: {
            codigo: true,
          },
        },
      },
    })

    if (!user || isAdminUser(user)) {
      throw createHttpError(404, 'El usuario indicado no existe.')
    }

    const page = await listVisibleSpellsCreatedByUser(userId, req, {
      limit,
      cursor,
    })

    res.json({
      items: page.items,
      meta: {
        totalVisible: page.meta.totalVisible,
        limit,
        returned: page.items.length,
        nextCursor: page.meta.nextCursor,
        hasMore: Boolean(page.meta.nextCursor),
      },
    })
  })
)

usersRouter.get(
  '/:userId/public-profile/powers',
  validate(publicProfilePowersSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.validated.params
    const limit = req.validated.query.limit || 10
    const cursor = req.validated.query.cursor || 0

    const user = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roles: {
          select: {
            codigo: true,
          },
        },
      },
    })

    if (!user || isAdminUser(user)) {
      throw createHttpError(404, 'El usuario indicado no existe.')
    }

    const page = await listVisiblePowersCreatedByUser(userId, req, {
      limit,
      cursor,
    })

    res.json({
      items: page.items,
      meta: {
        totalVisible: page.meta.totalVisible,
        limit,
        returned: page.items.length,
        nextCursor: page.meta.nextCursor,
        hasMore: Boolean(page.meta.nextCursor),
      },
    })
  })
)

usersRouter.get(
  '/me/saved-traits',
  asyncHandler(async (req, res) => {
    const [traits, traitTypes] = await Promise.all([
      prisma.rasgos.findMany({
        where: {
          creador_usuario_id: req.auth.userId,
          es_reutilizable: true,
        },
        include: {
          tipos_rasgo: true,
        },
        orderBy: [
          { actualizado_en: 'desc' },
          { tipos_rasgo: { orden_visualizacion: 'asc' } },
          { nombre: 'asc' },
        ],
      }),
      prisma.tipos_rasgo.findMany({
        orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
      }),
    ])

    res.json({
      items: traits
        .filter(
          (trait) =>
            !isDeprecatedCharacterTraitTypeName(trait.tipos_rasgo?.nombre)
        )
        .map(serializeSavedTrait),
      tiposRasgo: traitTypes
        .filter((type) => !isDeprecatedCharacterTraitTypeName(type.nombre))
        .map((type) => ({
          id: type.id,
          nombre: type.nombre,
          ordenVisualizacion: type.orden_visualizacion,
        })),
    })
  })
)

usersRouter.post(
  '/me/saved-traits',
  validate(createSavedTraitSchema),
  asyncHandler(async (req, res) => {
    const data = req.validated.body
    const result = await createReusableTraitFromPayload(req.auth.userId, data)

    res.status(result.created ? 201 : 200).json({
      item: serializeSavedTrait(result.trait),
    })
  })
)

usersRouter.post(
  '/me/saved-traits/bulk',
  validate(savedTraitBulkSchema),
  asyncHandler(async (req, res) => {
    const results = []
    let created = 0

    for (const traitPayload of req.validated.body.traits) {
      const result = await createReusableTraitFromPayload(
        req.auth.userId,
        traitPayload
      )

      if (result.created) {
        created += 1
      }

      results.push(serializeSavedTrait(result.trait))
    }

    res.status(created ? 201 : 200).json({
      items: results,
      created,
    })
  })
)

usersRouter.post(
  '/me/saved-traits/remove-source',
  validate(removeSavedTraitSourceSchema),
  asyncHandler(async (req, res) => {
    const data = req.validated.body
    const traits = await prisma.rasgos.findMany({
      where: {
        creador_usuario_id: req.auth.userId,
        es_reutilizable: true,
        origen_tipo: data.origenTipo,
        ...(data.origenEntidadId
          ? { origen_entidad_id: data.origenEntidadId }
          : {}),
        ...(data.origenGrupoId ? { origen_grupo_id: data.origenGrupoId } : {}),
      },
      select: { id: true },
    })

    const result = await deleteOrHideSavedTraits(
      traits.map((trait) => trait.id)
    )

    res.json(result)
  })
)

usersRouter.patch(
  '/me/saved-traits/:traitId',
  validate(updateSavedTraitSchema),
  asyncHandler(async (req, res) => {
    const { traitId } = req.validated.params
    const data = req.validated.body

    const currentTrait = await prisma.rasgos.findFirst({
      where: {
        id: traitId,
        creador_usuario_id: req.auth.userId,
        es_reutilizable: true,
      },
      select: {
        id: true,
      },
    })

    if (!currentTrait) {
      throw createHttpError(404, 'Rasgo guardado no encontrado.')
    }

    const updatedTrait = await prisma.rasgos.update({
      where: {
        id: traitId,
      },
      data: {
        ...(data.tipoRasgoId
          ? {
              tipo_rasgo_id: await resolveSavedTraitTypeId(
                data.tipoRasgoId,
                data.origenTipo
              ),
            }
          : {}),
        ...(data.nombre ? { nombre: data.nombre } : {}),
        ...(data.descripcion ? { descripcion: data.descripcion } : {}),
        ...(data.origenTipo || data.origenEntidadId || data.origenGrupoId
          ? buildSavedTraitSourceData(data)
          : {}),
        actualizado_en: new Date(),
      },
      include: {
        tipos_rasgo: true,
      },
    })

    res.json({
      item: serializeSavedTrait(updatedTrait),
    })
  })
)

usersRouter.delete(
  '/me/saved-traits/:traitId',
  validate(traitIdSchema),
  asyncHandler(async (req, res) => {
    const { traitId } = req.validated.params
    const trait = await prisma.rasgos.findFirst({
      where: {
        id: traitId,
        creador_usuario_id: req.auth.userId,
        es_reutilizable: true,
      },
      select: { id: true },
    })

    if (!trait) {
      throw createHttpError(404, 'Rasgo guardado no encontrado.')
    }

    await deleteOrHideSavedTraits([traitId])

    res.status(204).send()
  })
)

usersRouter.patch(
  '/me/password',
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { contrasenaActual, nuevaContrasena } = req.validated.body

    const currentUser = await prisma.usuarios.findUnique({
      where: { id: req.auth.userId },
    })

    const isCurrentPasswordValid = await verifyValue(
      contrasenaActual,
      currentUser.hash_contrasena
    )

    if (!isCurrentPasswordValid) {
      throw createHttpError(401, 'La contrasena actual no es correcta.')
    }

    const isSamePassword = await verifyValue(
      nuevaContrasena,
      currentUser.hash_contrasena
    )

    if (isSamePassword) {
      throw createHttpError(
        400,
        'La nueva contrasena debe ser distinta de la actual.'
      )
    }

    await prisma.usuarios.update({
      where: { id: req.auth.userId },
      data: {
        hash_contrasena: await hashValue(nuevaContrasena),
      },
    })

    await logEntityChange({
      tipoEntidadCodigo: 'usuario',
      entidadPk: req.auth.userId,
      actorUsuarioId: req.auth.userId,
      tipoAccion: 'permission_change',
      nombreCampo: 'hash_contrasena',
      resumen: 'Contrasena cambiada por el propio usuario.',
    })

    res.json({
      message: 'Contrasena actualizada correctamente.',
    })
  })
)

usersRouter.get(
  '/me/places',
  validate(listMyPlacesSchema),
  asyncHandler(async (req, res) => {
    const { all = false, limit = 10, cursor = 0 } = req.validated.query
    const safeCursor = Math.max(0, cursor || 0)
    const where = {
      creado_por_usuario_id: req.auth.userId,
    }

    const [items, total] = await Promise.all([
      prisma.lugares.findMany({
        where,
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
        take: all ? undefined : limit,
        skip: all ? undefined : safeCursor,
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          lugar_padre_id: true,
          creado_en: true,
          actualizado_en: true,
          tipos_lugar: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
      }),
      prisma.lugares.count({ where }),
    ])

    const serializedItems = serializeProfilePlacePage(items)
    const nextOffset = safeCursor + items.length
    const nextCursor = !all && nextOffset < total ? String(nextOffset) : null

    res.json({
      items: serializedItems,
      meta: {
        total,
        limit: all ? total : limit,
        offset: all ? 0 : safeCursor,
        returned: serializedItems.length,
        nextCursor,
        hasMore: Boolean(nextCursor),
      },
    })
  })
)

usersRouter.get(
  '/me/spells',
  validate(listMySpellsSchema),
  asyncHandler(async (req, res) => {
    const { all = false, limit = 10, cursor = 0 } = req.validated.query
    const page = await listSpells({
      req,
      limit: all ? 250 : limit,
      cursor: all ? 0 : cursor,
      filters: {
        createdByUserId: req.auth.userId,
      },
    })

    res.json({
      items: page.items,
      meta: {
        total: page.meta.totalVisible,
        totalVisible: page.meta.totalVisible,
        limit: all ? page.meta.totalVisible : limit,
        offset: all ? 0 : cursor,
        returned: page.items.length,
        nextCursor: all ? null : page.meta.nextCursor,
        hasMore: all ? false : Boolean(page.meta.nextCursor),
      },
    })
  })
)

usersRouter.get(
  '/me/powers',
  validate(listMyPowersSchema),
  asyncHandler(async (req, res) => {
    const { all = false, limit = 10, cursor = 0 } = req.validated.query
    const page = await listPowers({
      req,
      limit: all ? 100 : limit,
      cursor: all ? 0 : cursor,
      filters: {
        createdByUserId: req.auth.userId,
      },
    })

    res.json({
      items: page.items,
      meta: {
        total: page.meta.totalVisible,
        totalVisible: page.meta.totalVisible,
        limit: all ? page.meta.totalVisible : limit,
        offset: all ? 0 : cursor,
        returned: page.items.length,
        nextCursor: all ? null : page.meta.nextCursor,
        hasMore: all ? false : Boolean(page.meta.nextCursor),
      },
    })
  })
)

usersRouter.get(
  '/me/objects',
  validate(listMyObjectsSchema),
  asyncHandler(async (req, res) => {
    const { all = false, limit = 10, cursor = 0 } = req.validated.query
    const safeCursor = Math.max(0, cursor || 0)
    const where = {
      creado_por_usuario_id: req.auth.userId,
    }

    const [items, total] = await Promise.all([
      prisma.objetos.findMany({
        where,
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
        take: all ? undefined : limit,
        skip: all ? undefined : safeCursor,
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          imagen_url: true,
          tipo_magico_codigo: true,
          creado_en: true,
          actualizado_en: true,
          tiers_objeto: {
            select: {
              id: true,
              nombre: true,
              orden_visualizacion: true,
            },
          },
        },
      }),
      prisma.objetos.count({ where }),
    ])

    const serializedItems = serializeProfileObjectPage(items)
    const nextOffset = safeCursor + items.length
    const nextCursor = !all && nextOffset < total ? String(nextOffset) : null

    res.json({
      items: serializedItems,
      meta: {
        total,
        limit: all ? total : limit,
        offset: all ? 0 : safeCursor,
        returned: serializedItems.length,
        nextCursor,
        hasMore: Boolean(nextCursor),
      },
    })
  })
)

usersRouter.get(
  '/me/characters',
  validate(listMyCharactersSchema),
  asyncHandler(async (req, res) => {
    const { all = false, limit = 10, offset = 0, cursor } = req.validated.query
    const where = {
      propietario_usuario_id: req.auth.userId,
    }
    const decodedCursor = decodeCharacterCursor(cursor)

    const [items, total] = await Promise.all([
      prisma.personajes.findMany({
        where: {
          ...where,
          ...(decodedCursor
            ? {
                OR: [
                  {
                    creado_en: {
                      lt: decodedCursor.createdAt,
                    },
                  },
                  {
                    AND: [
                      {
                        creado_en: decodedCursor.createdAt,
                      },
                      {
                        id: {
                          lt: decodedCursor.id,
                        },
                      },
                    ],
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
        take: all ? undefined : limit,
        skip: !cursor && !all ? offset : undefined,
        select: {
          id: true,
          nombre: true,
          titulo: true,
          imagen_principal_url: true,
          creado_en: true,
          actualizado_en: true,
        },
      }),
      prisma.personajes.count({ where }),
    ])

    const serializedItems = serializeProfileCharacterPage(items)
    const nextCursor =
      !all && items.length === limit
        ? Buffer.from(
            `${new Date(items[items.length - 1].creado_en).toISOString()}|${
              items[items.length - 1].id
            }`
          ).toString('base64url')
        : null

    res.json({
      items: serializedItems,
      meta: {
        total,
        limit: all ? total : limit,
        offset: !cursor && !all ? offset : 0,
        returned: serializedItems.length,
        nextCursor,
        hasMore: all ? false : Boolean(nextCursor),
      },
    })
  })
)

usersRouter.get(
  '/',
  requireRoles('administrador'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.usuarios.findMany({
      include: {
        roles: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        creado_en: 'asc',
      },
    })

    res.json({
      items: users.map(serializeUser),
    })
  })
)

usersRouter.patch(
  '/:userId/role',
  requireRoles('administrador'),
  validate(updateRoleSchema),
  asyncHandler(async (req, _res) => {
    void req
    void _res
    throw createHttpError(
      405,
      'Los roles globales normales ya no se gestionan desde la API. Solo existe el administrador como rol global y se crea manualmente.'
    )
  })
)

module.exports = {
  usersRouter,
  passwordSchema,
  usernameSchema,
}
