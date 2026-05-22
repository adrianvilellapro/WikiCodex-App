const { pool, prisma } = require('../lib/prisma')
const { isGlobalAdmin } = require('./campaign-access.service')

const VISIBLE_PERMISSION_CODES = ['full', 'completo', 'preview', 'vista_previa']

const PUBLIC_VISIBILITY_CODES = ['campana_completo', 'campana_vista_previa']

const CHARACTER_LIST_ORDER_BY = [{ creado_en: 'desc' }, { id: 'desc' }]

const CHARACTER_ARCHIVE_SORTS = new Set([
  'created_desc',
  'created_asc',
  'name_asc',
  'name_desc',
  'age_asc',
  'age_desc',
  'height_asc',
  'height_desc',
  'weight_asc',
  'weight_desc',
])

const WIKICODEX_CAMPAIGN_FILTER_ID = '__wikicodex'
const NO_CAMPAIGN_SELECTION_FILTER_ID = '__none'

function serializeNullableNumber(value) {
  if (value === null || value === undefined) {
    return null
  }

  return Number(value)
}

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

function getCharacterListSelect(viewerUserId) {
  return {
    id: true,
    campana_id: true,
    aventura_id: true,
    propietario_usuario_id: true,
    personaje_base_id: true,
    nombre: true,
    titulo: true,
    imagen_principal_url: true,
    ambito_visibilidad_codigo: true,
    creado_en: true,
    actualizado_en: true,
    tier_id: true,
    estado_id: true,
    edad: true,
    altura_metros: true,
    peso_kg: true,
    es_criatura: true,
    tiers_personaje: {
      select: {
        id: true,
        nombre: true,
        orden_visualizacion: true,
      },
    },
    estados_personaje: {
      select: {
        id: true,
        codigo: true,
        nombre: true,
      },
    },
    asignaciones_categoria_personaje: {
      orderBy: { creado_en: 'asc' },
      include: {
        categorias_personaje: {
          select: {
            id: true,
            nombre: true,
            campana_origen_id: true,
            es_relevante_para_campana_origen: true,
          },
        },
      },
    },
    campanas: {
      select: {
        master_usuario_id: true,
        privacidad_codigo: true,
        campana_jugadores: {
          where: {
            usuario_id: viewerUserId,
          },
          select: {
            usuario_id: true,
          },
        },
      },
    },
    ...(viewerUserId
      ? {
          permisos_personaje: {
            where: {
              usuario_id: viewerUserId,
            },
            select: {
              nivel_acceso_codigo: true,
            },
          },
        }
      : {}),
  }
}

function serializeCharacterListItem(character, access) {
  return {
    id: character.id,
    campanaId: character.campana_id,
    aventuraId: character.aventura_id,
    propietarioUsuarioId: character.propietario_usuario_id,
    personajeBaseId: character.personaje_base_id,
    esVersion: Boolean(character.personaje_base_id),
    nombre: character.nombre,
    titulo: character.titulo,
    imagenPrincipalUrl: character.imagen_principal_url,
    ambitoVisibilidadCodigo: character.ambito_visibilidad_codigo,
    creadoEn: character.creado_en,
    actualizadoEn: character.actualizado_en,
    modoVista: access.viewMode,
    tier: character.tiers_personaje
      ? {
          id: character.tiers_personaje.id,
          nombre: character.tiers_personaje.nombre,
          ordenVisualizacion: character.tiers_personaje.orden_visualizacion,
        }
      : null,
    estado: character.estados_personaje
      ? {
          id: character.estados_personaje.id,
          codigo: character.estados_personaje.codigo,
          nombre: character.estados_personaje.nombre,
        }
      : null,
    edad: serializeNullableNumber(character.edad),
    alturaMetros: serializeNullableNumber(character.altura_metros),
    pesoKg: serializeNullableNumber(character.peso_kg),
    esCriatura: Boolean(character.es_criatura),
    categorias: (character.asignaciones_categoria_personaje || [])
      .map((item) => item.categorias_personaje)
      .filter(Boolean)
      .map((categoria) => ({
        id: categoria.id,
        nombre: categoria.nombre,
        campanaOrigenId: categoria.campana_origen_id,
        esRelevanteParaCampanaOrigen:
          categoria.es_relevante_para_campana_origen,
      })),
  }
}

