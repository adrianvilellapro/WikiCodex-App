const { prisma } = require('../lib/prisma')
const { buildVisibleCharacterWhere } = require('./character-list.service')
const { buildVisibleObjectWhere } = require('./object.service')
const { buildVisiblePowerWhere } = require('./power.service')
const { getSpellVisibilityWhere } = require('./spell.service')

const WIKI_TYPES = [
  {
    type: 'personaje',
    label: 'Personaje',
    delegate: 'personajes',
    nameField: 'nombre',
    route: (item) => `/app/personajes/${item.id}`,
    include: {
      campanas: { select: { id: true, nombre: true } },
    },
    visibleWhere: (req, baseWhere) =>
      req.auth.roleCode === 'administrador'
        ? baseWhere
        : buildVisibleCharacterWhere(req.auth.userId, baseWhere),
    totalWhere: (baseWhere) => baseWhere,
    context: (item) => item.campanas?.nombre || null,
  },
  {
    type: 'objeto',
    label: 'Objeto',
    delegate: 'objetos',
    nameField: 'nombre',
    route: (item) => `/app/objetos/${item.id}`,
    include: objectLikeInclude('objeto_campanas'),
    visibleWhere: (req, baseWhere) =>
      req.auth.roleCode === 'administrador'
        ? baseWhere
        : { AND: [baseWhere, buildVisibleObjectWhere(req.auth.userId)] },
    totalWhere: (baseWhere) => baseWhere,
    context: collectObjectLikeCampaignNames('objeto_campanas'),
  },
  {
    type: 'lugar',
    label: 'Lugar',
    delegate: 'lugares',
    nameField: 'nombre',
    route: (item) => `/app/lugares/${item.id}`,
    include: objectLikeInclude('lugar_campanas'),
    visibleWhere: (req, baseWhere) =>
      req.auth.roleCode === 'administrador'
        ? baseWhere
        : { AND: [baseWhere, buildVisiblePlaceWhere(req.auth.userId)] },
    totalWhere: (baseWhere) => baseWhere,
    context: collectObjectLikeCampaignNames('lugar_campanas'),
  },
  {
    type: 'campana',
    aliases: ['campaña', 'capaña'],
    label: 'Campaña',
    delegate: 'campanas',
    nameField: 'nombre',
    route: (item) => `/app/campanas/${item.id}`,
    include: {
      campana_jugadores: true,
    },
    visibleWhere: (req, baseWhere) => ({
      AND: [baseWhere, buildVisibleCampaignWhere(req)],
    }),
    totalWhere: (baseWhere) => baseWhere,
    context: (item) =>
      item.privacidad_codigo === 'privada' ? 'Privada' : 'Pública',
  },
  {
    type: 'aventura',
    label: 'Aventura',
    delegate: 'aventuras',
    nameField: 'nombre',
    route: (item) => `/app/campanas/${item.campana_id}#aventura-${item.id}`,
    include: campaignChildInclude(),
    visibleWhere: (req, baseWhere) => ({
      AND: [baseWhere, { campanas: buildVisibleCampaignRelationWhere(req) }],
    }),
    totalWhere: (baseWhere) => baseWhere,
    context: (item) => item.campanas?.nombre || null,
  },
  {
    type: 'arco',
    label: 'Arco',
    delegate: 'arcos',
    nameField: 'nombre',
    route: (item) => `/app/campanas/${item.campana_id}#arco-${item.id}`,
    include: {
      campanas: { select: { id: true, nombre: true } },
      aventuras: { select: { id: true, nombre: true } },
    },
    visibleWhere: (req, baseWhere) => ({
      AND: [baseWhere, { campanas: buildVisibleCampaignRelationWhere(req) }],
    }),
    totalWhere: (baseWhere) => baseWhere,
    context: (item) =>
      [item.campanas?.nombre, item.aventuras?.nombre]
        .filter(Boolean)
        .join(' · '),
  },
  {
    type: 'partida',
    label: 'Partida',
    delegate: 'partidas',
    nameField: 'nombre',
    route: (item) => `/app/campanas/${item.campana_id}/partidas/${item.id}`,
    include: {
      campanas: { select: { id: true, nombre: true } },
      aventuras: { select: { id: true, nombre: true } },
      arcos: { select: { id: true, nombre: true } },
    },
    visibleWhere: (req, baseWhere) => ({
      AND: [baseWhere, { campanas: buildVisibleCampaignRelationWhere(req) }],
    }),
    totalWhere: (baseWhere) => baseWhere,
    context: (item) =>
      [item.campanas?.nombre, item.aventuras?.nombre, item.arcos?.nombre]
        .filter(Boolean)
        .join(' · '),
  },
  {
    type: 'hechizo',
    label: 'Hechizo',
    delegate: 'hechizos',
    nameField: 'nombre',
    route: (item) => `/app/poderes/hechizos/${item.id}`,
    include: {
      hechizo_campanas: {
        include: { campanas: { select: { id: true, nombre: true } } },
      },
    },
    visibleWhere: (req, baseWhere) => ({
      AND: [
        baseWhere,
        getSpellVisibilityWhere(req.auth.userId, req.auth.roleCode),
      ],
    }),
    totalWhere: (baseWhere) => baseWhere,
    context: (item) =>
      [
        item.nivel === 0 ? 'Truco' : `Nivel ${item.nivel}`,
        item.hechizo_campanas
          ?.map((relation) => relation.campanas?.nombre)
          .filter(Boolean)
          .join(', '),
      ]
        .filter(Boolean)
        .join(' · '),
  },
  {
    type: 'poder',
    label: 'Poder',
    delegate: 'poderes',
    nameField: 'nombre',
    route: (item) => `/app/poderes/otros/${item.id}`,
    include: objectLikeInclude('poder_campanas'),
    visibleWhere: (req, baseWhere) => buildVisiblePowerWhere(req, baseWhere),
    totalWhere: (baseWhere) => baseWhere,
    context: collectObjectLikeCampaignNames('poder_campanas'),
  },
]

