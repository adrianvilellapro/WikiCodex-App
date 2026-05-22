const { createHttpError } = require('../lib/errors')
const { pool, prisma } = require('../lib/prisma')
const {
  NON_ADMIN_USER_WHERE,
  serializeVisibleUser,
} = require('../lib/user-visibility')
const { isGlobalAdmin } = require('./campaign-access.service')

const VISIBLE_PERMISSION_CODES = ['full', 'completo', 'preview', 'vista_previa']
const PUBLIC_VISIBILITY_CODES = ['campana_completo', 'campana_vista_previa']
const POWER_ARCHIVE_SORTS = new Set([
  'created_desc',
  'created_asc',
  'updated_desc',
  'updated_asc',
  'name_asc',
  'name_desc',
])
const WIKICODEX_CAMPAIGN_FILTER_ID = '__wikicodex'
const NO_CAMPAIGN_SELECTION_FILTER_ID = '__none'

function normalizeText(value) {
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

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(value.map((item) => String(item || '').trim()).filter(Boolean)),
  ]
}

function normalizeUuidArray(value) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    ),
  ]
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

function buildPowerCampaignConditionFromIds(campaignIds) {
  if (!campaignIds.length) {
    return null
  }

  const conditions = campaignIds.map((campaignId) => ({
    OR: [
      { campana_id: campaignId },
      { poder_campanas: { some: { campana_id: campaignId } } },
    ],
  }))

  return conditions.length === 1 ? conditions[0] : { OR: conditions }
}

function buildPowerCampaignFilterCondition(filters) {
  const { campaignIds, includeUnscoped, hasNoSelection } =
    splitCampaignFilterValues(filters.campaignIds)

  if (hasNoSelection) {
    return { id: { in: [] } }
  }

  const conditions = []
  const campaignCondition = buildPowerCampaignConditionFromIds(campaignIds)

  if (campaignCondition) {
    conditions.push(campaignCondition)
  }

  if (includeUnscoped) {
    conditions.push({
      AND: [{ campana_id: null }, { poder_campanas: { none: {} } }],
    })
  }

  if (!conditions.length && filters.campaignId) {
    return buildPowerCampaignConditionFromIds([filters.campaignId])
  }

  if (conditions.length === 1) {
    return conditions[0]
  }

  return conditions.length ? { OR: conditions } : null
}