function encodeCharacterCursorFromParts(createdAt, id) {
  if (!createdAt || !id) {
    return null
  }

  return Buffer.from(`${new Date(createdAt).toISOString()}|${id}`).toString(
    'base64url'
  )
}

function encodeCharacterCursor(character) {
  return encodeCharacterCursorFromParts(character.creado_en, character.id)
}

function decodeCharacterCursor(value) {
  if (!value) {
    return null
  }

  try {
    const decoded = Buffer.from(String(value), 'base64url').toString('utf8')
    const [createdAt, id] = decoded.split('|')

    if (!createdAt || !id) {
      return null
    }

    const parsedDate = new Date(createdAt)

    if (Number.isNaN(parsedDate.getTime())) {
      return null
    }

    return {
      createdAt: parsedDate,
      id,
    }
  } catch {
    return null
  }
}

function buildCursorWhere(cursor) {
  if (!cursor) {
    return {}
  }

  return {
    OR: [
      {
        creado_en: {
          lt: cursor.createdAt,
        },
      },
      {
        AND: [
          {
            creado_en: cursor.createdAt,
          },
          {
            id: {
              lt: cursor.id,
            },
          },
        ],
      },
    ],
  }
}

function encodeOffsetCursor(offset) {
  return Buffer.from(`offset:${Number(offset) || 0}`).toString('base64url')
}

function decodeOffsetCursor(value) {
  if (!value) {
    return 0
  }

  try {
    const decoded = Buffer.from(String(value), 'base64url').toString('utf8')
    const match = decoded.match(/^offset:(\d+)$/)

    return match ? Number(match[1]) : 0
  } catch {
    return 0
  }
}

