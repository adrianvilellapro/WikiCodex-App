const { createHttpError } = require('../lib/errors')
const { prisma } = require('../lib/prisma')
const { isGlobalAdmin } = require('./campaign-access.service')

const CLASS_SORTS = new Set([
  'name_asc',
  'name_desc',
  'created_desc',
  'created_asc',
  'updated_desc',
  'updated_asc',
])
const LANGUAGE_CODES = new Set(['en', 'es'])
const CONTENT_TYPES = new Set(['classic', 'one', 'misc', 'wikicodex'])
const WIKICODEX_CAMPAIGN_FILTER_ID = '__wikicodex'
const NO_CAMPAIGN_SELECTION_FILTER_ID = '__none'
const CLASS_SOURCES = [
  'wikicodex',
  'PHB',
  'XPHB',
  'TCE',
  'EFA',
  'XGE',
  'SCAG',
  'UA',
  'UATheMysticClass',
]
const SYSTEM_SOURCES = new Set([
  'AAG',
  'AI',
  'AitFR',
  'BGG',
  'DMG',
  'DMG24',
  'DSotDQ',
  'EET',
  'EFA',
  'EGW',
  'FTD',
  'HAT-LMI',
  'LLK',
  'LR',
  'MFF',
  'MotM',
  'MPMM',
  'MTF',
  'OGA',
  'PHB',
  'PHB24',
  'PSA',
  'PSI',
  'PSK',
  'PSX',
  'RMBRE',
  'SADS',
  'SCAG',
  'TDCSR',
  'TCE',
  'UA',
  'UABarbarianAndMonk',
  'UABard',
  'UAClericDruid',
  'UAFighterRogueWizard',
  'UAMystic',
  'UAMystic2',
  'UAMystic3',
  'UAPaladin',
  'UARangerRogue',
  'XGE',
  'XPHB',
])

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function slugify(value) {
  return normalizeText(value)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
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

function splitCampaignFilterValues(value) {
  const selectedIds = normalizeUuidArray(value)

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

function normalizeJsonArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function buildClassOrderBy(sort) {
  switch (CLASS_SORTS.has(sort) ? sort : 'name_asc') {
    case 'name_desc':
      return [{ nombre: 'desc' }, { fuente: 'asc' }, { id: 'asc' }]
    case 'created_desc':
      return [{ creado_en: 'desc' }, { id: 'desc' }]
    case 'created_asc':
      return [{ creado_en: 'asc' }, { id: 'asc' }]
    case 'updated_desc':
      return [{ actualizado_en: 'desc' }, { id: 'desc' }]
    case 'updated_asc':
      return [{ actualizado_en: 'asc' }, { id: 'asc' }]
    case 'name_asc':
    default:
      return [{ nombre: 'asc' }, { fuente: 'asc' }, { id: 'asc' }]
  }
}

function getClassInclude() {
  return {
    usuarios: {
      select: {
        id: true,
        nombre_usuario: true,
        imagen_perfil_url: true,
        roles: {
          select: {
            codigo: true,
          },
        },
      },
    },
    clase_campanas: {
      include: {
        campanas: {
          select: {
            id: true,
            nombre: true,
            privacidad_codigo: true,
            master_usuario_id: true,
          },
        },
      },
      orderBy: { creado_en: 'asc' },
    },
    subclases: {
      orderBy: [{ nombre: 'asc' }, { fuente: 'asc' }],
    },
  }
}

function isSystemClass(item) {
  const source = String(item.fuente || '').trim()

  return (
    !item.creado_por_usuario_id ||
    item.usuarios?.roles?.codigo === 'administrador' ||
    SYSTEM_SOURCES.has(source)
  )
}

function canEditClass(item, req) {
  return (
    isGlobalAdmin(req) ||
    (item.creado_por_usuario_id &&
      item.creado_por_usuario_id === req.auth.userId)
  )
}

function serializeSubclass(item) {
  return {
    id: item.id,
    claseId: item.clase_id,
    nombre: item.nombre,
    nombreNormalizado: item.nombre_normalizado,
    slug: item.slug,
    fuente: item.fuente,
    descripcion: item.descripcion,
    resumen: item.resumen,
    rasgos: item.rasgos || [],
    datosFuente: item.datos_fuente || {},
    creadoEn: item.creado_en,
    actualizadoEn: item.actualizado_en,
  }
}

function serializeClass(item, req) {
  const canEdit = canEditClass(item, req)
  const creatorIsSystem = isSystemClass(item)

  return {
    id: item.id,
    nombre: item.nombre,
    nombreNormalizado: item.nombre_normalizado,
    slug: item.slug,
    idiomaCodigo: item.idioma_codigo,
    fuente: item.fuente,
    edicion: item.edicion,
    esCatalogo: item.es_catalogo,
    categoriaCatalogo: item.categoria_catalogo,
    descripcion: item.descripcion,
    resumen: item.resumen,
    icono: item.icono,
    dadoGolpeCaras: item.dado_golpe_caras,
    salvaciones: item.salvaciones || [],
    competencias: item.competencias || {},
    equipoInicial: item.equipo_inicial || [],
    tabla: item.tabla || [],
    rasgos: item.rasgos || [],
    datosFuente: item.datos_fuente || {},
    campanas: (item.clase_campanas || [])
      .map((relation) => relation.campanas)
      .filter(Boolean)
      .map((campaign) => ({
        id: campaign.id,
        nombre: campaign.nombre,
        privacidadCodigo: campaign.privacidad_codigo,
        masterUsuarioId: campaign.master_usuario_id,
      })),
    subclases: (item.subclases || []).map(serializeSubclass),
    creadoPor:
      item.usuarios && !creatorIsSystem
        ? {
            id: item.usuarios.id,
            nombreUsuario: item.usuarios.nombre_usuario,
            imagenPerfilUrl: item.usuarios.imagen_perfil_url,
          }
        : null,
    creadorSistema: creatorIsSystem,
    creadoPorUsuarioId: item.creado_por_usuario_id,
    creadoEn: item.creado_en,
    actualizadoEn: item.actualizado_en,
    puedeEditar: canEdit,
    puedeBorrar: canEdit,
  }
}

function buildEditionWhere(ediciones = []) {
  const rawValues = Array.isArray(ediciones)
    ? ediciones.map((item) =>
        String(item || '')
          .trim()
          .toLowerCase()
      )
    : null

  if (rawValues?.includes('none')) {
    return { id: '__none__' }
  }

  const selected = [
    ...new Set((rawValues || []).filter((item) => CONTENT_TYPES.has(item))),
  ]

  if (
    !rawValues ||
    !rawValues.length ||
    selected.length === CONTENT_TYPES.size
  ) {
    return null
  }

  if (!selected.length) {
    return { id: '__none__' }
  }

  const OR = []

  if (selected.includes('classic')) {
    OR.push({ categoria_catalogo: 'classic' })
  }

  if (selected.includes('one')) {
    OR.push({ categoria_catalogo: 'one' }, { edicion: 'one' })
  }

  if (selected.includes('misc')) {
    OR.push({ categoria_catalogo: 'misc' })
  }

  if (selected.includes('wikicodex')) {
    OR.push(
      { categoria_catalogo: 'wikicodex' },
      { edicion: 'wikicodex' },
      { fuente: 'wikicodex' }
    )
  }

  return { OR }
}

function buildClassWhere(filters = {}) {
  const where = { es_catalogo: true }
  const and = []
  const language = String(filters.idioma || '')
    .trim()
    .toLowerCase()

  if (LANGUAGE_CODES.has(language)) {
    where.idioma_codigo = language
  }

  const { campaignIds, includeUnscoped, hasNoSelection } =
    splitCampaignFilterValues(filters.campaignIds)

  if (hasNoSelection) {
    and.push({ id: { in: [] } })
  }

  if (campaignIds.length || includeUnscoped) {
    const campaignConditions = []

    if (campaignIds.length) {
      campaignConditions.push({
        clase_campanas: {
          some: {
            campana_id: { in: campaignIds },
          },
        },
      })
    }

    if (includeUnscoped) {
      campaignConditions.push({
        clase_campanas: { none: {} },
      })
    }

    and.push(
      campaignConditions.length === 1
        ? campaignConditions[0]
        : { OR: campaignConditions }
    )
  }

  const editionWhere = buildEditionWhere(filters.ediciones)

  if (editionWhere) {
    and.push(editionWhere)
  }

  const term = normalizeText(filters.q)

  if (term) {
    const search = term.length < 3 ? { startsWith: term } : { contains: term }

    and.push({
      OR: [
        { nombre_normalizado: search },
        {
          subclases: {
            some: {
              nombre_normalizado: search,
            },
          },
        },
      ],
    })
  }

  if (and.length) {
    where.AND = and
  }

  return where
}

async function listClasses({ req, filters = {}, limit = 200 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500)
  const where = buildClassWhere(filters)
  const [total, items] = await Promise.all([
    prisma.clases.count({ where }),
    prisma.clases.findMany({
      where,
      orderBy: buildClassOrderBy(filters.sort),
      take: safeLimit,
      include: getClassInclude(),
    }),
  ])

  return {
    total,
    items: items.map((item) => serializeClass(item, req)),
  }
}

async function requireClass({ classId }) {
  const item = await prisma.clases.findUnique({
    where: { id: classId },
    include: getClassInclude(),
  })

  if (!item || !item.es_catalogo) {
    throw createHttpError(404, 'Clase no encontrada.')
  }

  return item
}

async function getClassDetail({ req, classId }) {
  const item = await requireClass({ classId })
  return serializeClass(item, req)
}

async function getSubclassDetail({ req, classId, subclassId }) {
  const item = await prisma.subclases.findFirst({
    where: {
      id: subclassId,
      clase_id: classId,
      clases: { es_catalogo: true },
    },
    include: {
      clases: {
        include: getClassInclude(),
      },
    },
  })

  if (!item) {
    throw createHttpError(404, 'Subclase no encontrada.')
  }

  return {
    ...serializeSubclass(item),
    clase: serializeClass(item.clases, req),
  }
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

function buildClassData(payload, req, { isCreate = false } = {}) {
  const nombre = String(payload.nombre || '').trim()

  if (!nombre) {
    throw createHttpError(400, 'La clase necesita un nombre.')
  }

  const idiomaCodigo = LANGUAGE_CODES.has(payload.idiomaCodigo)
    ? payload.idiomaCodigo
    : 'en'
  const fuente = String(payload.fuente || 'wikicodex')
    .trim()
    .slice(0, 80)
  const edicion = payload.edicion?.trim() || 'wikicodex'
  const categoriaCatalogo =
    payload.categoriaCatalogo?.trim() ||
    (edicion === 'one'
      ? 'one'
      : edicion === 'wikicodex' || fuente === 'wikicodex'
        ? 'wikicodex'
        : 'misc')

  return {
    ...(isCreate ? { creado_por_usuario_id: req.auth.userId } : {}),
    nombre,
    nombre_normalizado: normalizeText(nombre),
    slug: slugify(payload.slug || `${nombre}-${fuente}`),
    idioma_codigo: idiomaCodigo,
    fuente,
    edicion,
    es_catalogo: true,
    categoria_catalogo: categoriaCatalogo,
    descripcion: payload.descripcion?.trim() || null,
    resumen: payload.resumen?.trim() || null,
    icono: payload.icono?.trim() || null,
    dado_golpe_caras:
      payload.dadoGolpeCaras === null || payload.dadoGolpeCaras === undefined
        ? null
        : Number(payload.dadoGolpeCaras),
    salvaciones: normalizeJsonArray(payload.salvaciones),
    competencias: normalizeJsonObject(payload.competencias),
    equipo_inicial: normalizeJsonArray(payload.equipoInicial),
    tabla: normalizeJsonArray(payload.tabla),
    rasgos: normalizeJsonArray(payload.rasgos),
    datos_fuente: normalizeJsonObject(payload.datosFuente),
    actualizado_en: new Date(),
  }
}

function buildSubclassData(
  entry,
  orderIndex = 0,
  fallbackSource = 'wikicodex'
) {
  const nombre = String(entry?.nombre || '').trim()

  if (!nombre) {
    return null
  }

  return {
    nombre,
    nombre_normalizado: normalizeText(nombre),
    slug: slugify(entry.slug || `${nombre}-${entry.fuente || fallbackSource}`),
    fuente: entry.fuente?.trim() || fallbackSource,
    descripcion: entry.descripcion?.trim() || null,
    resumen: entry.resumen?.trim() || null,
    rasgos: normalizeJsonArray(entry.rasgos),
    datos_fuente: {
      ...normalizeJsonObject(entry.datosFuente),
      orden: orderIndex,
    },
    actualizado_en: new Date(),
  }
}

async function writeClassRelations(tx, classId, payload, req) {
  const campaignIds = await getManageableCampaignIds(req, payload.campanaIds)
  const source = payload.fuente?.trim() || 'wikicodex'
  const subclassEntries = normalizeJsonArray(payload.subclases).filter(
    (entry) => buildSubclassData(entry, 0, source)
  )

  await tx.clase_campanas.deleteMany({ where: { clase_id: classId } })

  if (campaignIds.length) {
    await tx.clase_campanas.createMany({
      data: campaignIds.map((campaignId) => ({
        clase_id: classId,
        campana_id: campaignId,
      })),
      skipDuplicates: true,
    })
  }

  const existingSubclasses = await tx.subclases.findMany({
    where: { clase_id: classId },
    select: { id: true },
  })
  const existingIds = new Set(existingSubclasses.map((item) => item.id))
  const keptIds = new Set()

  for (const [index, entry] of subclassEntries.entries()) {
    const data = buildSubclassData(entry, index, source)

    if (entry.id && existingIds.has(entry.id)) {
      await tx.subclases.update({
        where: { id: entry.id },
        data,
      })
      keptIds.add(entry.id)
    } else {
      const created = await tx.subclases.create({
        data: {
          ...data,
          clase_id: classId,
        },
        select: { id: true },
      })
      keptIds.add(created.id)
    }
  }

  const removableIds = [...existingIds].filter((id) => !keptIds.has(id))

  if (removableIds.length) {
    const usedSubclasses = await tx.personaje_clases.findMany({
      where: { subclase_id: { in: removableIds } },
      select: { subclase_id: true },
    })
    const blockedIds = new Set(usedSubclasses.map((item) => item.subclase_id))
    const deleteIds = removableIds.filter((id) => !blockedIds.has(id))

    if (deleteIds.length) {
      await tx.subclases.deleteMany({ where: { id: { in: deleteIds } } })
    }
  }
}

async function createClass({ req, payload }) {
  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.clases.create({
      data: buildClassData(payload, req, { isCreate: true }),
      select: { id: true },
    })

    await writeClassRelations(tx, item.id, payload, req)
    return item
  })

  return getClassDetail({ req, classId: created.id })
}

async function updateClass({ req, classId, payload }) {
  const current = await requireClass({ classId })

  if (!canEditClass(current, req)) {
    throw createHttpError(403, 'No tienes permiso para editar esta clase.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.clases.update({
      where: { id: classId },
      data: buildClassData(payload, req),
    })

    await writeClassRelations(tx, classId, payload, req)
  })

  return getClassDetail({ req, classId })
}

