const { pool, prisma } = require('../lib/prisma')
const { createHttpError } = require('../lib/errors')
const {
  getCampaignRoleContext,
  getCampaignWithMembership,
} = require('./campaign-access.service')
const {
  assertManagedImageUrl,
  cleanupCloudinaryAssets,
} = require('../lib/media')
const {
  notifyMastersOfCampaignEntryCreated,
} = require('./notification.service')
const { getSavedSpellsForEditor } = require('./spell.service')
const { serializeVisibleUser } = require('../lib/user-visibility')

const OBJECT_TIERS = ['Comun', 'Poco Comun', 'Raro', 'Muy Raro', 'Legendario']
const OBJECT_VISIBILITY_CODES = [
  'privado',
  'usuarios_seleccionados',
  'campana_vista_previa',
  'campana_completo',
]
const OBJECT_TYPE_CODES = ['no_magico', 'magico', 'reliquia']
const MODIFIER_TYPE_CODES = [
  'ataque',
  'dano',
  'cd',
  'clase_armadura',
  'pruebas_caracteristica',
  'otro',
]
const VISIBLE_PERMISSION_CODES = ['full', 'completo', 'preview', 'vista_previa']
const HIDDEN_PERMISSION_CODES = ['hidden', 'oculto', 'sin_acceso']
const OBJECT_ARCHIVE_SORTS = new Set([
  'created_desc',
  'created_asc',
  'name_asc',
  'name_desc',
  'modifier_asc',
  'modifier_desc',
])
const WIKICODEX_CAMPAIGN_FILTER_ID = '__wikicodex'
const NO_CAMPAIGN_SELECTION_FILTER_ID = '__none'

