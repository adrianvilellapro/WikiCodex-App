const { pool, prisma } = require('../lib/prisma')
const { createHttpError } = require('../lib/errors')
const { serializeVisibleUser } = require('../lib/user-visibility')
const { getCampaignRoleContext } = require('./campaign-access.service')
const {
  assertManagedImageUrl,
  cleanupCloudinaryAssets,
} = require('../lib/media')
const {
  notifyMastersOfCampaignEntryCreated,
} = require('./notification.service')

const PLACE_TYPES = [
  'Mundo',
  'Planeta',
  'Continente',
  'Pais',
  'Region',
  'Ciudad',
  'Emplazamiento',
]
const PLACE_TYPE_RANK = new Map(
  PLACE_TYPES.map((name, index) => [name.toLowerCase(), index + 1])
)

const PLACE_VISIBILITY_CODES = [
  'privado',
  'usuarios_seleccionados',
  'campana_vista_previa',
  'campana_completo',
]
const VISIBLE_PERMISSION_CODES = ['full', 'completo', 'preview', 'vista_previa']
const HIDDEN_PERMISSION_CODES = ['hidden', 'oculto', 'sin_acceso']
const PLACE_ARCHIVE_SORTS = new Set([
  'created_desc',
  'created_asc',
  'name_asc',
  'name_desc',
  'type_asc',
  'type_desc',
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

async function ensurePlaceTypeCatalog() {
  for (const [index, name] of PLACE_TYPES.entries()) {
    const existing = await prisma.tipos_lugar.findFirst({
      where: { nombre: name },
      select: { id: true },
    })

    if (existing) {
      await prisma.tipos_lugar.update({
        where: { id: existing.id },
        data: { orden_visualizacion: index + 1 },
      })
      continue
    }

    await prisma.tipos_lugar.create({
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

function getPlaceInclude(userId) {
  return {
    tipos_lugar: {
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
    lugar_campanas: {
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
    lugar_imagenes: {
      orderBy: [{ orden_visualizacion: 'asc' }, { creado_en: 'asc' }],
      select: {
        id: true,
        imagen_url: true,
        titulo: true,
        orden_visualizacion: true,
      },
    },
    permisos_lugar: {
      where: { usuario_id: userId },
      select: { nivel_acceso_codigo: true },
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
    lugar_padre: {
      select: { id: true, nombre: true },
    },
    lugares_hijos: {
      orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
      take: 12,
      select: {
        id: true,
        nombre: true,
        imagen_url: true,
        ambito_visibilidad_codigo: true,
        tipos_lugar: {
          select: { id: true, nombre: true, orden_visualizacion: true },
        },
      },
    },
  }
}

function buildVisiblePlaceWhere(userId) {
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
                lugar_campanas: {
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
                AND: [{ campana_id: null }, { lugar_campanas: { none: {} } }],
              },
            ],
          },
        ],
      },
      {
        permisos_lugar: {
          some: {
            usuario_id: userId,
            nivel_acceso_codigo: { in: VISIBLE_PERMISSION_CODES },
          },
        },
      },
      {
        lugar_campanas: {
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

function getPlaceAccessContext(place, req) {
  const linkedCampaigns = place.lugar_campanas?.length
    ? place.lugar_campanas.map((item) => item.campanas).filter(Boolean)
    : place.campanas
      ? [place.campanas]
      : []
  const campaignContexts = linkedCampaigns.map((campaign) =>
    getCampaignRoleContext(campaign, req)
  )
  const isAdmin = req.auth.roleCode === 'administrador'
  const isCreator = place.creado_por_usuario_id === req.auth.userId
  const isMaster = isAdmin || campaignContexts.some((item) => item.isMaster)
  const hasCampaignAccess =
    isAdmin ||
    linkedCampaigns.length === 0 ||
    campaignContexts.some((item) => item.canRead)
  const explicitPermission =
    place.permisos_lugar?.[0]?.nivel_acceso_codigo || null
  const isPublicPreview =
    place.ambito_visibilidad_codigo === 'campana_vista_previa'
  const isPublicFull = place.ambito_visibilidad_codigo === 'campana_completo'

  if (isCreator || isMaster) {
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

  if (hasCampaignAccess && isPublicFull) {
    return { canView: true, canEdit: false, viewMode: 'full' }
  }

  if (hasCampaignAccess && isPublicPreview) {
    return { canView: true, canEdit: false, viewMode: 'preview' }
  }

  return { canView: false, canEdit: false, viewMode: 'none' }
}

async function getPlaceWithContext(placeId, userId) {
  return prisma.lugares.findUnique({
    where: { id: placeId },
    include: getPlaceInclude(userId),
  })
}

async function getOwnedPlaceDescendantIds(placeId, userId) {
  if (!placeId) {
    return new Set()
  }

  const places = await prisma.lugares.findMany({
    where: { creado_por_usuario_id: userId },
    select: { id: true, lugar_padre_id: true },
  })
  const childrenByParent = new Map()

  for (const place of places) {
    if (!place.lugar_padre_id) {
      continue
    }

    const children = childrenByParent.get(place.lugar_padre_id) || []
    children.push(place.id)
    childrenByParent.set(place.lugar_padre_id, children)
  }

  const descendants = new Set()
  const pending = [...(childrenByParent.get(placeId) || [])]

  while (pending.length) {
    const currentId = pending.shift()

    if (descendants.has(currentId)) {
      continue
    }

    descendants.add(currentId)
    pending.push(...(childrenByParent.get(currentId) || []))
  }

  return descendants
}

function getPlaceTypeRank(type) {
  return PLACE_TYPE_RANK.get(String(type?.nombre || '').toLowerCase()) || null
}

function isValidContainment(parentPlace, childTypeId, types) {
  if (!parentPlace || !childTypeId) {
    return true
  }

  const parentRank = getPlaceTypeRank(parentPlace.tipos_lugar)
  const childType = types.find((type) => type.id === childTypeId)
  const childRank = getPlaceTypeRank(childType)

  if (!parentRank || !childRank) {
    return true
  }

  return parentRank <= childRank
}

async function requirePlaceViewAccess(placeId, req) {
  const place = await getPlaceWithContext(placeId, req.auth.userId)

  if (!place) {
    throw createHttpError(404, 'El lugar indicado no existe.')
  }

  const access = getPlaceAccessContext(place, req)

  if (!access.canView) {
    throw createHttpError(403, 'No tienes permiso para ver este lugar.')
  }

  return { place, access }
}

async function requirePlaceEditAccess(placeId, req) {
  const context = await requirePlaceViewAccess(placeId, req)

  if (!context.access.canEdit) {
    throw createHttpError(403, 'No tienes permiso para editar este lugar.')
  }

  return context
}

function serializeCampaigns(place) {
  const linked = place.lugar_campanas?.length
    ? place.lugar_campanas.map((item) => item.campanas).filter(Boolean)
    : place.campanas
      ? [place.campanas]
      : []

  return linked.map((campaign) => ({
    id: campaign.id,
    nombre: campaign.nombre,
  }))
}

function serializePlaceListItem(place, access) {
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
    lugarBaseId: place.lugar_base_id,
    lugarPadreId: place.lugar_padre_id,
    esVersion: Boolean(place.lugar_base_id),
    ambitoVisibilidadCodigo: place.ambito_visibilidad_codigo,
    modoVista: access.viewMode,
    puedeEditar: access.canEdit,
    puedeBorrar: access.canEdit,
    creadoEn: place.creado_en,
    actualizadoEn: place.actualizado_en,
  }
}

function serializePlace(place, access) {
  const listItem = serializePlaceListItem(place, access)
  const previewOnly = access.viewMode === 'preview'

  return {
    ...listItem,
    descripcion: previewOnly ? place.descripcion : place.descripcion,
    campanas: serializeCampaigns(place),
    creadoPor: serializeVisibleUser(place.usuarios),
    lugarPadre: place.lugar_padre
      ? {
          id: place.lugar_padre.id,
          nombre: place.lugar_padre.nombre,
        }
      : null,
    lugaresHijos: (place.lugares_hijos || []).map((child) => ({
      id: child.id,
      nombre: child.nombre,
      imagenPrincipalUrl: child.imagen_url,
      tipo: child.tipos_lugar
        ? {
            id: child.tipos_lugar.id,
            nombre: child.tipos_lugar.nombre,
            ordenVisualizacion: child.tipos_lugar.orden_visualizacion,
          }
        : null,
    })),
    galeria: previewOnly
      ? []
      : (place.lugar_imagenes || []).map((image) => ({
          id: image.id,
          imagenUrl: image.imagen_url,
          titulo: image.titulo,
          ordenVisualizacion: image.orden_visualizacion,
        })),
  }
}

function serializeEditorPlaceOption(
  place,
  disabledIds = new Set(),
  types = []
) {
  const typeRank = getPlaceTypeRank(place.tipos_lugar)

  return {
    id: place.id,
    nombre: place.nombre,
    descripcion: place.descripcion,
    imagenPrincipalUrl: place.imagen_url,
    tipoLugarId: place.tipo_lugar_id,
    tipo: place.tipos_lugar
      ? {
          id: place.tipos_lugar.id,
          nombre: place.tipos_lugar.nombre,
          ordenVisualizacion: place.tipos_lugar.orden_visualizacion,
          rank: typeRank,
        }
      : null,
    lugarBaseId: place.lugar_base_id,
    lugarPadreId: place.lugar_padre_id,
    disabledAsVersion: disabledIds.has(place.id),
    disabledReason: disabledIds.has(place.id)
      ? 'Este lugar esta contenido dentro del lugar actual.'
      : '',
    typeRank:
      typeRank ||
      getPlaceTypeRank(types.find((type) => type.id === place.tipo_lugar_id)),
  }
}

async function assertCampaignsAreUsable(campaignIds = [], req) {
  const uniqueIds = [...new Set((campaignIds || []).filter(Boolean))]

  if (!uniqueIds.length) {
    return []
  }

  const campaigns = await prisma.campanas.findMany({
    where: {
      id: { in: uniqueIds },
      OR: [
        { master_usuario_id: req.auth.userId },
        { campana_jugadores: { some: { usuario_id: req.auth.userId } } },
      ],
    },
    select: { id: true },
  })
  const allowedIds = campaigns.map((campaign) => campaign.id)

  if (
    allowedIds.length !== uniqueIds.length &&
    req.auth.roleCode !== 'administrador'
  ) {
    throw createHttpError(
      403,
      'No puedes vincular el lugar a alguna de esas campañas.'
    )
  }

  return uniqueIds
}

async function getPlaceEditorMetadata({ placeId = null, req }) {
  await ensurePlaceTypeCatalog()

  const context = placeId ? await requirePlaceEditAccess(placeId, req) : null
  const campaignIds = context?.place?.lugar_campanas?.length
    ? context.place.lugar_campanas.map((item) => item.campana_id)
    : [context?.place?.campana_id].filter(Boolean)

  const [users, campaigns, types, accessLevels, ownPlaces] = await Promise.all([
    prisma.usuarios.findMany({
      where: { roles: { codigo: { not: 'administrador' } } },
      orderBy: { nombre_usuario: 'asc' },
      include: { roles: { select: { codigo: true, nombre: true } } },
    }),
    prisma.campanas.findMany({
      where: {
        OR: [
          { master_usuario_id: req.auth.userId },
          { campana_jugadores: { some: { usuario_id: req.auth.userId } } },
        ],
      },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    prisma.tipos_lugar.findMany({
      orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, orden_visualizacion: true },
    }),
    prisma.niveles_acceso.findMany({
      orderBy: { nombre: 'asc' },
      select: { codigo: true, nombre: true },
    }),
    prisma.lugares.findMany({
      where: {
        creado_por_usuario_id: req.auth.userId,
        ...(placeId ? { id: { not: placeId } } : {}),
      },
      orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
      take: 5,
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        imagen_url: true,
        tipo_lugar_id: true,
        lugar_base_id: true,
        lugar_padre_id: true,
        tipos_lugar: {
          select: { id: true, nombre: true, orden_visualizacion: true },
        },
      },
    }),
  ])
  const disabledVersionIds = await getOwnedPlaceDescendantIds(
    placeId,
    req.auth.userId
  )
  const currentPermissions = context
    ? await prisma.permisos_lugar.findMany({
        where: { lugar_id: context.place.id },
        select: {
          usuario_id: true,
          nivel_acceso_codigo: true,
        },
      })
    : []

  return {
    item: context ? serializePlace(context.place, context.access) : null,
    metadata: {
      users: users.map((user) => ({
        id: user.id,
        nombreUsuario: user.nombre_usuario,
        rol: user.roles
          ? { codigo: user.roles.codigo, nombre: user.roles.nombre }
          : null,
      })),
      campaigns,
      campaignIds,
      types: types.map((type) => ({
        id: type.id,
        nombre: type.nombre,
        ordenVisualizacion: type.orden_visualizacion,
      })),
      accessLevels,
      currentPermissions: currentPermissions.map((permission) => ({
        usuarioId: permission.usuario_id,
        nivelAccesoCodigo:
          permission.nivel_acceso_codigo === 'completo'
            ? 'full'
            : permission.nivel_acceso_codigo === 'vista_previa'
              ? 'preview'
              : permission.nivel_acceso_codigo,
      })),
      ownPlaces: ownPlaces.map((place) =>
        serializeEditorPlaceOption(place, disabledVersionIds, types)
      ),
    },
  }
}

async function listOwnPlacesForEditor({
  req,
  limit = 5,
  cursor = 0,
  search = '',
  excludePlaceId = null,
}) {
  await ensurePlaceTypeCatalog()

  const safeLimit = Math.max(1, Math.min(limit, 100))
  const safeCursor = Math.max(0, cursor || 0)
  const normalizedSearch = String(search || '').trim()
  const types = await prisma.tipos_lugar.findMany({
    orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, orden_visualizacion: true },
  })
  const where = {
    creado_por_usuario_id: req.auth.userId,
    ...(excludePlaceId ? { id: { not: excludePlaceId } } : {}),
    ...(normalizedSearch
      ? {
          OR: [
            {
              nombre: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
            {
              descripcion: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  }
  const [totalVisible, places, disabledVersionIds] = await Promise.all([
    prisma.lugares.count({ where }),
    prisma.lugares.findMany({
      where,
      orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
      skip: safeCursor,
      take: safeLimit,
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        imagen_url: true,
        tipo_lugar_id: true,
        lugar_base_id: true,
        lugar_padre_id: true,
        tipos_lugar: {
          select: { id: true, nombre: true, orden_visualizacion: true },
        },
      },
    }),
    getOwnedPlaceDescendantIds(excludePlaceId, req.auth.userId),
  ])

  return {
    items: places.map((place) =>
      serializeEditorPlaceOption(place, disabledVersionIds, types)
    ),
    meta: {
      totalVisible,
      limit: safeLimit,
      cursor: safeCursor,
      nextCursor:
        safeCursor + places.length < totalVisible
          ? safeCursor + places.length
          : null,
    },
  }
}

async function listOwnPlaceTreesForEditor({
  req,
  limit = 4,
  cursor = 0,
  search = '',
  placeId = null,
}) {
  await ensurePlaceTypeCatalog()

  const safeLimit = Math.max(1, Math.min(limit, 50))
  const safeCursor = Math.max(0, cursor || 0)
  const normalizedSearch = String(search || '')
    .trim()
    .toLowerCase()
  const [places, disabledDescendantIds] = await Promise.all([
    prisma.lugares.findMany({
      where: { creado_por_usuario_id: req.auth.userId },
      orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        imagen_url: true,
        tipo_lugar_id: true,
        lugar_base_id: true,
        lugar_padre_id: true,
        creado_en: true,
        actualizado_en: true,
        tipos_lugar: {
          select: { id: true, nombre: true, orden_visualizacion: true },
        },
      },
    }),
    getOwnedPlaceDescendantIds(placeId, req.auth.userId),
  ])
  const placeById = new Map(places.map((place) => [place.id, place]))
  const childrenByParent = new Map()

  for (const place of places) {
    if (!place.lugar_padre_id || !placeById.has(place.lugar_padre_id)) {
      continue
    }

    const children = childrenByParent.get(place.lugar_padre_id) || []
    children.push(place.id)
    childrenByParent.set(place.lugar_padre_id, children)
  }

  function getRoot(place) {
    let current = place
    const seen = new Set()

    while (
      current?.lugar_padre_id &&
      placeById.has(current.lugar_padre_id) &&
      !seen.has(current.lugar_padre_id)
    ) {
      seen.add(current.id)
      current = placeById.get(current.lugar_padre_id)
    }

    return current
  }

  function collectTree(rootId) {
    const ids = []
    const pending = [rootId]

    while (pending.length) {
      const currentId = pending.shift()

      if (ids.includes(currentId)) {
        continue
      }

      ids.push(currentId)
      pending.push(...(childrenByParent.get(currentId) || []))
    }

    return ids
  }

  const rootsById = new Map()

  for (const place of places) {
    const root = getRoot(place)

    if (root) {
      rootsById.set(root.id, root)
    }
  }

  const disabledIds = new Set(
    [...disabledDescendantIds, placeId].filter(Boolean)
  )
  const trees = [...rootsById.values()]
    .map((root) => {
      const treeIds = collectTree(root.id)
      const treePlaces = treeIds.map((id) => placeById.get(id)).filter(Boolean)
      const searchText = treePlaces
        .map((place) => `${place.nombre || ''} ${place.descripcion || ''}`)
        .join(' ')
        .toLowerCase()

      return {
        id: root.id,
        root: {
          ...serializeEditorPlaceOption(root, disabledIds),
          disabledAsContainer: disabledIds.has(root.id),
          disabledReason: disabledIds.has(root.id)
            ? 'No puedes elegir este nodo para evitar ciclos.'
            : '',
        },
        totalPlaces: treePlaces.length,
        matchesSearch: normalizedSearch
          ? searchText.includes(normalizedSearch)
          : true,
        latestUpdate: treePlaces
          .map((place) => place.actualizado_en || place.creado_en)
          .sort((a, b) => b - a)[0],
        nodes: treePlaces.map((place) => ({
          ...serializeEditorPlaceOption(place, disabledIds),
          disabledAsContainer: disabledIds.has(place.id),
          disabledReason: disabledIds.has(place.id)
            ? 'No puedes elegir este nodo para evitar ciclos.'
            : '',
          typeRank: getPlaceTypeRank(place.tipos_lugar),
        })),
      }
    })
    .filter((tree) => tree.totalPlaces > 1 || !placeId || tree.id !== placeId)
    .filter((tree) => tree.matchesSearch)
    .sort((a, b) => {
      if (b.totalPlaces !== a.totalPlaces) {
        return b.totalPlaces - a.totalPlaces
      }

      return new Date(b.latestUpdate || 0) - new Date(a.latestUpdate || 0)
    })

  const pageTrees = trees.slice(safeCursor, safeCursor + safeLimit)

  return {
    items: pageTrees,
    meta: {
      totalVisible: trees.length,
      limit: safeLimit,
      cursor: safeCursor,
      nextCursor:
        safeCursor + pageTrees.length < trees.length
          ? safeCursor + pageTrees.length
          : null,
    },
  }
}

async function getVisiblePlaceGraph({ placeId = null, req }) {
  const places = await prisma.lugares.findMany({
    orderBy: [{ creado_en: 'asc' }, { nombre: 'asc' }],
    include: getPlaceInclude(req.auth.userId),
  })
  const accessById = new Map()
  const placeById = new Map()
  const childrenByParent = new Map()

  for (const place of places) {
    placeById.set(place.id, place)
    accessById.set(place.id, getPlaceAccessContext(place, req))

    if (!place.lugar_padre_id) {
      continue
    }

    const children = childrenByParent.get(place.lugar_padre_id) || []
    children.push(place.id)
    childrenByParent.set(place.lugar_padre_id, children)
  }

  const scopedIds = new Set()

  if (placeId && placeById.has(placeId)) {
    const adjacency = new Map()

    for (const place of places) {
      if (!adjacency.has(place.id)) {
        adjacency.set(place.id, new Set())
      }

      if (place.lugar_padre_id && placeById.has(place.lugar_padre_id)) {
        if (!adjacency.has(place.lugar_padre_id)) {
          adjacency.set(place.lugar_padre_id, new Set())
        }

        adjacency.get(place.id).add(place.lugar_padre_id)
        adjacency.get(place.lugar_padre_id).add(place.id)
      }
    }

    const pending = [placeId]

    while (pending.length) {
      const currentId = pending.shift()

      if (scopedIds.has(currentId)) {
        continue
      }

      scopedIds.add(currentId)
      pending.push(...(adjacency.get(currentId) || []))
    }
  } else {
    for (const place of places) {
      scopedIds.add(place.id)
    }
  }

  if (placeId && scopedIds.size <= 1) {
    return {
      currentId: placeId,
      nodes: [],
      edges: [],
    }
  }

  const scopedPlaces = places.filter((place) => scopedIds.has(place.id))

  const visibleIds = new Set(
    scopedPlaces
      .filter((place) => accessById.get(place.id)?.canView)
      .map((place) => place.id)
  )
  const hasVisibleAncestorCache = new Map()
  const hasVisibleDescendantCache = new Map()

  function hasVisibleAncestor(place) {
    if (!place?.lugar_padre_id) {
      return false
    }

    if (hasVisibleAncestorCache.has(place.id)) {
      return hasVisibleAncestorCache.get(place.id)
    }

    const parent = placeById.get(place.lugar_padre_id)
    const result =
      Boolean(parent) &&
      (visibleIds.has(parent.id) || hasVisibleAncestor(parent))

    hasVisibleAncestorCache.set(place.id, result)
    return result
  }

  function hasVisibleDescendant(place) {
    if (hasVisibleDescendantCache.has(place.id)) {
      return hasVisibleDescendantCache.get(place.id)
    }

    const children = childrenByParent.get(place.id) || []
    const result = children.some((childId) => {
      const child = placeById.get(childId)
      return child && (visibleIds.has(child.id) || hasVisibleDescendant(child))
    })

    hasVisibleDescendantCache.set(place.id, result)
    return result
  }

  const bridgeIds = new Set(
    scopedPlaces
      .filter(
        (place) =>
          !visibleIds.has(place.id) &&
          hasVisibleAncestor(place) &&
          hasVisibleDescendant(place)
      )
      .map((place) => place.id)
  )
  const graphIds = new Set([...visibleIds, ...bridgeIds])

  if (placeId && graphIds.size <= 1) {
    return {
      currentId: placeId,
      nodes: [],
      edges: [],
    }
  }

  return {
    currentId: placeId,
    nodes: scopedPlaces
      .filter((place) => graphIds.has(place.id))
      .map((place) => {
        const isBridge = bridgeIds.has(place.id)

        if (isBridge) {
          return {
            id: place.id,
            nombre: 'Lugar privado',
            descripcion: null,
            imagenPrincipalUrl: null,
            tipo: {
              id: `private-${place.id}`,
              nombre: 'Privado',
              ordenVisualizacion: 999,
            },
            lugarBaseId: null,
            lugarPadreId: place.lugar_padre_id,
            esVersion: false,
            ambitoVisibilidadCodigo: 'privado',
            modoVista: 'private_bridge',
            creadoEn: place.creado_en,
            actualizadoEn: place.actualizado_en,
            typeRank: getPlaceTypeRank(place.tipos_lugar),
            esNodoPrivado: true,
          }
        }

        return {
          ...serializePlaceListItem(place, accessById.get(place.id)),
          typeRank: getPlaceTypeRank(place.tipos_lugar),
          esNodoPrivado: false,
        }
      }),
    edges: scopedPlaces
      .filter((place) => place.lugar_padre_id && graphIds.has(place.id))
      .filter((place) => graphIds.has(place.lugar_padre_id))
      .map((place) => ({
        from: place.lugar_padre_id,
        to: place.id,
      })),
  }
}

async function savePlaceDraft({ placeId = null, req, payload }) {
  await ensurePlaceTypeCatalog()

  const core = payload.core || {}
  const name = String(core.nombre || '').trim()

  if (!name) {
    throw createHttpError(400, 'El nombre del lugar no puede quedar vacío.')
  }

  if (core.imagenPrincipalUrl) {
    await assertManagedImageUrl(core.imagenPrincipalUrl, {
      entityLabel: 'La imagen del lugar',
    })
  }

  for (const image of payload.galeria || []) {
    await assertManagedImageUrl(image.imagenUrl, {
      entityLabel: 'La imagen de galería del lugar',
    })
  }

  const campaignIds = await assertCampaignsAreUsable(core.campanaIds, req)
  const primaryCampaignId = campaignIds[0] || null
  const privacy = normalizePrivacyInput(payload.privacidad)
  let previousImageUrl = null
  let previousGalleryUrls = []

  if (placeId) {
    const context = await requirePlaceEditAccess(placeId, req)
    previousImageUrl = context.place.imagen_url
    previousGalleryUrls = (context.place.lugar_imagenes || []).map(
      (image) => image.imagen_url
    )
  }

  const types = await prisma.tipos_lugar.findMany({
    orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, orden_visualizacion: true },
  })
  const descendantIds = await getOwnedPlaceDescendantIds(
    placeId,
    req.auth.userId
  )

  if (
    placeId &&
    (core.lugarBaseId === placeId || core.lugarPadreId === placeId)
  ) {
    throw createHttpError(400, 'Un lugar no puede enlazarse consigo mismo.')
  }

  if (core.lugarBaseId && descendantIds.has(core.lugarBaseId)) {
    throw createHttpError(
      400,
      'Un lugar no puede ser versión de un lugar contenido dentro de él.'
    )
  }

  if (core.lugarPadreId) {
    const parentPlace = await prisma.lugares.findFirst({
      where: {
        id: core.lugarPadreId,
        creado_por_usuario_id: req.auth.userId,
      },
      include: {
        tipos_lugar: {
          select: { id: true, nombre: true, orden_visualizacion: true },
        },
      },
    })

    if (!parentPlace) {
      throw createHttpError(
        400,
        'El lugar contenedor debe pertenecer a tu usuario.'
      )
    }

    if (descendantIds.has(parentPlace.id)) {
      throw createHttpError(
        400,
        'No puedes contener un lugar dentro de uno de sus propios descendientes.'
      )
    }

    if (!isValidContainment(parentPlace, core.tipoLugarId, types)) {
      throw createHttpError(
        400,
        'Un lugar solo puede contener lugares del mismo nivel o de niveles inferiores.'
      )
    }
  }

  const savedPlace = await prisma.$transaction(async (tx) => {
    const data = {
      campana_id: primaryCampaignId,
      tipo_lugar_id: core.tipoLugarId || null,
      lugar_base_id: core.lugarBaseId || null,
      lugar_padre_id: core.lugarPadreId || null,
      ambito_visibilidad_codigo: privacy.visibilityCode,
      nombre: name,
      descripcion: core.descripcion || null,
      imagen_url: core.imagenPrincipalUrl || null,
      actualizado_en: new Date(),
    }
    const place = placeId
      ? await tx.lugares.update({ where: { id: placeId }, data })
      : await tx.lugares.create({
          data: {
            ...data,
            creado_por_usuario_id: req.auth.userId,
          },
        })

    await tx.lugar_campanas.deleteMany({ where: { lugar_id: place.id } })

    if (campaignIds.length) {
      await tx.lugar_campanas.createMany({
        data: campaignIds.map((campaignId) => ({
          lugar_id: place.id,
          campana_id: campaignId,
        })),
        skipDuplicates: true,
      })
    }

    await tx.permisos_lugar.deleteMany({ where: { lugar_id: place.id } })

    if (privacy.explicitPermissions.length) {
      await tx.permisos_lugar.createMany({
        data: privacy.explicitPermissions.map((permission) => ({
          lugar_id: place.id,
          usuario_id: permission.usuarioId,
          nivel_acceso_codigo: permission.nivelAccesoCodigo,
          otorgado_por_usuario_id: req.auth.userId,
        })),
        skipDuplicates: true,
      })
    }

    await tx.lugar_imagenes.deleteMany({ where: { lugar_id: place.id } })

    if (payload.galeria?.length) {
      await tx.lugar_imagenes.createMany({
        data: payload.galeria.map((image, index) => ({
          lugar_id: place.id,
          imagen_url: image.imagenUrl,
          titulo: image.titulo || null,
          orden_visualizacion: index,
        })),
      })
    }

    return place
  })

  const nextGalleryUrls = (payload.galeria || []).map(
    (image) => image.imagenUrl
  )
  const removedGalleryUrls = previousGalleryUrls.filter(
    (url) => !nextGalleryUrls.includes(url)
  )

  if (
    placeId &&
    previousImageUrl &&
    previousImageUrl !== (core.imagenPrincipalUrl || null)
  ) {
    await cleanupCloudinaryAssets([previousImageUrl])
  }

  if (removedGalleryUrls.length) {
    await cleanupCloudinaryAssets(removedGalleryUrls)
  }

  const context = await requirePlaceViewAccess(savedPlace.id, req)
  const serialized = serializePlace(context.place, context.access)

  if (!placeId) {
    await notifyMastersOfCampaignEntryCreated({
      entityType: 'place',
      entityId: savedPlace.id,
      entityName: name,
      campaignIds,
      actorUsuarioId: req.auth.userId,
    }).catch((error) => {
      console.warn('No se pudo crear la notificación del lugar:', error)
    })
  }

  return serialized
}

function parsePlaceOffsetCursor(cursor) {
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

function buildPlaceCampaignFilterCondition(filters) {
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
          { lugar_campanas: { some: { campana_id: campaignId } } },
        ],
      }))
    )
  }

  if (includeUnscoped) {
    conditions.push({
      AND: [{ campana_id: null }, { lugar_campanas: { none: {} } }],
    })
  }

  if (conditions.length === 1) {
    return conditions[0]
  }

  return conditions.length ? { OR: conditions } : null
}

function buildPlaceArchiveOrderBy(sort) {
  switch (PLACE_ARCHIVE_SORTS.has(sort) ? sort : 'created_desc') {
    case 'created_asc':
      return [{ creado_en: 'asc' }, { id: 'asc' }]
    case 'name_asc':
      return [{ nombre: 'asc' }, { id: 'asc' }]
    case 'name_desc':
      return [{ nombre: 'desc' }, { id: 'desc' }]
    case 'type_asc':
      return [
        { tipos_lugar: { orden_visualizacion: 'asc' } },
        { nombre: 'asc' },
        { id: 'asc' },
      ]
    case 'type_desc':
      return [
        { tipos_lugar: { orden_visualizacion: 'desc' } },
        { nombre: 'asc' },
        { id: 'asc' },
      ]
    case 'created_desc':
    default:
      return [{ creado_en: 'desc' }, { id: 'desc' }]
  }
}

async function findPlaceIdsByNameSearch(query) {
  const term = normalizeSearchTerm(query)

  if (!term) {
    return null
  }

  const escapedTerm = escapeLikeTerm(term)
  const prefixOnly = term.length < 3
  const { rows } = await pool.query(
    `
      SELECT id::text
      FROM lugares
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

function buildPlaceArchiveFilterConditions(filters) {
  const conditions = []
  const typeIds = getUniqueFilterValues(filters.tipoLugarIds)

  if (typeIds.length) {
    conditions.push(...typeIds.map((typeId) => ({ tipo_lugar_id: typeId })))
  }

  return conditions
}

async function buildPlaceArchiveWhere(req, filters) {
  const baseConditions = []
  const matchingIds = await findPlaceIdsByNameSearch(filters.q)

  if (matchingIds) {
    baseConditions.push({ id: { in: matchingIds } })
  }

  const campaignCondition = buildPlaceCampaignFilterCondition(filters)

  if (campaignCondition) {
    baseConditions.push(campaignCondition)
  }

  const filterConditions = buildPlaceArchiveFilterConditions(filters)

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
      : buildVisiblePlaceWhere(req.auth.userId)

  if (Object.keys(archiveWhere).length && Object.keys(visibilityWhere).length) {
    return { AND: [archiveWhere, visibilityWhere] }
  }

  return Object.keys(archiveWhere).length ? archiveWhere : visibilityWhere
}

async function listPlaceArchivePage({ req, filters, limit = 30, cursor = 0 }) {
  await ensurePlaceTypeCatalog()

  const safeLimit = Math.max(1, Math.min(limit, 500))
  const safeCursor = parsePlaceOffsetCursor(cursor)
  const where = await buildPlaceArchiveWhere(req, filters)
  const [totalVisible, places] = await Promise.all([
    prisma.lugares.count({ where }),
    prisma.lugares.findMany({
      where,
      orderBy: buildPlaceArchiveOrderBy(filters.sort),
      skip: safeCursor,
      take: safeLimit,
      include: getPlaceInclude(req.auth.userId),
    }),
  ])
  const items = places
    .map((place) => {
      const access = getPlaceAccessContext(place, req)
      return access.canView ? serializePlaceListItem(place, access) : null
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
        safeCursor + places.length < totalVisible
          ? String(safeCursor + places.length)
          : null,
      hasMore: safeCursor + places.length < totalVisible,
    },
  }
}

async function getPlaceArchiveMetadata() {
  await ensurePlaceTypeCatalog()

  const types = await prisma.tipos_lugar.findMany({
    orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      orden_visualizacion: true,
    },
  })

  return {
    tiposLugar: types.map((type) => ({
      id: type.id,
      nombre: type.nombre,
      ordenVisualizacion: type.orden_visualizacion,
    })),
    sortOptions: [...PLACE_ARCHIVE_SORTS],
  }
}

async function listVisiblePlaces({
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
      : buildVisiblePlaceWhere(req.auth.userId)
  const where =
    Object.keys(baseWhere).length && Object.keys(visibilityWhere).length
      ? { AND: [baseWhere, visibilityWhere] }
      : Object.keys(baseWhere).length
        ? baseWhere
        : visibilityWhere

  const [totalVisible, places] = await Promise.all([
    prisma.lugares.count({ where }),
    prisma.lugares.findMany({
      where,
      orderBy: [{ creado_en: 'desc' }, { id: 'desc' }],
      skip: safeCursor,
      take: safeLimit,
      include: getPlaceInclude(req.auth.userId),
    }),
  ])

  return {
    items: places.map((place) =>
      serializePlaceListItem(place, getPlaceAccessContext(place, req))
    ),
    meta: {
      totalVisible,
      limit: safeLimit,
      cursor: safeCursor,
      nextCursor:
        safeCursor + places.length < totalVisible
          ? safeCursor + places.length
          : null,
    },
  }
}

async function listPlaceVersions({ placeId, req }) {
  const context = await requirePlaceViewAccess(placeId, req)
  const rootId = context.place.lugar_base_id || context.place.id
  const related = await prisma.lugares.findMany({
    where: { OR: [{ id: rootId }, { lugar_base_id: rootId }] },
    orderBy: [{ creado_en: 'asc' }, { nombre: 'asc' }],
    include: getPlaceInclude(req.auth.userId),
  })

  return {
    item: serializePlaceListItem(context.place, context.access),
    versiones: related
      .map((place) => {
        const access = getPlaceAccessContext(place, req)
        return access.canView ? serializePlaceListItem(place, access) : null
      })
      .filter(Boolean),
  }
}

async function deletePlace({ placeId, req }) {
  const context = await requirePlaceEditAccess(placeId, req)
  const imageUrls = [
    context.place.imagen_url,
    ...(context.place.lugar_imagenes || []).map((image) => image.imagen_url),
  ].filter(Boolean)

  await prisma.lugares.delete({ where: { id: placeId } })
  await cleanupCloudinaryAssets(imageUrls)
}

module.exports = {
  PLACE_TYPES,
  PLACE_VISIBILITY_CODES,
  deletePlace,
  getPlaceArchiveMetadata,
  getPlaceEditorMetadata,
  getVisiblePlaceGraph,
  listPlaceArchivePage,
  listOwnPlacesForEditor,
  listOwnPlaceTreesForEditor,
  listPlaceVersions,
  listVisiblePlaces,
  requirePlaceViewAccess,
  savePlaceDraft,
  serializePlace,
}