async function deleteClass({ req, classId }) {
  const current = await requireClass({ classId })

  if (!canEditClass(current, req)) {
    throw createHttpError(403, 'No tienes permiso para borrar esta clase.')
  }

  const linkedCharacters = await prisma.personaje_clases.count({
    where: { clase_id: classId },
  })

  if (linkedCharacters > 0) {
    throw createHttpError(
      409,
      'No puedes borrar una clase enlazada a personajes.'
    )
  }

  await prisma.clases.delete({ where: { id: classId } })
  return { eliminado: true }
}

async function getClassOptions({ req }) {
  const [campaigns, traitTypes] = await Promise.all([
    prisma.campanas.findMany({
      where: isGlobalAdmin(req) ? {} : { master_usuario_id: req.auth.userId },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    prisma.tipos_rasgo.findMany({
      orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, orden_visualizacion: true },
    }),
  ])

  return {
    idiomas: [
      { codigo: 'en', nombre: 'Ingles' },
      { codigo: 'es', nombre: 'Espanol' },
    ],
    ediciones: [
      { codigo: 'classic', nombre: 'Clasico' },
      { codigo: 'one', nombre: 'D&D One' },
      { codigo: 'misc', nombre: 'Miscelanea' },
      { codigo: 'wikicodex', nombre: 'WikiCodex' },
    ],
    fuentes: CLASS_SOURCES.map((codigo) => ({ codigo, nombre: codigo })),
    tiposRasgo: traitTypes
      .filter((item) => item.nombre !== 'Pruebas Wiki')
      .map((item) => ({
        id: item.id,
        nombre: item.nombre,
        ordenVisualizacion: item.orden_visualizacion,
      })),
    campanasGestionables: campaigns,
  }
}

module.exports = {
  createClass,
  deleteClass,
  getClassDetail,
  getClassOptions,
  getSubclassDetail,
  listClasses,
  normalizeText,
  serializeClass,
  updateClass,
}