function normalizeSearchTerm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function escapeLikeTerm(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

async function ensureObjectTierCatalog() {
  for (const [index, name] of OBJECT_TIERS.entries()) {
    const existing = await prisma.tiers_objeto.findFirst({
      where: { nombre: name },
      select: { id: true },
    })

    if (existing) {
      await prisma.tiers_objeto.update({
        where: { id: existing.id },
        data: { orden_visualizacion: index + 1 },
      })
      continue
    }

    await prisma.tiers_objeto.create({
      data: {
        nombre: name,
        orden_visualizacion: index + 1,
      },
    })
  }
}

function normalizePrivacyInput(privacy = {}) {
  const mode = privacy.mode || 'private'
  const permissions = Array.isArray(privacy.userPermissions)
    ? privacy.userPermissions
    : []

  if (mode === 'public') {
    return {
      visibilityCode: 'campana_completo',
      explicitPermissions: [],
    }
  }

  if (mode === 'preview') {
    return {
      visibilityCode: 'campana_vista_previa',
      explicitPermissions: [],
    }
  }

  if (mode === 'custom') {
    return {
      visibilityCode: 'usuarios_seleccionados',
      explicitPermissions: permissions
        .filter(
          (item) =>
            item?.usuarioId &&
            item.nivelAccesoCodigo &&
            !HIDDEN_PERMISSION_CODES.includes(item.nivelAccesoCodigo)
        )
        .map((item) => ({
          usuarioId: item.usuarioId,
          nivelAccesoCodigo:
            item.nivelAccesoCodigo === 'full'
              ? 'completo'
              : item.nivelAccesoCodigo === 'preview'
                ? 'vista_previa'
                : item.nivelAccesoCodigo,
        })),
    }
  }

  return {
    visibilityCode: 'privado',
    explicitPermissions: [],
  }
}

function normalizeSpellSlots(value = {}) {
  const slots = {}

  for (let level = 1; level <= 10; level += 1) {
    const amount = Number(value?.[level] ?? value?.[`nivel${level}`] ?? 0)

    if (Number.isInteger(amount) && amount > 0) {
      slots[level] = Math.min(amount, 999)
    }
  }

  return slots
}

function buildVisibleObjectWhere(userId) {
  const memberCampaignWhere = {
    OR: [
      { master_usuario_id: userId },
      { campana_jugadores: { some: { usuario_id: userId } } },
    ],
  }
  const readableCampaignWhere = {
    OR: [...memberCampaignWhere.OR, { privacidad_codigo: 'publica' }],
  }

  return {
    OR: [
      { creado_por_usuario_id: userId },
      {
        AND: [
          {
            ambito_visibilidad_codigo: {
              in: ['campana_completo', 'campana_vista_previa'],
            },
          },
          {
            OR: [
              {
                objeto_campanas: {
                  some: {
                    campanas: readableCampaignWhere,
                  },
                },
              },
              {
                campanas: {
                  is: readableCampaignWhere,
                },
              },
              {
                AND: [{ campana_id: null }, { objeto_campanas: { none: {} } }],
              },
            ],
          },
        ],
      },
      {
        permisos_objeto: {
          some: {
            usuario_id: userId,
            nivel_acceso_codigo: { in: VISIBLE_PERMISSION_CODES },
          },
        },
      },
      {
        objeto_campanas: {
          some: {
            campanas: memberCampaignWhere,
          },
        },
      },
      {
        campanas: {
          is: memberCampaignWhere,
        },
      },
    ],
  }
}

function getLinkedCharacterInclude(userId) {
  return {
    id: true,
    nombre: true,
    titulo: true,
    imagen_principal_url: true,
    ambito_visibilidad_codigo: true,
    propietario_usuario_id: true,
    creado_por_usuario_id: true,
    campanas: {
      select: {
        id: true,
        nombre: true,
        master_usuario_id: true,
        privacidad_codigo: true,
        campana_jugadores: {
          where: { usuario_id: userId },
          select: { usuario_id: true },
        },
      },
    },
    permisos_personaje: {
      where: { usuario_id: userId },
      select: { nivel_acceso_codigo: true },
    },
  }
}

function getObjectInclude(userId, options = {}) {
  return {
    tiers_objeto: {
      select: { id: true, nombre: true, orden_visualizacion: true },
    },
    campanas: {
      select: {
        id: true,
        nombre: true,
        master_usuario_id: true,
        privacidad_codigo: true,
        campana_jugadores: {
          where: { usuario_id: userId },
          select: { usuario_id: true },
        },
      },
    },
    objeto_campanas: {
      include: {
        campanas: {
          select: {
            id: true,
            nombre: true,
            master_usuario_id: true,
            privacidad_codigo: true,
            campana_jugadores: {
              where: { usuario_id: userId },
              select: { usuario_id: true },
            },
          },
        },
      },
    },
    permisos_objeto: {
      where: { usuario_id: userId },
      select: { nivel_acceso_codigo: true },
    },
    objeto_rasgos: {
      orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
      include: {
        tipos_rasgo_objeto: {
          select: { id: true, nombre: true, orden_visualizacion: true },
        },
      },
    },
    objeto_modificadores: {
      orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
      select: {
        id: true,
        valor: true,
        tipo_codigo: true,
        otro: true,
        orden_visualizacion: true,
      },
    },
    objeto_hechizos: {
      orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
      include: {
        hechizos: true,
      },
    },
    usuarios: {
      select: {
        id: true,
        nombre_usuario: true,
        imagen_perfil_url: true,
        roles: {
          select: {
            codigo: true,
            nombre: true,
          },
        },
      },
    },
    ...(options.includeLinkedCharacters
      ? {
          personaje_objetos: {
            orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
            include: {
              personajes: {
                select: getLinkedCharacterInclude(userId),
              },
            },
          },
        }
      : {}),
  }
}

function getObjectListInclude(userId) {
  return {
    tiers_objeto: {
      select: { id: true, nombre: true, orden_visualizacion: true },
    },
    campanas: {
      select: {
        id: true,
        nombre: true,
        master_usuario_id: true,
        privacidad_codigo: true,
        campana_jugadores: {
          where: { usuario_id: userId },
          select: { usuario_id: true },
        },
      },
    },
    objeto_campanas: {
      include: {
        campanas: {
          select: {
            id: true,
            nombre: true,
            master_usuario_id: true,
            privacidad_codigo: true,
            campana_jugadores: {
              where: { usuario_id: userId },
              select: { usuario_id: true },
            },
          },
        },
      },
    },
    permisos_objeto: {
      where: { usuario_id: userId },
      select: { nivel_acceso_codigo: true },
    },
    objeto_modificadores: {
      orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
      select: {
        id: true,
        valor: true,
        tipo_codigo: true,
        otro: true,
        orden_visualizacion: true,
      },
    },
  }
}

async function getObjectWithContext(objectId, userId, options = {}) {
  return prisma.objetos.findUnique({
    where: { id: objectId },
    include: getObjectInclude(userId, options),
  })
}

function getObjectAccessContext(object, req) {
  const linkedCampaigns = object.objeto_campanas?.length
    ? object.objeto_campanas.map((item) => item.campanas).filter(Boolean)
    : object.campanas
      ? [object.campanas]
      : []

  const campaignContexts = linkedCampaigns.map((campaign) =>
    getCampaignRoleContext(campaign, req)
  )
  const isAdmin = req.auth.roleCode === 'administrador'
  const isCreator = object.creado_por_usuario_id === req.auth.userId
  const isMaster = isAdmin || campaignContexts.some((item) => item.isMaster)
  const isPlayer = campaignContexts.some((item) => item.isPlayer)
  const hasCampaignAccess =
    isAdmin ||
    linkedCampaigns.length === 0 ||
    campaignContexts.some((item) => item.canRead)
  const explicitPermission =
    object.permisos_objeto?.[0]?.nivel_acceso_codigo || null
  const isPublicPreview =
    object.ambito_visibilidad_codigo === 'campana_vista_previa'
  const isPublicFull = object.ambito_visibilidad_codigo === 'campana_completo'

  let canView = false
  let canEdit = false
  let viewMode = 'none'

  if (isCreator || isMaster) {
    canView = true
    canEdit = true
    viewMode = 'full'
  } else if (
    explicitPermission === 'full' ||
    explicitPermission === 'completo'
  ) {
    canView = true
    viewMode = 'full'
  } else if (
    explicitPermission === 'preview' ||
    explicitPermission === 'vista_previa'
  ) {
    canView = true
    viewMode = 'preview'
  } else if (hasCampaignAccess && isPublicFull) {
    canView = true
    viewMode = 'full'
  } else if (hasCampaignAccess && isPublicPreview) {
    canView = true
    viewMode = 'preview'
  }

  return {
    isAdmin,
    isCreator,
    isMaster,
    isPlayer,
    explicitPermission,
    canView,
    canEdit,
    viewMode,
  }
}

async function requireObjectViewAccess(objectId, req, options = {}) {
  const object = await getObjectWithContext(objectId, req.auth.userId, options)

  if (!object) {
    throw createHttpError(404, 'El objeto indicado no existe.')
  }

  const access = getObjectAccessContext(object, req)

  if (!access.canView) {
    throw createHttpError(403, 'No tienes permiso para ver este objeto.')
  }

  return { object, access }
}

async function requireObjectEditAccess(objectId, req) {
  const context = await requireObjectViewAccess(objectId, req)

  if (!context.access.canEdit) {
    throw createHttpError(403, 'No tienes permiso para editar este objeto.')
  }

  return context
}

function linkedCharacterAccessMode(character, req) {
  const campaignContext = getCampaignRoleContext(character.campanas, req)
  const explicitPermission =
    character.permisos_personaje?.[0]?.nivel_acceso_codigo || null
  const isOwner = character.propietario_usuario_id === req.auth.userId
  const isAdmin = req.auth.roleCode === 'administrador'
  const isMaster = campaignContext.isMaster || isAdmin

  if (isOwner || isMaster) {
    return 'full'
  }

  if (explicitPermission === 'full' || explicitPermission === 'completo') {
    return 'full'
  }

  if (
    campaignContext.canRead &&
    character.ambito_visibilidad_codigo === 'campana_completo'
  ) {
    return 'full'
  }

  return 'none'
}

function serializeLinkedCharacterForObject(link, req) {
  const character = link?.personajes

  if (!character || linkedCharacterAccessMode(character, req) !== 'full') {
    return null
  }

  return {
    id: character.id,
    nombre: character.nombre,
    titulo: character.titulo,
    imagenPrincipalUrl: character.imagen_principal_url,
    campana: character.campanas
      ? {
          id: character.campanas.id,
          nombre: character.campanas.nombre,
        }
      : null,
    ordenVisualizacion: link.orden_visualizacion,
  }
}

function serializeObject(object, access, req = null) {
  const linkedCampaignIds = object.objeto_campanas?.length
    ? object.objeto_campanas.map((item) => item.campana_id).filter(Boolean)
    : [object.campana_id].filter(Boolean)
  const linkedCampaigns = object.objeto_campanas?.length
    ? object.objeto_campanas.map((item) => item.campanas).filter(Boolean)
    : object.campanas
      ? [object.campanas]
      : []
  const modifiers = object.objeto_modificadores?.length
    ? object.objeto_modificadores.map((modifier) => ({
        id: modifier.id,
        valor: modifier.valor,
        tipoCodigo: modifier.tipo_codigo,
        otro: modifier.otro,
        ordenVisualizacion: modifier.orden_visualizacion,
      }))
    : object.modificador_valor !== null &&
        object.modificador_valor !== undefined &&
        object.modificador_tipo_codigo
      ? [
          {
            id: null,
            valor: object.modificador_valor,
            tipoCodigo: object.modificador_tipo_codigo,
            otro: object.modificador_otro,
            ordenVisualizacion: 1,
          },
        ]
      : []

  const base = {
    id: object.id,
    campanaId: object.campana_id,
    campanaIds: linkedCampaignIds,
    aventuraId: object.aventura_id,
    creadoPorUsuarioId: object.creado_por_usuario_id,
    propietarioUsuarioId: object.creado_por_usuario_id,
    objetoBaseId: object.objeto_base_id,
    esVersion: Boolean(object.objeto_base_id),
    tierId: object.tier_id,
    tipoMagicoCodigo: object.tipo_magico_codigo,
    ambitoVisibilidadCodigo: object.ambito_visibilidad_codigo,
    hechizosSlots: object.hechizos_slots || {},
    nombre: object.nombre,
    descripcion: object.descripcion,
    imagenPrincipalUrl: object.imagen_url,
    modificador: {
      valor: object.modificador_valor,
      tipoCodigo: object.modificador_tipo_codigo,
      otro: object.modificador_otro,
    },
    modificadores: modifiers,
    creadoEn: object.creado_en,
    actualizadoEn: object.actualizado_en,
    modoVista: access.viewMode,
    creadoPor: serializeVisibleUser(object.usuarios),
    propietario: serializeVisibleUser(object.usuarios),
  }

  if (access.viewMode === 'preview') {
    return base
  }

  const groupedTraits = new Map()
  const flatTraits = []

  for (const trait of object.objeto_rasgos || []) {
    const type = trait.tipos_rasgo_objeto

    if (!type) {
      continue
    }

    if (!groupedTraits.has(type.id)) {
      groupedTraits.set(type.id, {
        id: type.id,
        nombre: type.nombre,
        ordenVisualizacion: type.orden_visualizacion,
        rasgos: [],
      })
    }

    const serializedTrait = {
      id: trait.id,
      tipoRasgoId: type.id,
      tipoRasgoNombre: type.nombre,
      tipoRasgoOrden: type.orden_visualizacion,
      nombre: trait.nombre,
      descripcion: trait.descripcion,
      ordenVisualizacion: trait.orden_visualizacion,
    }

    groupedTraits.get(type.id).rasgos.push(serializedTrait)
    flatTraits.push(serializedTrait)
  }

  return {
    ...base,
    puedeEditar: Boolean(access.canEdit),
    puedeEliminar: Boolean(access.canEdit),
    tier: object.tiers_objeto
      ? {
          id: object.tiers_objeto.id,
          nombre: object.tiers_objeto.nombre,
          ordenVisualizacion: object.tiers_objeto.orden_visualizacion,
        }
      : null,
    campanas: linkedCampaigns.map((campaign) => ({
      id: campaign.id,
      nombre: campaign.nombre,
    })),
    creadoPor: serializeVisibleUser(object.usuarios),
    propietario: serializeVisibleUser(object.usuarios),
    rasgosAgrupados: [...groupedTraits.values()].sort(
      (left, right) => left.ordenVisualizacion - right.ordenVisualizacion
    ),
    rasgos: flatTraits.sort(
      (left, right) => left.ordenVisualizacion - right.ordenVisualizacion
    ),
    hechizos: (object.objeto_hechizos || [])
      .map((item) =>
        item.hechizos
          ? {
              id: item.hechizos.id,
              nombre: item.hechizos.nombre,
              nivel: item.hechizos.nivel,
              escuela: item.hechizos.escuela,
              tipoCasteo: item.hechizos.tipo_casteo,
              concentracion: item.hechizos.concentracion,
              clases: item.hechizos.clases || [],
              descripcion: item.hechizos.descripcion,
              ordenVisualizacion: item.orden_visualizacion,
            }
          : null
      )
      .filter(Boolean),
    personajes: req
      ? (object.personaje_objetos || [])
          .map((item) => serializeLinkedCharacterForObject(item, req))
          .filter(Boolean)
      : [],
  }
}

function serializeObjectListItem(object, access) {
  const modifiers = object.objeto_modificadores?.length
    ? object.objeto_modificadores.map((modifier) => ({
        id: modifier.id,
        valor: modifier.valor,
        tipoCodigo: modifier.tipo_codigo,
        otro: modifier.otro,
        ordenVisualizacion: modifier.orden_visualizacion,
      }))
    : object.modificador_valor !== null &&
        object.modificador_valor !== undefined &&
        object.modificador_tipo_codigo
      ? [
          {
            id: null,
            valor: object.modificador_valor,
            tipoCodigo: object.modificador_tipo_codigo,
            otro: object.modificador_otro,
            ordenVisualizacion: 1,
          },
        ]
      : []

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
    objetoBaseId: object.objeto_base_id,
    esVersion: Boolean(object.objeto_base_id),
    ambitoVisibilidadCodigo: object.ambito_visibilidad_codigo,
    modoVista: access.viewMode,
    modificadores: modifiers,
    creadoEn: object.creado_en,
    actualizadoEn: object.actualizado_en,
  }
}