const WIKI_TYPE_BY_KEY = new Map()
for (const config of WIKI_TYPES) {
  WIKI_TYPE_BY_KEY.set(config.type, config)
  for (const alias of config.aliases || []) {
    WIKI_TYPE_BY_KEY.set(alias, config)
  }
}

function objectLikeInclude(relationName) {
  return {
    campanas: { select: { id: true, nombre: true } },
    [relationName]: {
      include: {
        campanas: { select: { id: true, nombre: true } },
      },
    },
  }
}

function collectObjectLikeCampaignNames(relationName) {
  return (item) => {
    const names = new Set()
    if (item.campanas?.nombre) {
      names.add(item.campanas.nombre)
    }
    for (const relation of item[relationName] || []) {
      if (relation.campanas?.nombre) {
        names.add(relation.campanas.nombre)
      }
    }
    return [...names].join(', ') || null
  }
}

function campaignChildInclude() {
  return {
    campanas: { select: { id: true, nombre: true } },
  }
}

function normalizeType(value) {
  return String(value || '')
    .trim()
    .normalize('NFC')
    .toLowerCase()
}

function getTypeConfig(type) {
  return WIKI_TYPE_BY_KEY.get(normalizeType(type)) || null
}

function buildNameSearchWhere(config, query) {
  const term = String(query || '').trim()

  if (!term) {
    return {}
  }

  return {
    [config.nameField]: {
      contains: term,
      mode: 'insensitive',
    },
  }
}

function buildNameExactWhere(config, name) {
  return {
    [config.nameField]: {
      equals: String(name || '').trim(),
      mode: 'insensitive',
    },
  }
}

function buildVisibleCampaignRelationWhere(req) {
  if (req.auth.roleCode === 'administrador') {
    return {}
  }

  return {
    OR: [
      { master_usuario_id: req.auth.userId },
      { privacidad_codigo: 'publica' },
      { campana_jugadores: { some: { usuario_id: req.auth.userId } } },
    ],
  }
}

function buildVisibleCampaignWhere(req) {
  return req.auth.roleCode === 'administrador'
    ? {}
    : buildVisibleCampaignRelationWhere(req)
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
              { lugar_campanas: { some: { campanas: readableCampaignWhere } } },
              { campanas: { is: readableCampaignWhere } },
              { AND: [{ campana_id: null }, { lugar_campanas: { none: {} } }] },
            ],
          },
        ],
      },
      {
        permisos_lugar: {
          some: {
            usuario_id: userId,
            nivel_acceso_codigo: {
              in: ['full', 'completo', 'preview', 'vista_previa'],
            },
          },
        },
      },
      { lugar_campanas: { some: { campanas: memberCampaignWhere } } },
      { campanas: { is: memberCampaignWhere } },
    ],
  }
}

function serializeWikiEntity(config, item) {
  return {
    id: item.id,
    tipo: config.type,
    tipoEtiqueta: config.label,
    nombre: item[config.nameField],
    contexto: config.context?.(item) || null,
    url: config.route(item),
  }
}

function serializeType(config) {
  return {
    tipo: config.type,
    etiqueta: config.label,
  }
}

async function searchWikiEntities({ req, type, query = '', limit = 8 }) {
  const config = getTypeConfig(type)
  const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 20))

  if (!config) {
    return []
  }

  const baseWhere = buildNameSearchWhere(config, query)
  const items = await prisma[config.delegate].findMany({
    where: config.visibleWhere(req, baseWhere),
    include: config.include,
    orderBy: [{ [config.nameField]: 'asc' }, { id: 'asc' }],
    take: safeLimit,
  })

  return items.map((item) => serializeWikiEntity(config, item))
}

async function resolveWikiReference({ req, reference }) {
  const config = getTypeConfig(reference.tipo || reference.type)
  const nombre = String(reference.nombre || reference.name || '').trim()
  const key = reference.key || `${reference.tipo}:${nombre}`

  if (!config || !nombre) {
    return {
      key,
      status: 'invalid',
      label: 'Referencia no válida',
    }
  }

  const baseWhere = buildNameExactWhere(config, nombre)
  const [visibleItems, totalMatches] = await Promise.all([
    prisma[config.delegate].findMany({
      where: config.visibleWhere(req, baseWhere),
      include: config.include,
      orderBy: [{ [config.nameField]: 'asc' }, { id: 'asc' }],
      take: 2,
    }),
    prisma[config.delegate].count({
      where: config.totalWhere(baseWhere),
    }),
  ])

  if (visibleItems.length === 1) {
    return {
      key,
      status: 'resolved',
      item: serializeWikiEntity(config, visibleItems[0]),
    }
  }

  if (visibleItems.length > 1) {
    return {
      key,
      status: 'ambiguous',
      label: 'Referencia ambigua',
    }
  }

  return {
    key,
    status: totalMatches > 0 ? 'unavailable' : 'missing',
    label:
      totalMatches > 0 ? 'Contenido no disponible' : 'Referencia no encontrada',
  }
}

async function resolveWikiReferences({ req, references = [] }) {
  const safeReferences = Array.isArray(references)
    ? references.slice(0, 80)
    : []
  const results = await Promise.all(
    safeReferences.map((reference) => resolveWikiReference({ req, reference }))
  )

  return {
    items: results,
  }
}

module.exports = {
  WIKI_TYPES: WIKI_TYPES.map(serializeType),
  getTypeConfig,
  resolveWikiReferences,
  searchWikiEntities,
}