function buildVisibleCharacterWhere(viewerUserId, baseWhere = {}) {
  return {
    ...baseWhere,
    OR: [
      {
        propietario_usuario_id: viewerUserId,
      },
      {
        AND: [
          {
            ambito_visibilidad_codigo: {
              in: PUBLIC_VISIBILITY_CODES,
            },
          },
          {
            campanas: {
              is: {
                OR: [
                  { master_usuario_id: viewerUserId },
                  { privacidad_codigo: 'publica' },
                  {
                    campana_jugadores: {
                      some: {
                        usuario_id: viewerUserId,
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
      {
        permisos_personaje: {
          some: {
            usuario_id: viewerUserId,
            nivel_acceso_codigo: {
              in: VISIBLE_PERMISSION_CODES,
            },
          },
        },
      },
      {
        campanas: {
          is: {
            master_usuario_id: viewerUserId,
          },
        },
      },
    ],
  }
}

function getCharacterListAccessContext(character, req) {
  const isAdmin = isGlobalAdmin(req)
  const isMaster =
    isAdmin || character.campanas?.master_usuario_id === req.auth.userId
  const isPlayer = Boolean(character.campanas?.campana_jugadores?.length)
  const hasCampaignAccess =
    isMaster || isPlayer || character.campanas?.privacidad_codigo === 'publica'
  const isOwner = character.propietario_usuario_id === req.auth.userId
  const explicitPermission =
    character.permisos_personaje?.[0]?.nivel_acceso_codigo || null

  if (isMaster || isOwner) {
    return {
      canView: true,
      canEdit: true,
      viewMode: 'full',
    }
  }

  if (explicitPermission === 'full' || explicitPermission === 'completo') {
    return {
      canView: true,
      canEdit: false,
      viewMode: 'full',
    }
  }

  if (
    explicitPermission === 'preview' ||
    explicitPermission === 'vista_previa'
  ) {
    return {
      canView: true,
      canEdit: false,
      viewMode: 'preview',
    }
  }

  if (
    hasCampaignAccess &&
    character.ambito_visibilidad_codigo === 'campana_completo'
  ) {
    return {
      canView: true,
      canEdit: false,
      viewMode: 'full',
    }
  }

  if (
    hasCampaignAccess &&
    character.ambito_visibilidad_codigo === 'campana_vista_previa'
  ) {
    return {
      canView: true,
      canEdit: false,
      viewMode: 'preview',
    }
  }

  return {
    canView: false,
    canEdit: false,
    viewMode: 'none',
  }
}

async function listVisibleCharactersPage({
  req,
  baseWhere = {},
  limit = 10,
  cursor = null,
}) {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const scanBatchSize = Math.max(safeLimit * 3, 50)
  const decodedCursor = decodeCharacterCursor(cursor)
  let scanCursor = decodedCursor
  let nextCursor = null
  const items = []

  while (items.length < safeLimit) {
    const batch = await prisma.personajes.findMany({
      where: {
        ...baseWhere,
        ...buildCursorWhere(scanCursor),
      },
      orderBy: CHARACTER_LIST_ORDER_BY,
      take: scanBatchSize,
      select: getCharacterListSelect(req.auth.userId),
    })

    if (!batch.length) {
      break
    }

    for (const character of batch) {
      scanCursor = {
        createdAt: character.creado_en,
        id: character.id,
      }

      const access = getCharacterListAccessContext(character, req)

      if (!access.canView) {
        continue
      }

      items.push(serializeCharacterListItem(character, access))

      if (items.length >= safeLimit) {
        nextCursor = encodeCharacterCursorFromParts(
          scanCursor.createdAt,
          scanCursor.id
        )
        break
      }
    }

    if (items.length >= safeLimit || batch.length < scanBatchSize) {
      break
    }
  }

  return {
    items,
    nextCursor,
    hasMore: Boolean(nextCursor),
  }
}

function buildCharacterArchiveOrderBy(sort) {
  switch (CHARACTER_ARCHIVE_SORTS.has(sort) ? sort : 'created_desc') {
    case 'created_asc':
      return [{ creado_en: 'asc' }, { id: 'asc' }]
    case 'name_asc':
      return [{ nombre: 'asc' }, { id: 'asc' }]
    case 'name_desc':
      return [{ nombre: 'desc' }, { id: 'desc' }]
    case 'age_asc':
      return [{ edad: 'asc' }, { id: 'asc' }]
    case 'age_desc':
      return [{ edad: 'desc' }, { id: 'desc' }]
    case 'height_asc':
      return [{ altura_metros: 'asc' }, { id: 'asc' }]
    case 'height_desc':
      return [{ altura_metros: 'desc' }, { id: 'desc' }]
    case 'weight_asc':
      return [{ peso_kg: 'asc' }, { id: 'asc' }]
    case 'weight_desc':
      return [{ peso_kg: 'desc' }, { id: 'desc' }]
    case 'created_desc':
    default:
      return CHARACTER_LIST_ORDER_BY
  }
}

async function findCharacterIdsByNameSearch(query) {
  const term = normalizeSearchTerm(query)

  if (!term) {
    return null
  }

  const escapedTerm = escapeLikeTerm(term)
  const prefixOnly = term.length < 3
  const { rows } = await pool.query(
    `
      SELECT id::text
      FROM personajes
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

function buildRangeCondition(field, min, max) {
  if (min === null && max === null) {
    return null
  }

  return {
    AND: [
      {
        [field]: {
          not: null,
        },
      },
      {
        [field]: {
          ...(min !== null ? { gte: min } : {}),
          ...(max !== null ? { lte: max } : {}),
        },
      },
    ],
  }
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

function buildCharacterCampaignFilterCondition(filters) {
  const { campaignIds, includeUnscoped, hasNoSelection } =
    splitCampaignFilterValues(filters.campaignIds)

  if (hasNoSelection) {
    return { id: { in: [] } }
  }

  const conditions = []

  if (campaignIds.length) {
    conditions.push(
      ...campaignIds.map((campaignId) => ({ campana_id: campaignId }))
    )
  }

  if (conditions.length === 1) {
    return conditions[0]
  }

  if (conditions.length) {
    return { OR: conditions }
  }

  return includeUnscoped ? { id: { in: [] } } : null
}

function buildCharacterArchiveFilterConditions(filters) {
  const conditions = []

  const categoryIds = getUniqueFilterValues(filters.categoryIds)
  const tierIds = getUniqueFilterValues(filters.tierIds)
  const estadoCodigos = getUniqueFilterValues(filters.estadoCodigos)

  if (categoryIds.length) {
    conditions.push(
      ...categoryIds.map((categoryId) => ({
        asignaciones_categoria_personaje: {
          some: {
            categoria_id: categoryId,
          },
        },
      }))
    )
  }

  if (tierIds.length && filters.view !== 'tierlist') {
    conditions.push(...tierIds.map((tierId) => ({ tier_id: tierId })))
  }

  if (estadoCodigos.length) {
    conditions.push(
      ...estadoCodigos.map((estadoCodigo) => ({
        estados_personaje: {
          is: {
            codigo: estadoCodigo,
          },
        },
      }))
    )
  }

  const ageRange = buildRangeCondition('edad', filters.ageMin, filters.ageMax)
  const heightRange = buildRangeCondition(
    'altura_metros',
    filters.heightMin,
    filters.heightMax
  )
  const weightRange = buildRangeCondition(
    'peso_kg',
    filters.weightMin,
    filters.weightMax
  )

  if (ageRange) {
    conditions.push(ageRange)
  }

  if (heightRange) {
    conditions.push(heightRange)
  }

  if (weightRange) {
    conditions.push(weightRange)
  }

  return conditions
}

async function buildCharacterArchiveWhere(req, filters) {
  const baseConditions = []

  if (filters.view === 'bestiary') {
    baseConditions.push({ es_criatura: true })
  } else if (filters.view === 'tierlist') {
    baseConditions.push({ tier_id: { not: null } })
  } else {
    baseConditions.push({ es_criatura: false })
  }

  const matchingIds = await findCharacterIdsByNameSearch(filters.q)

  if (matchingIds) {
    baseConditions.push({ id: { in: matchingIds } })
  }

  const campaignCondition = buildCharacterCampaignFilterCondition(filters)

  if (campaignCondition) {
    baseConditions.push(campaignCondition)
  }

  const filterConditions = buildCharacterArchiveFilterConditions(filters)

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

  if (isGlobalAdmin(req)) {
    return baseWhere
  }

  return buildVisibleCharacterWhere(req.auth.userId, baseWhere)
}

async function listCharacterArchivePage({
  req,
  filters,
  limit = 30,
  cursor = null,
}) {
  const safeLimit = Math.max(1, Math.min(limit, 500))
  const offset = decodeOffsetCursor(cursor)
  const where = await buildCharacterArchiveWhere(req, filters)
  const [totalVisible, characters] = await Promise.all([
    prisma.personajes.count({ where }),
    prisma.personajes.findMany({
      where,
      orderBy: buildCharacterArchiveOrderBy(filters.sort),
      skip: offset,
      take: safeLimit,
      select: getCharacterListSelect(req.auth.userId),
    }),
  ])

  const items = characters
    .map((character) => {
      const access = getCharacterListAccessContext(character, req)

      return access.canView
        ? serializeCharacterListItem(character, access)
        : null
    })
    .filter(Boolean)
  const nextOffset = offset + characters.length

  return {
    items,
    nextCursor:
      nextOffset < totalVisible ? encodeOffsetCursor(nextOffset) : null,
    hasMore: nextOffset < totalVisible,
    totalVisible,
  }
}

async function getCharacterArchiveMetadata() {
  const [categories, tiers, states] = await Promise.all([
    prisma.categorias_personaje.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        campana_origen_id: true,
        es_relevante_para_campana_origen: true,
      },
    }),
    prisma.tiers_personaje.findMany({
      orderBy: [{ orden_visualizacion: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        orden_visualizacion: true,
      },
    }),
    prisma.estados_personaje.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        codigo: true,
        nombre: true,
      },
    }),
  ])

  return {
    categorias: categories.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      campanaOrigenId: item.campana_origen_id,
      esRelevanteParaCampanaOrigen: item.es_relevante_para_campana_origen,
    })),
    tiers: tiers.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      ordenVisualizacion: item.orden_visualizacion,
    })),
    estados: states.map((item) => ({
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
    })),
  }
}

module.exports = {
  buildVisibleCharacterWhere,
  CHARACTER_LIST_ORDER_BY,
  decodeCharacterCursor,
  encodeCharacterCursor,
  getCharacterArchiveMetadata,
  getCharacterListSelect,
  listCharacterArchivePage,
  listVisibleCharactersPage,
  serializeCharacterListItem,
}