async function getEditableCampaignOptions(req, currentCampaignIds = []) {
  const campaigns =
    req.auth.roleCode === 'administrador'
      ? await prisma.campanas.findMany({
          orderBy: { nombre: 'asc' },
          select: { id: true, nombre: true },
        })
      : await prisma.campanas.findMany({
          where: {
            OR: [
              { master_usuario_id: req.auth.userId },
              { campana_jugadores: { some: { usuario_id: req.auth.userId } } },
            ],
          },
          orderBy: { nombre: 'asc' },
          select: { id: true, nombre: true },
        })

  if (!currentCampaignIds.length) {
    return campaigns
  }

  const missingIds = currentCampaignIds.filter(
    (id) => !campaigns.some((campaign) => campaign.id === id)
  )

  if (!missingIds.length) {
    return campaigns
  }

  const missingCampaigns = await prisma.campanas.findMany({
    where: { id: { in: missingIds } },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true },
  })

  return [...campaigns, ...missingCampaigns]
}

async function getObjectEditorMetadata({ objectId = null, req }) {
  await ensureObjectTierCatalog()

  const context = objectId ? await requireObjectEditAccess(objectId, req) : null
  const campaignIds = context?.object?.objeto_campanas?.length
    ? context.object.objeto_campanas.map((item) => item.campana_id)
    : [context?.object?.campana_id].filter(Boolean)

  const [
    users,
    campaigns,
    tiers,
    traitTypes,
    accessLevels,
    ownObjects,
    savedSpells,
  ] = await Promise.all([
    prisma.usuarios.findMany({
      where: {
        roles: {
          codigo: { not: 'administrador' },
        },
      },
      orderBy: { nombre_usuario: 'asc' },
      include: {
        roles: { select: { codigo: true, nombre: true } },
      },
    }),
    getEditableCampaignOptions(req, campaignIds || []),
    prisma.tiers_objeto.findMany({
      orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, orden_visualizacion: true },
    }),
    prisma.tipos_rasgo.findMany({
      orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, orden_visualizacion: true },
    }),
    prisma.niveles_acceso.findMany({
      orderBy: { nombre: 'asc' },
      select: { codigo: true, nombre: true, descripcion: true },
    }),
    prisma.objetos.findMany({
      where: { creado_por_usuario_id: req.auth.userId },
      orderBy: [{ creado_en: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        objeto_base_id: true,
        imagen_url: true,
        creado_en: true,
      },
    }),
    getSavedSpellsForEditor(req.auth.userId),
  ])

  const currentPermissions = objectId
    ? await prisma.permisos_objeto.findMany({
        where: { objeto_id: objectId },
        select: { usuario_id: true, nivel_acceso_codigo: true },
      })
    : []

  return {
    editor: {
      usuarios: users.map((user) => ({
        id: user.id,
        nombreUsuario: user.nombre_usuario,
        imagenPerfilUrl: user.imagen_perfil_url,
        rol: user.roles
          ? { codigo: user.roles.codigo, nombre: user.roles.nombre }
          : null,
      })),
      campanas: campaigns.map((campaign) => ({
        id: campaign.id,
        nombre: campaign.nombre,
      })),
      tiers: tiers.map((tier) => ({
        id: tier.id,
        nombre: tier.nombre,
        ordenVisualizacion: tier.orden_visualizacion,
      })),
      tiposRasgo: traitTypes.map((type) => ({
        id: type.id,
        nombre: type.nombre,
        ordenVisualizacion: type.orden_visualizacion,
      })),
      nivelesAcceso: accessLevels,
      permisosActuales: currentPermissions.map((permission) => ({
        usuarioId: permission.usuario_id,
        nivelAccesoCodigo: permission.nivel_acceso_codigo,
      })),
      objetosPropios: ownObjects.map((object) => ({
        id: object.id,
        nombre: object.nombre,
        descripcion: object.descripcion,
        objetoBaseId: object.objeto_base_id,
        imagenPrincipalUrl: object.imagen_url,
        creadoEn: object.creado_en,
      })),
      tiposMagico: OBJECT_TYPE_CODES,
      tiposModificador: MODIFIER_TYPE_CODES,
      hechizosGuardados: savedSpells,
    },
  }
}