function parsePowerOffsetCursor(cursor) {
  const parsed = Number(cursor || 0)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

function buildPowerArchiveOrderBy(sort) {
  switch (POWER_ARCHIVE_SORTS.has(sort) ? sort : 'created_desc') {
    case 'created_asc':
      return [{ creado_en: 'asc' }, { id: 'asc' }]
    case 'updated_desc':
      return [{ actualizado_en: 'desc' }, { id: 'desc' }]
    case 'updated_asc':
      return [{ actualizado_en: 'asc' }, { id: 'asc' }]
    case 'name_asc':
      return [{ nombre: 'asc' }, { id: 'asc' }]
    case 'name_desc':
      return [{ nombre: 'desc' }, { id: 'desc' }]
    case 'created_desc':
    default:
      return [{ creado_en: 'desc' }, { id: 'desc' }]
  }
}

async function findPowerIdsByNameSearch(query) {
  const term = normalizeText(query)

  if (!term) {
    return null
  }

  const escapedTerm = escapeLikeTerm(term)
  const prefixOnly = term.length < 3
  const { rows } = await pool.query(
    `
      SELECT id::text
      FROM poderes
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

function normalizeVisibility(value) {
  if (PUBLIC_VISIBILITY_CODES.includes(value)) {
    return value
  }

  if (value === 'privado') {
    return 'privado'
  }

  return 'usuarios_seleccionados'
}

function getLinkedCharacterInclude(userId) {
  return {
    id: true,
    nombre: true,
    titulo: true,
    imagen_principal_url: true,
    ambito_visibilidad_codigo: true,
    propietario_usuario_id: true,
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

function getPowerInclude(userId, options = {}) {
  return {
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
    poder_campanas: {
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
    permisos_poder: {
      select: { usuario_id: true, nivel_acceso_codigo: true },
    },
    asignaciones_categoria_poder: {
      include: {
        categorias_poder: {
          select: {
            id: true,
            nombre: true,
            campana_origen_id: true,
            es_relevante_para_campana_origen: true,
          },
        },
      },
      orderBy: { creado_en: 'asc' },
    },
    ...(options.includeLinkedCharacters
      ? {
          personaje_poderes: {
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

function powerCampaigns(power) {
  const map = new Map()

  if (power.campanas) {
    map.set(power.campanas.id, power.campanas)
  }

  for (const relation of power.poder_campanas || []) {
    if (relation.campanas) {
      map.set(relation.campanas.id, relation.campanas)
    }
  }

  return [...map.values()]
}

function campaignCanBeRead(campaign, userId) {
  if (!campaign) {
    return false
  }

  return (
    campaign.master_usuario_id === userId ||
    campaign.privacidad_codigo !== 'privada' ||
    Boolean(campaign.campana_jugadores?.length)
  )
}

function getPowerAccessContext(power, req) {
  const isAdmin = isGlobalAdmin(req)
  const isOwner = power.creado_por_usuario_id === req.auth.userId
  const explicitPermission =
    power.permisos_poder?.find(
      (permission) => permission.usuario_id === req.auth.userId
    )?.nivel_acceso_codigo || null
  const campaigns = powerCampaigns(power)
  const isMaster = campaigns.some(
    (campaign) => campaign.master_usuario_id === req.auth.userId
  )
  const hasCampaignAccess =
    !campaigns.length ||
    campaigns.some((campaign) => campaignCanBeRead(campaign, req.auth.userId))

  if (isAdmin || isOwner || isMaster) {
    return { canView: true, canEdit: true, viewMode: 'full' }
  }

  if (explicitPermission === 'full' || explicitPermission === 'completo') {
    return { canView: true, canEdit: false, viewMode: 'full' }
  }

  if (
    explicitPermission === 'preview' ||
    explicitPermission === 'vista_previa'
  ) {
    return { canView: true, canEdit: false, viewMode: 'preview' }
  }

  if (
    hasCampaignAccess &&
    power.ambito_visibilidad_codigo === 'campana_completo'
  ) {
    return { canView: true, canEdit: false, viewMode: 'full' }
  }

  if (
    hasCampaignAccess &&
    power.ambito_visibilidad_codigo === 'campana_vista_previa'
  ) {
    return { canView: true, canEdit: false, viewMode: 'preview' }
  }

  return { canView: false, canEdit: false, viewMode: 'none' }
}

function linkedCharacterAccessMode(character, req) {
  const campaign = character.campanas || null
  const isAdmin = isGlobalAdmin(req)
  const isOwner = character.propietario_usuario_id === req.auth.userId
  const isMaster = campaign?.master_usuario_id === req.auth.userId || isAdmin
  const hasCampaignAccess = campaignCanBeRead(campaign, req.auth.userId)
  const explicitPermission =
    character.permisos_personaje?.[0]?.nivel_acceso_codigo || null

  if (isOwner || isMaster) {
    return 'full'
  }

  if (explicitPermission === 'full' || explicitPermission === 'completo') {
    return 'full'
  }

  if (
    hasCampaignAccess &&
    character.ambito_visibilidad_codigo === 'campana_completo'
  ) {
    return 'full'
  }

  return 'none'
}

function serializeLinkedCharacterForPower(link, req) {
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

function serializePower(
  power,
  req,
  access = getPowerAccessContext(power, req)
) {
  const base = {
    id: power.id,
    nombre: power.nombre,
    descripcion: power.descripcion,
    imagenUrl: power.imagen_url,
    ambitoVisibilidadCodigo: power.ambito_visibilidad_codigo,
    creadoPorUsuarioId: power.creado_por_usuario_id,
    creadoPor: serializeVisibleUser(power.usuarios),
    creadoEn: power.creado_en,
    actualizadoEn: power.actualizado_en,
    modoVista: access.viewMode,
    puedeEditar: Boolean(access.canEdit),
    campanas: powerCampaigns(power).map((campaign) => ({
      id: campaign.id,
      nombre: campaign.nombre,
    })),
    categorias: (power.asignaciones_categoria_poder || [])
      .map((item) => item.categorias_poder)
      .filter(Boolean)
      .map((category) => ({
        id: category.id,
        nombre: category.nombre,
        campanaOrigenId: category.campana_origen_id,
        esRelevanteParaCampanaOrigen: category.es_relevante_para_campana_origen,
      })),
    permisosUsuarios: access.canEdit
      ? (power.permisos_poder || []).map((permission) => ({
          usuarioId: permission.usuario_id,
          nivelAccesoCodigo:
            permission.nivel_acceso_codigo === 'vista_previa'
              ? 'vista_previa'
              : 'completo',
        }))
      : [],
    personajes:
      access.viewMode === 'full'
        ? (power.personaje_poderes || [])
            .map((item) => serializeLinkedCharacterForPower(item, req))
            .filter(Boolean)
        : [],
  }

  if (access.viewMode === 'preview') {
    return base
  }

  return base
}

function buildVisiblePowerWhere(req, baseWhere = {}) {
  if (isGlobalAdmin(req)) {
    return baseWhere
  }

  return {
    ...baseWhere,
    OR: [
      { creado_por_usuario_id: req.auth.userId },
      {
        AND: [
          { ambito_visibilidad_codigo: { in: PUBLIC_VISIBILITY_CODES } },
          {
            OR: [
              { campana_id: null, poder_campanas: { none: {} } },
              {
                campanas: {
                  is: {
                    OR: [
                      { master_usuario_id: req.auth.userId },
                      { privacidad_codigo: 'publica' },
                      {
                        campana_jugadores: {
                          some: { usuario_id: req.auth.userId },
                        },
                      },
                    ],
                  },
                },
              },
              {
                poder_campanas: {
                  some: {
                    campanas: {
                      OR: [
                        { master_usuario_id: req.auth.userId },
                        { privacidad_codigo: 'publica' },
                        {
                          campana_jugadores: {
                            some: { usuario_id: req.auth.userId },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      {
        permisos_poder: {
          some: {
            usuario_id: req.auth.userId,
            nivel_acceso_codigo: { in: VISIBLE_PERMISSION_CODES },
          },
        },
      },
      { campanas: { is: { master_usuario_id: req.auth.userId } } },
      {
        poder_campanas: {
          some: { campanas: { master_usuario_id: req.auth.userId } },
        },
      },
    ],
  }
}

function buildPowerArchiveFilterConditions(filters) {
  const conditions = []
  const categoryIds = getUniqueFilterValues(filters.categoryIds)

  if (categoryIds.length) {
    conditions.push(
      ...categoryIds.map((categoryId) => ({
        asignaciones_categoria_poder: {
          some: {
            categoria_id: categoryId,
          },
        },
      }))
    )
  }

  if (filters.createdByUserId) {
    conditions.push({ creado_por_usuario_id: filters.createdByUserId })
  }

  if (filters.categoria) {
    conditions.push({
      asignaciones_categoria_poder: {
        some: {
          categorias_poder: {
            nombre: { equals: filters.categoria, mode: 'insensitive' },
          },
        },
      },
    })
  }

  return conditions
}

async function buildPowerArchiveWhere(req, filters = {}) {
  const baseConditions = []
  const matchingIds = await findPowerIdsByNameSearch(filters.q)

  if (matchingIds) {
    baseConditions.push({ id: { in: matchingIds } })
  }

  const campaignCondition = buildPowerCampaignFilterCondition(filters)

  if (campaignCondition) {
    baseConditions.push(campaignCondition)
  }

  const filterConditions = buildPowerArchiveFilterConditions(filters)

  if (filterConditions.length === 1) {
    baseConditions.push(filterConditions[0])
  } else if (filterConditions.length > 1) {
    baseConditions.push(
      filters.matchMode === 'any'
        ? { OR: filterConditions }
        : { AND: filterConditions }
    )
  }

  const baseWhere = baseConditions.length ? { AND: baseConditions } : {}
  return buildVisiblePowerWhere(req, baseWhere)
}

async function listPowers({ req, limit = 20, cursor = 0, filters = {} }) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 500))
  const safeCursor = parsePowerOffsetCursor(cursor)
  const where = await buildPowerArchiveWhere(req, filters)
  const [totalVisible, powers] = await Promise.all([
    prisma.poderes.count({ where }),
    prisma.poderes.findMany({
      where,
      orderBy: buildPowerArchiveOrderBy(filters.sort),
      skip: safeCursor,
      take: safeLimit,
      include: getPowerInclude(req.auth.userId),
    }),
  ])
  const items = powers
    .map((power) => {
      const access = getPowerAccessContext(power, req)
      return access.canView ? serializePower(power, req, access) : null
    })
    .filter(Boolean)

  return {
    items,
    meta: {
      totalVisible,
      returned: items.length,
      limit: safeLimit,
      cursor: safeCursor,
      nextCursor:
        safeCursor + powers.length < totalVisible
          ? String(safeCursor + powers.length)
          : null,
    },
  }
}

async function requirePowerViewAccess({
  req,
  powerId,
  includeLinkedCharacters = false,
}) {
  const power = await prisma.poderes.findUnique({
    where: { id: powerId },
    include: getPowerInclude(req.auth.userId, { includeLinkedCharacters }),
  })

  if (!power) {
    throw createHttpError(404, 'El poder indicado no existe.')
  }

  const access = getPowerAccessContext(power, req)

  if (!access.canView) {
    throw createHttpError(403, 'No tienes permiso para ver este poder.')
  }

  return { power, access }
}

async function getPowerDetail({ req, powerId }) {
  const { power, access } = await requirePowerViewAccess({
    req,
    powerId,
    includeLinkedCharacters: true,
  })
  return serializePower(power, req, access)
}

async function requirePowerEditAccess({ req, powerId }) {
  const context = await requirePowerViewAccess({ req, powerId })

  if (!context.access.canEdit) {
    throw createHttpError(403, 'No tienes permiso para editar este poder.')
  }

  return context
}

async function getManageableCampaignIds(req, campaignIds = []) {
  const ids = normalizeUuidArray(campaignIds)

  if (!ids.length) {
    return []
  }

  const campaigns = await prisma.campanas.findMany({
    where: isGlobalAdmin(req)
      ? { id: { in: ids } }
      : { id: { in: ids }, master_usuario_id: req.auth.userId },
    select: { id: true },
  })

  return campaigns.map((campaign) => campaign.id)
}

async function upsertCategories(tx, names, req) {
  const normalizedNames = normalizeArray(names)
  const categories = []

  for (const name of normalizedNames) {
    const category = await tx.categorias_poder.upsert({
      where: { nombre: name },
      update: { actualizado_en: new Date() },
      create: {
        nombre: name,
        creado_por_usuario_id: req.auth.userId,
      },
      select: { id: true, nombre: true },
    })
    categories.push(category)
  }

  return categories
}

function normalizePermissions(value = []) {
  if (!Array.isArray(value)) {
    return []
  }

  const byUser = new Map()

  for (const item of value) {
    const usuarioId = String(item?.usuarioId || '').trim()
    const nivelAccesoCodigo =
      item?.nivelAccesoCodigo === 'vista_previa' ? 'vista_previa' : 'completo'

    if (usuarioId) {
      byUser.set(usuarioId, { usuarioId, nivelAccesoCodigo })
    }
  }

  return [...byUser.values()]
}

function buildPowerData(payload, req) {
  const nombre = String(payload.nombre || '').trim()

  if (!nombre) {
    throw createHttpError(400, 'El poder necesita un nombre.')
  }

  return {
    creado_por_usuario_id: req.auth.userId,
    nombre,
    nombre_normalizado: normalizeText(nombre),
    descripcion: payload.descripcion?.trim() || null,
    imagen_url: payload.imagenUrl || null,
    ambito_visibilidad_codigo: normalizeVisibility(
      payload.ambitoVisibilidadCodigo
    ),
  }
}

async function writePowerRelations(tx, powerId, payload, req) {
  const campaignIds = await getManageableCampaignIds(req, payload.campanaIds)
  const categories = await upsertCategories(tx, payload.categorias, req)
  const permissions = normalizePermissions(payload.permisosUsuarios)

  await tx.poder_campanas.deleteMany({ where: { poder_id: powerId } })
  await tx.asignaciones_categoria_poder.deleteMany({
    where: { poder_id: powerId },
  })
  await tx.permisos_poder.deleteMany({ where: { poder_id: powerId } })

  if (campaignIds.length) {
    await tx.poder_campanas.createMany({
      data: campaignIds.map((campaignId) => ({
        poder_id: powerId,
        campana_id: campaignId,
      })),
      skipDuplicates: true,
    })
  }

  if (categories.length) {
    await tx.asignaciones_categoria_poder.createMany({
      data: categories.map((category) => ({
        poder_id: powerId,
        categoria_id: category.id,
      })),
      skipDuplicates: true,
    })
  }

  if (permissions.length) {
    await tx.permisos_poder.createMany({
      data: permissions.map((permission) => ({
        poder_id: powerId,
        usuario_id: permission.usuarioId,
        nivel_acceso_codigo: permission.nivelAccesoCodigo,
        otorgado_por_usuario_id: req.auth.userId,
      })),
      skipDuplicates: true,
    })
  }
}

async function createPower({ req, payload }) {
  const power = await prisma.$transaction(async (tx) => {
    const created = await tx.poderes.create({
      data: buildPowerData(payload, req),
      select: { id: true },
    })

    await writePowerRelations(tx, created.id, payload, req)
    return created
  })

  return getPowerDetail({ req, powerId: power.id })
}

async function updatePower({ req, powerId, payload }) {
  await requirePowerEditAccess({ req, powerId })

  await prisma.$transaction(async (tx) => {
    await tx.poderes.update({
      where: { id: powerId },
      data: {
        ...buildPowerData(payload, req),
        creado_por_usuario_id: undefined,
        actualizado_en: new Date(),
      },
    })

    await writePowerRelations(tx, powerId, payload, req)
  })

  return getPowerDetail({ req, powerId })
}

async function deletePower({ req, powerId }) {
  await requirePowerEditAccess({ req, powerId })
  await prisma.poderes.delete({ where: { id: powerId } })
  return { eliminado: true }
}

async function getPowerOptions({ req }) {
  const [categories, campaigns, users] = await Promise.all([
    prisma.categorias_poder.findMany({
      orderBy: [{ actualizado_en: 'desc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, actualizado_en: true },
    }),
    prisma.campanas.findMany({
      where: isGlobalAdmin(req) ? {} : { master_usuario_id: req.auth.userId },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    prisma.usuarios.findMany({
      where: {
        id: { not: req.auth.userId },
        ...NON_ADMIN_USER_WHERE,
      },
      include: { roles: true },
      orderBy: { nombre_usuario: 'asc' },
    }),
  ])

  return {
    categorias: categories,
    campanasGestionables: campaigns,
    usuarios: users.map((user) => ({
      id: user.id,
      nombreUsuario: user.nombre_usuario,
      imagenPerfilUrl: user.imagen_perfil_url,
      rol: user.roles
        ? { codigo: user.roles.codigo, nombre: user.roles.nombre }
        : null,
    })),
  }
}

module.exports = {
  buildVisiblePowerWhere,
  createPower,
  deletePower,
  getPowerAccessContext,
  getPowerDetail,
  getPowerInclude,
  getPowerOptions,
  listPowers,
  requirePowerViewAccess,
  serializePower,
  updatePower,
}
