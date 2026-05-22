const { createHttpError } = require('../lib/errors')
const { prisma } = require('../lib/prisma')
const { isGlobalAdmin } = require('./campaign-access.service')

const FEAT_SORTS = new Set([
  'name_asc',
  'name_desc',
  'created_desc',
  'created_asc',
  'updated_desc',
  'updated_asc',
])
const LANGUAGE_CODES = new Set(['en', 'es'])
const SYSTEM_SOURCES = new Set([
  'AAG',
  'AitFR',
  'BGG',
  'DMG',
  'DMG24',
  'DSotDQ',
  'EFA',
  'FTD',
  'PHB',
  'PHB24',
  'SADS',
  'TCE',
  'XGE',
  'XPHB',
])
const FEAT_SOURCES = [
  'wikicodex',
  'PHB',
  'XPHB',
  'TCE',
  'EFA',
  'XGE',
  'BGG',
  'DMG',
  'UA',
]

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

function normalizeJsonArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function buildFeatOrderBy(sort) {
  switch (FEAT_SORTS.has(sort) ? sort : 'name_asc') {
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

function getFeatInclude() {
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
  }
}

function isSystemFeat(item) {
  const source = String(item.fuente || '').trim()

  return (
    !item.creado_por_usuario_id ||
    item.usuarios?.roles?.codigo === 'administrador' ||
    SYSTEM_SOURCES.has(source)
  )
}

function canEditFeat(item, req) {
  return (
    isGlobalAdmin(req) ||
    (item.creado_por_usuario_id &&
      item.creado_por_usuario_id === req.auth.userId)
  )
}

function serializeFeat(item, req) {
  const canEdit = canEditFeat(item, req)
  const creatorIsSystem = isSystemFeat(item)

  return {
    id: item.id,
    nombre: item.nombre,
    nombreNormalizado: item.nombre_normalizado,
    slug: item.slug,
    idiomaCodigo: item.idioma_codigo,
    fuente: item.fuente,
    edicion: item.edicion,
    esCatalogo: item.es_catalogo,
    categoria: item.categoria,
    prerrequisitos: item.prerrequisitos || [],
    descripcion: item.descripcion,
    resumen: item.resumen,
    beneficios: item.beneficios || [],
    datosFuente: item.datos_fuente || {},
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

function buildFeatWhere(filters = {}) {
  const where = { es_catalogo: true }
  const and = []
  const language = String(filters.idioma || '')
    .trim()
    .toLowerCase()

  if (LANGUAGE_CODES.has(language)) {
    where.idioma_codigo = language
  }

  const sourceValues = Array.isArray(filters.fuentes)
    ? filters.fuentes.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  if (sourceValues.length) {
    and.push({ fuente: { in: sourceValues } })
  }

  const editionValues = Array.isArray(filters.ediciones)
    ? [
        ...new Set(
          filters.ediciones
            .map((item) =>
              String(item || '')
                .trim()
                .toLowerCase()
            )
            .filter((item) =>
              ['classic', 'one', 'wikicodex', 'none'].includes(item)
            )
        ),
      ]
    : []

  if (editionValues.includes('none')) {
    and.push({ id: '__none__' })
  } else if (editionValues.length && editionValues.length < 3) {
    const editionOr = []

    if (editionValues.includes('classic')) {
      editionOr.push({ edicion: 'classic' })
    }

    if (editionValues.includes('one')) {
      editionOr.push({ edicion: 'one' })
    }

    if (editionValues.includes('wikicodex')) {
      editionOr.push({ edicion: 'wikicodex' }, { fuente: 'wikicodex' })
    }

    if (editionOr.length) {
      and.push({ OR: editionOr })
    }
  }

  const term = normalizeText(filters.q)

  if (term) {
    const search = term.length < 3 ? { startsWith: term } : { contains: term }
    and.push({
      OR: [
        { nombre_normalizado: search },
        { descripcion: { contains: filters.q, mode: 'insensitive' } },
      ],
    })
  }

  if (and.length) {
    where.AND = and
  }

  return where
}

async function listFeats({ req, filters = {}, limit = 200 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500)
  const where = buildFeatWhere(filters)
  const [total, items] = await Promise.all([
    prisma.dotes.count({ where }),
    prisma.dotes.findMany({
      where,
      orderBy: buildFeatOrderBy(filters.sort),
      take: safeLimit,
      include: getFeatInclude(),
    }),
  ])

  return {
    total,
    items: items.map((item) => serializeFeat(item, req)),
  }
}

async function requireFeat({ featId }) {
  const item = await prisma.dotes.findUnique({
    where: { id: featId },
    include: getFeatInclude(),
  })

  if (!item || !item.es_catalogo) {
    throw createHttpError(404, 'Dote no encontrada.')
  }

  return item
}

async function getFeatDetail({ req, featId }) {
  const item = await requireFeat({ featId })
  return serializeFeat(item, req)
}

function buildFeatData(payload, req, { isCreate = false } = {}) {
  const nombre = String(payload.nombre || '').trim()

  if (!nombre) {
    throw createHttpError(400, 'La dote necesita un nombre.')
  }

  const idiomaCodigo = LANGUAGE_CODES.has(payload.idiomaCodigo)
    ? payload.idiomaCodigo
    : 'en'
  const fuente = String(payload.fuente || 'wikicodex')
    .trim()
    .slice(0, 80)
  const edicion = payload.edicion?.trim() || 'wikicodex'

  return {
    ...(isCreate ? { creado_por_usuario_id: req.auth.userId } : {}),
    nombre,
    nombre_normalizado: normalizeText(nombre),
    slug: slugify(payload.slug || `${nombre}-${fuente}`),
    idioma_codigo: idiomaCodigo,
    fuente,
    edicion,
    es_catalogo: true,
    categoria: payload.categoria?.trim() || null,
    prerrequisitos: normalizeJsonArray(payload.prerrequisitos),
    descripcion: payload.descripcion?.trim() || null,
    resumen: payload.resumen?.trim() || null,
    beneficios: normalizeJsonArray(payload.beneficios),
    datos_fuente: normalizeJsonObject(payload.datosFuente),
    actualizado_en: new Date(),
  }
}

async function createFeat({ req, payload }) {
  const created = await prisma.dotes.create({
    data: buildFeatData(payload, req, { isCreate: true }),
    select: { id: true },
  })

  return getFeatDetail({ req, featId: created.id })
}

async function updateFeat({ req, featId, payload }) {
  const current = await requireFeat({ featId })

  if (!canEditFeat(current, req)) {
    throw createHttpError(403, 'No tienes permiso para editar esta dote.')
  }

  await prisma.dotes.update({
    where: { id: featId },
    data: buildFeatData(payload, req),
  })

  return getFeatDetail({ req, featId })
}

async function deleteFeat({ req, featId }) {
  const current = await requireFeat({ featId })

  if (!canEditFeat(current, req)) {
    throw createHttpError(403, 'No tienes permiso para borrar esta dote.')
  }

  await prisma.dotes.delete({ where: { id: featId } })
  return { eliminado: true }
}

async function getFeatOptions() {
  const traitTypes = await prisma.tipos_rasgo.findMany({
    orderBy: [{ orden_visualizacion: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, orden_visualizacion: true },
  })

  return {
    idiomas: [
      { codigo: 'en', nombre: 'Ingles' },
      { codigo: 'es', nombre: 'Espanol' },
    ],
    fuentes: FEAT_SOURCES.map((codigo) => ({ codigo, nombre: codigo })),
    ediciones: [
      { codigo: 'classic', nombre: 'Clasico' },
      { codigo: 'one', nombre: 'D&D One' },
      { codigo: 'wikicodex', nombre: 'WikiCodex' },
    ],
    tiposRasgo: traitTypes
      .filter((item) => item.nombre !== 'Pruebas Wiki')
      .map((item) => ({
        id: item.id,
        nombre: item.nombre,
        ordenVisualizacion: item.orden_visualizacion,
      })),
  }
}

module.exports = {
  createFeat,
  deleteFeat,
  getFeatDetail,
  getFeatOptions,
  listFeats,
  normalizeText,
  serializeFeat,
  updateFeat,
}