async function assertCampaignsAreUsable(campaignIds, req) {
  const uniqueIds = [...new Set((campaignIds || []).filter(Boolean))]

  if (!uniqueIds.length) {
    return []
  }

  const campaigns = await Promise.all(
    uniqueIds.map((campaignId) =>
      getCampaignWithMembership(campaignId, req.auth.userId)
    )
  )

  for (const campaign of campaigns) {
    if (!campaign) {
      throw createHttpError(404, 'Una de las campañas seleccionadas no existe.')
    }

    const context = getCampaignRoleContext(campaign, req)

    if (!context.isMember) {
      throw createHttpError(
        403,
        'Debes pertenecer a todas las campañas seleccionadas.'
      )
    }
  }

  return uniqueIds
}

async function ensureObjectTraitType(tx, typeDraft, order) {
  let name = String(typeDraft.nombre || '').trim()

  if (typeDraft.tipoRasgoId) {
    const characterTraitType = await tx.tipos_rasgo.findUnique({
      where: { id: typeDraft.tipoRasgoId },
      select: { nombre: true, orden_visualizacion: true },
    })

    if (characterTraitType) {
      name = characterTraitType.nombre
      order = characterTraitType.orden_visualizacion || order
    } else {
      const objectTraitType = await tx.tipos_rasgo_objeto.findUnique({
        where: { id: typeDraft.tipoRasgoId },
        select: { id: true },
      })

      if (objectTraitType) {
        return objectTraitType.id
      }
    }
  }

  if (!name) {
    throw createHttpError(400, 'Todo grupo de rasgos necesita un tipo.')
  }

  const existing = await tx.tipos_rasgo_objeto.findFirst({
    where: { nombre: name },
    select: { id: true },
  })

  if (existing) {
    await tx.tipos_rasgo_objeto.update({
      where: { id: existing.id },
      data: { orden_visualizacion: order },
    })
    return existing.id
  }

  const created = await tx.tipos_rasgo_objeto.create({
    data: {
      nombre: name,
      orden_visualizacion: order,
    },
    select: { id: true },
  })

  return created.id
}

async function saveObjectDraft({ objectId = null, req, payload }) {
  await ensureObjectTierCatalog()

  const core = payload.core || {}
  const objectName = String(core.nombre || '').trim()
  const objectDescription = String(core.descripcion || '').trim()

  if (!objectName) {
    throw createHttpError(400, 'El nombre del objeto no puede quedar vacío.')
  }

  const campaignIds = await assertCampaignsAreUsable(core.campanaIds, req)
  const primaryCampaignId = campaignIds[0] || null

  if (objectId && core.objetoBaseId === objectId) {
    throw createHttpError(400, 'Un objeto no puede ser versión de sí mismo.')
  }

  if (core.objetoBaseId) {
    const baseContext = await requireObjectViewAccess(core.objetoBaseId, req)

    if (baseContext.object.creado_por_usuario_id !== req.auth.userId) {
      throw createHttpError(
        403,
        'Solo puedes versionar objetos creados por tu propio usuario.'
      )
    }
  }

  if (core.imagenPrincipalUrl) {
    await assertManagedImageUrl(core.imagenPrincipalUrl, {
      entityLabel: 'La imagen principal del objeto',
    })
  }

  if (
    core.tipoMagicoCodigo &&
    !OBJECT_TYPE_CODES.includes(core.tipoMagicoCodigo)
  ) {
    throw createHttpError(400, 'Tipo de objeto no válido.')
  }

  const modifier = payload.modificador || {}
  const modifiers = Array.isArray(payload.modificadores)
    ? payload.modificadores
    : modifier.valor !== null &&
        modifier.valor !== undefined &&
        modifier.tipoCodigo
      ? [modifier]
      : []

  for (const item of modifiers) {
    if (item.tipoCodigo && !MODIFIER_TYPE_CODES.includes(item.tipoCodigo)) {
      throw createHttpError(400, 'Tipo de modificador no válido.')
    }
  }

  const modifierKeys = new Set()

  for (const item of modifiers) {
    const key =
      item.tipoCodigo === 'otro'
        ? `${item.tipoCodigo}:${String(item.otro || '')
            .trim()
            .toLowerCase()}`
        : item.tipoCodigo

    if (modifierKeys.has(key)) {
      throw createHttpError(
        400,
        'Un objeto no puede repetir el mismo tipo de modificador.'
      )
    }

    modifierKeys.add(key)
  }

  const privacy = normalizePrivacyInput(payload.privacidad)
  const spellIds = Array.isArray(payload.hechizos)
    ? [
        ...new Set(
          payload.hechizos.map((item) => item?.hechizoId).filter(Boolean)
        ),
      ]
    : []
  const spellSlots = normalizeSpellSlots(payload.hechizosSlots)
  let previousContext = null

  if (objectId) {
    const previousObject = await getObjectWithContext(objectId, req.auth.userId)

    if (previousObject) {
      const previousAccess = getObjectAccessContext(previousObject, req)

      if (!previousAccess.canEdit) {
        throw createHttpError(403, 'No tienes permiso para editar este objeto.')
      }

      previousContext = {
        object: previousObject,
        access: previousAccess,
      }
    }
  }
  const previousImageUrl = previousContext?.object?.imagen_url || null
  const targetOwnerUserId =
    core.propietarioUsuarioId ||
    previousContext?.object?.creado_por_usuario_id ||
    req.auth.userId
  const targetOwner = await prisma.usuarios.findFirst({
    where: {
      id: targetOwnerUserId,
      roles: {
        codigo: { not: 'administrador' },
      },
    },
    select: { id: true },
  })

  if (!targetOwner) {
    throw createHttpError(404, 'El propietario indicado no existe.')
  }

  const savedObject = await prisma.$transaction(async (tx) => {
    const objectData = {
      campana_id: primaryCampaignId,
      creado_por_usuario_id: targetOwnerUserId,
      tier_id: core.tierId || null,
      objeto_base_id: core.objetoBaseId || null,
      ambito_visibilidad_codigo: privacy.visibilityCode,
      tipo_magico_codigo: core.tipoMagicoCodigo || 'no_magico',
      modificador_valor:
        modifiers[0]?.valor === null || modifiers[0]?.valor === undefined
          ? null
          : Number(modifiers[0].valor),
      modificador_tipo_codigo: modifiers[0]?.tipoCodigo || null,
      modificador_otro:
        modifiers[0]?.tipoCodigo === 'otro' ? modifiers[0].otro || null : null,
      hechizos_slots: spellSlots,
      nombre: objectName,
      descripcion: objectDescription || null,
      imagen_url: core.imagenPrincipalUrl || null,
      actualizado_en: new Date(),
    }

    const object =
      objectId && previousContext
        ? await tx.objetos.update({
            where: { id: objectId },
            data: objectData,
            select: { id: true },
          })
        : await tx.objetos.create({
            data: objectId ? { id: objectId, ...objectData } : objectData,
            select: { id: true },
          })

    await tx.objeto_campanas.deleteMany({
      where: { objeto_id: object.id },
    })

    if (campaignIds.length) {
      await tx.objeto_campanas.createMany({
        data: campaignIds.map((campaignId) => ({
          objeto_id: object.id,
          campana_id: campaignId,
        })),
        skipDuplicates: true,
      })
    }

    await tx.permisos_objeto.deleteMany({ where: { objeto_id: object.id } })

    if (privacy.explicitPermissions.length) {
      await tx.permisos_objeto.createMany({
        data: privacy.explicitPermissions.map((permission) => ({
          objeto_id: object.id,
          usuario_id: permission.usuarioId,
          nivel_acceso_codigo: permission.nivelAccesoCodigo,
          otorgado_por_usuario_id: req.auth.userId,
        })),
        skipDuplicates: true,
      })
    }

    await tx.objeto_modificadores.deleteMany({
      where: { objeto_id: object.id },
    })

    const normalizedModifiers = modifiers
      .filter(
        (item) =>
          item &&
          item.valor !== null &&
          item.valor !== undefined &&
          item.tipoCodigo
      )
      .map((item, index) => ({
        objeto_id: object.id,
        valor: Number(item.valor),
        tipo_codigo: item.tipoCodigo,
        otro: item.tipoCodigo === 'otro' ? item.otro || null : null,
        orden_visualizacion: index + 1,
      }))

    if (normalizedModifiers.length) {
      await tx.objeto_modificadores.createMany({
        data: normalizedModifiers,
        skipDuplicates: true,
      })
    }

    await tx.objeto_hechizos.deleteMany({ where: { objeto_id: object.id } })

    if (spellIds.length) {
      const visibleSpells = await tx.hechizos.findMany({
        where: {
          id: { in: spellIds },
          OR: [
            { es_publico: true },
            { creado_por_usuario_id: req.auth.userId },
            {
              hechizos_guardados_usuario: {
                some: { usuario_id: req.auth.userId },
              },
            },
          ],
        },
        select: { id: true },
      })
      const visibleSpellIds = new Set(visibleSpells.map((item) => item.id))

      await tx.objeto_hechizos.createMany({
        data: spellIds
          .filter((spellId) => visibleSpellIds.has(spellId))
          .map((spellId, index) => ({
            objeto_id: object.id,
            hechizo_id: spellId,
            orden_visualizacion: index,
          })),
        skipDuplicates: true,
      })
    }

    await tx.objeto_rasgos.deleteMany({ where: { objeto_id: object.id } })

    const traitGroups = payload.rasgos?.length
      ? Object.values(
          payload.rasgos.reduce((acc, trait) => {
            const key = trait.tipoRasgoId || 'rasgos'

            if (!acc[key]) {
              acc[key] = trait.tipoRasgoId
                ? { tipoRasgoId: trait.tipoRasgoId, nombre: '', rasgos: [] }
                : { nombre: 'Rasgos', rasgos: [] }
            }

            acc[key].rasgos.push(trait)
            return acc
          }, {})
        )
      : payload.rasgosAgrupados || []

    for (const [groupIndex, group] of traitGroups.entries()) {
      const typeId = await ensureObjectTraitType(tx, group, groupIndex + 1)
      const traits = (group.rasgos || []).filter(
        (trait) => trait.nombre?.trim() && trait.descripcion?.trim()
      )

      if (!traits.length) {
        continue
      }

      await tx.objeto_rasgos.createMany({
        data: traits.map((trait, traitIndex) => ({
          objeto_id: object.id,
          tipo_rasgo_id: typeId,
          nombre: trait.nombre.trim(),
          descripcion: trait.descripcion.trim(),
          orden_visualizacion: traitIndex + 1,
        })),
      })
    }

    return object
  })

  if (
    objectId &&
    core.imagenPrincipalUrl !== undefined &&
    previousImageUrl &&
    previousImageUrl !== (core.imagenPrincipalUrl || null)
  ) {
    await cleanupCloudinaryAssets([previousImageUrl])
  }

  let context

  try {
    context = await requireObjectViewAccess(savedObject.id, req)
  } catch (error) {
    if (objectId && !previousContext?.access?.canEdit) {
      throw error
    }

    const object = await getObjectWithContext(savedObject.id, req.auth.userId)
    context = {
      object,
      access: {
        ...getObjectAccessContext(object, req),
        canView: true,
        canEdit: false,
        viewMode: 'full',
      },
    }
  }

  const serialized = serializeObject(context.object, context.access)

  if (!objectId) {
    await notifyMastersOfCampaignEntryCreated({
      entityType: 'object',
      entityId: savedObject.id,
      entityName: objectName,
      campaignIds,
      actorUsuarioId: req.auth.userId,
    }).catch((error) => {
      console.warn('No se pudo crear la notificación del objeto:', error)
    })
  }

  return serialized
}

function parseObjectOffsetCursor(cursor) {
  const parsed = Number(cursor || 0)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

function getUniqueFilterValues(values) {
  return [...new Set(values || [])]
}

function splitCampaignFilterValues(values) {
  const selectedIds = getUniqueFilterValues(values)

  return {
    campaignIds: selectedIds.filter(
      (campaignId) =>
        campaignId !== WIKICODEX_CAMPAIGN_FILTER_ID &&
        campaignId !== NO_CAMPAIGN_SELECTION_FILTER_ID
    ),
    includeUnscoped: selectedIds.includes(WIKICODEX_CAMPAIGN_FILTER_ID),
    hasNoSelection: selectedIds.includes(NO_CAMPAIGN_SELECTION_FILTER_ID),
  }
}

function buildObjectCampaignFilterCondition(filters) {
  const { campaignIds, includeUnscoped, hasNoSelection } =
    splitCampaignFilterValues(filters.campaignIds)

  if (hasNoSelection) {
    return { id: { in: [] } }
  }

  const conditions = []

  if (campaignIds.length) {
    conditions.push(
      ...campaignIds.map((campaignId) => ({
        OR: [
          { campana_id: campaignId },
          { objeto_campanas: { some: { campana_id: campaignId } } },
        ],
      }))
    )
  }

  if (includeUnscoped) {
    conditions.push({
      AND: [{ campana_id: null }, { objeto_campanas: { none: {} } }],
    })
  }

  if (conditions.length === 1) {
    return conditions[0]
  }

  return conditions.length ? { OR: conditions } : null
}

function buildObjectArchiveOrderBy(sort) {
  switch (OBJECT_ARCHIVE_SORTS.has(sort) ? sort : 'created_desc') {
    case 'created_asc':
      return [{ creado_en: 'asc' }, { id: 'asc' }]
    case 'name_asc':
      return [{ nombre: 'asc' }, { id: 'asc' }]
    case 'name_desc':
      return [{ nombre: 'desc' }, { id: 'desc' }]
    case 'modifier_asc':
      return [{ modificador_valor: 'asc' }, { nombre: 'asc' }, { id: 'asc' }]
    case 'modifier_desc':
      return [{ modificador_valor: 'desc' }, { nombre: 'asc' }, { id: 'asc' }]
    case 'created_desc':
    default:
      return [{ creado_en: 'desc' }, { id: 'desc' }]
  }
}

function isObjectModifierSort(sort) {
  return sort === 'modifier_asc' || sort === 'modifier_desc'
}

function getHighestObjectModifierValue(object) {
  const values = []

  if (
    object.modificador_valor !== null &&
    object.modificador_valor !== undefined
  ) {
    values.push(Number(object.modificador_valor))
  }

  for (const modifier of object.objeto_modificadores || []) {
    if (modifier.valor !== null && modifier.valor !== undefined) {
      values.push(Number(modifier.valor))
    }
  }

  return values.length ? Math.max(...values) : null
}

function compareObjectsByHighestModifier(left, right, direction) {
  const leftValue = getHighestObjectModifierValue(left)
  const rightValue = getHighestObjectModifierValue(right)

  if (leftValue === null && rightValue === null) {
    return (
      String(left.nombre || '').localeCompare(String(right.nombre || '')) ||
      String(left.id).localeCompare(String(right.id))
    )
  }

  if (leftValue === null) {
    return 1
  }

  if (rightValue === null) {
    return -1
  }

  return direction === 'asc'
    ? leftValue - rightValue ||
        String(left.nombre || '').localeCompare(String(right.nombre || '')) ||
        String(left.id).localeCompare(String(right.id))
    : rightValue - leftValue ||
        String(left.nombre || '').localeCompare(String(right.nombre || '')) ||
        String(left.id).localeCompare(String(right.id))
}

async function findObjectIdsByNameSearch(query) {
  const term = normalizeSearchTerm(query)

  if (!term) {
    return null
  }

  const escapedTerm = escapeLikeTerm(term)
  const prefixOnly = term.length < 3
  const { rows } = await pool.query(
    `
      SELECT id::text
      FROM objetos
      WHERE (
        ($2::boolean = true AND public.wikicodex_search_normalize(nombre) LIKE $1 || '%' ESCAPE '\\')
        OR
        ($2::boolean = false AND public.wikicodex_search_normalize(nombre) LIKE '%' || $1 || '%' ESCAPE '\\')
      )
      LIMIT 10000
    `,
    [escapedTerm, prefixOnly]
  )

  return rows.map((row) => row.id)
}

function buildModifierRangeCondition(min, max) {
  if (min === null && max === null) {
    return null
  }

  const range = {
    ...(min !== null ? { gte: min } : {}),
    ...(max !== null ? { lte: max } : {}),
  }

  return {
    OR: [
      {
        modificador_valor: {
          not: null,
          ...range,
        },
      },
      {
        objeto_modificadores: {
          some: {
            valor: range,
          },
        },
      },
    ],
  }
}

function buildObjectArchiveFilterConditions(filters) {
  const conditions = []
  const tierIds = getUniqueFilterValues(filters.tierIds)
  const typeCodes = getUniqueFilterValues(filters.tipoMagicoCodigos)
  const modifierTypeCodes = getUniqueFilterValues(filters.modifierTypeCodes)

  if (tierIds.length && filters.view !== 'tierlist') {
    conditions.push(...tierIds.map((tierId) => ({ tier_id: tierId })))
  }

  if (typeCodes.length) {
    conditions.push(
      ...typeCodes.map((typeCode) => ({ tipo_magico_codigo: typeCode }))
    )
  }

  if (modifierTypeCodes.length) {
    conditions.push(
      ...modifierTypeCodes.map((typeCode) => ({
        OR: [
          { modificador_tipo_codigo: typeCode },
          {
            objeto_modificadores: {
              some: {
                tipo_codigo: typeCode,
              },
            },
          },
        ],
      }))
    )
  }

  const modifierRange = buildModifierRangeCondition(
    filters.modifierMin,
    filters.modifierMax
  )

  if (modifierRange) {
    conditions.push(modifierRange)
  }

  return conditions
}

async function buildObjectArchiveWhere(req, filters) {
  const baseConditions = []

  if (filters.view === 'tierlist') {
    baseConditions.push({ tier_id: { not: null } })
  }

  const matchingIds = await findObjectIdsByNameSearch(filters.q)

  if (matchingIds) {
    baseConditions.push({ id: { in: matchingIds } })
  }

  const campaignCondition = buildObjectCampaignFilterCondition(filters)

  if (campaignCondition) {
    baseConditions.push(campaignCondition)
  }

  const filterConditions = buildObjectArchiveFilterConditions(filters)

  if (filterConditions.length === 1) {
    baseConditions.push(filterConditions[0])
  } else if (filterConditions.length > 1) {
    baseConditions.push(
      filters.matchMode === 'any'
        ? { OR: filterConditions }
        : { AND: filterConditions }
    )
  }

  const archiveWhere = baseConditions.length ? { AND: baseConditions } : {}
  const visibilityWhere =
    req.auth.roleCode === 'administrador'
      ? {}
      : buildVisibleObjectWhere(req.auth.userId)

  if (Object.keys(archiveWhere).length && Object.keys(visibilityWhere).length) {
    return { AND: [archiveWhere, visibilityWhere] }
  }

  return Object.keys(archiveWhere).length ? archiveWhere : visibilityWhere
}

async function listObjectArchivePage({ req, filters, limit = 30, cursor = 0 }) {
  const safeLimit = Math.max(1, Math.min(limit, 500))
  const safeCursor = parseObjectOffsetCursor(cursor)
  const where = await buildObjectArchiveWhere(req, filters)
  const include = getObjectListInclude(req.auth.userId)

  if (isObjectModifierSort(filters.sort)) {
    const objects = await prisma.objetos.findMany({
      where,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      include,
    })
    const sortedObjects = objects.sort((left, right) =>
      compareObjectsByHighestModifier(
        left,
        right,
        filters.sort === 'modifier_asc' ? 'asc' : 'desc'
      )
    )
    const pagedObjects = sortedObjects.slice(safeCursor, safeCursor + safeLimit)
    const items = pagedObjects
      .map((object) => {
        const access = getObjectAccessContext(object, req)
        return access.canView ? serializeObjectListItem(object, access) : null
      })
      .filter(Boolean)
    const totalVisible = sortedObjects.length

    return {
      items,
      meta: {
        limit: safeLimit,
        cursor: safeCursor,
        returned: items.length,
        totalVisible,
        nextCursor:
          safeCursor + pagedObjects.length < totalVisible
            ? String(safeCursor + pagedObjects.length)
            : null,
        hasMore: safeCursor + pagedObjects.length < totalVisible,
      },
    }
  }

  const [totalVisible, objects] = await Promise.all([
    prisma.objetos.count({ where }),
    prisma.objetos.findMany({
      where,
      skip: safeCursor,
      orderBy: buildObjectArchiveOrderBy(filters.sort),
      take: safeLimit,
      include,
    }),
  ])
  const items = objects
    .map((object) => {
      const access = getObjectAccessContext(object, req)
      return access.canView ? serializeObjectListItem(object, access) : null
    })
    .filter(Boolean)

  return {
    items,
    meta: {
      limit: safeLimit,
      cursor: safeCursor,
      returned: items.length,
      totalVisible,
      nextCursor:
        safeCursor + objects.length < totalVisible
          ? String(safeCursor + objects.length)
          : null,
      hasMore: safeCursor + objects.length < totalVisible,
    },
  }
}

async function getObjectArchiveMetadata() {
  await ensureObjectTierCatalog()

  const tiers = await prisma.tiers_objeto.findMany({
    orderBy: [{ orden_visualizacion: 'desc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      orden_visualizacion: true,
    },
  })

  return {
    tiers: tiers.map((tier) => ({
      id: tier.id,
      nombre: tier.nombre,
      ordenVisualizacion: tier.orden_visualizacion,
    })),
    tiposMagico: OBJECT_TYPE_CODES,
    tiposModificador: MODIFIER_TYPE_CODES,
  }
}

async function listVisibleObjects({
  req,
  limit = 30,
  cursor = 0,
  baseWhere = {},
}) {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const safeCursor = Math.max(0, cursor || 0)
  const visibilityWhere =
    req.auth.roleCode === 'administrador'
      ? {}
      : buildVisibleObjectWhere(req.auth.userId)
  const where =
    Object.keys(baseWhere).length && Object.keys(visibilityWhere).length
      ? { AND: [baseWhere, visibilityWhere] }
      : Object.keys(baseWhere).length
        ? baseWhere
        : visibilityWhere
  const [totalVisible, objects] = await Promise.all([
    prisma.objetos.count({ where }),
    prisma.objetos.findMany({
      where,
      skip: safeCursor,
      orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      include: getObjectListInclude(req.auth.userId),
    }),
  ])
  const items = objects
    .map((object) => {
      const access = getObjectAccessContext(object, req)
      return access.canView ? serializeObjectListItem(object, access) : null
    })
    .filter(Boolean)

  return {
    items,
    meta: {
      limit: safeLimit,
      cursor: safeCursor,
      returned: items.length,
      totalVisible,
      nextCursor:
        safeCursor + objects.length < totalVisible
          ? String(safeCursor + objects.length)
          : null,
    },
  }
}

async function listObjectVersions({ objectId, req }) {
  const context = await requireObjectViewAccess(objectId, req)
  const rootId = context.object.objeto_base_id || context.object.id
  const related = await prisma.objetos.findMany({
    where: {
      OR: [{ id: rootId }, { objeto_base_id: rootId }],
    },
    orderBy: [{ creado_en: 'asc' }, { nombre: 'asc' }],
    include: getObjectInclude(req.auth.userId),
  })

  const visible = related
    .map((object) => {
      const access = getObjectAccessContext(object, req)
      return access.canView ? serializeObjectListItem(object, access) : null
    })
    .filter(Boolean)

  return {
    item: serializeObjectListItem(context.object, context.access),
    versiones: visible,
  }
}

async function deleteObject({ objectId, req }) {
  const context = await requireObjectEditAccess(objectId, req)
  const imageUrl = context.object.imagen_url

  await prisma.objetos.delete({ where: { id: objectId } })
  await cleanupCloudinaryAssets([imageUrl])
}

module.exports = {
  MODIFIER_TYPE_CODES,
  OBJECT_TYPE_CODES,
  OBJECT_VISIBILITY_CODES,
  buildVisibleObjectWhere,
  deleteObject,
  getObjectAccessContext,
  getObjectArchiveMetadata,
  getObjectEditorMetadata,
  getObjectInclude,
  listObjectArchivePage,
  listObjectVersions,
  listVisibleObjects,
  requireObjectViewAccess,
  saveObjectDraft,
  serializeObject,
}
