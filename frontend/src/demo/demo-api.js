import { demoData } from './demo-data'
import { demoClasses, demoFeats } from './demo-fixtures'

const DEMO_USER_STORAGE_KEY = 'wikicodex:demo:user'
const DEMO_FAVORITES_STORAGE_KEY = 'wikicodex:demo:favorites'
const READONLY_MESSAGE =
  'La demo estatica de WikiCodex es de solo lectura. Esta accion no modifica datos reales.'

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function isDateLikeKey(key) {
  const normalizedKey = String(key || '').toLowerCase()

  return (
    normalizedKey.endsWith('en') ||
    normalizedKey.endsWith('at') ||
    normalizedKey.includes('fecha') ||
    normalizedKey.includes('date')
  )
}

function normalizeDemoValue(value, key = '', visited = new WeakSet()) {
  if (!value || typeof value !== 'object') {
    return value
  }

  if (visited.has(value)) {
    return value
  }

  if (Array.isArray(value)) {
    visited.add(value)
    value.forEach((item, index) => {
      value[index] = normalizeDemoValue(item, key, visited)
    })
    return value
  }

  if (!isPlainObject(value)) {
    return value
  }

  const entries = Object.entries(value)

  if (!entries.length && isDateLikeKey(key)) {
    return null
  }

  visited.add(value)
  for (const [entryKey, entryValue] of entries) {
    value[entryKey] = normalizeDemoValue(entryValue, entryKey, visited)
  }

  return value
}

normalizeDemoValue(demoData)

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function readJsonStorage(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

let demoUser = readJsonStorage(DEMO_USER_STORAGE_KEY, demoData.demoUser)
let demoFavorites = new Set(
  readJsonStorage(DEMO_FAVORITES_STORAGE_KEY, []).filter(Boolean)
)

function saveFavorites() {
  writeJsonStorage(DEMO_FAVORITES_STORAGE_KEY, [...demoFavorites])
}

function favoriteKey(entityType, entityId) {
  return `${entityType}:${entityId}`
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function toParams(config) {
  const url = new URL(config.url || '/', 'https://demo.wikicodex.local')
  const params = new URLSearchParams(url.search)

  for (const [key, value] of Object.entries(config.params || {})) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    params.set(key, String(value))
  }

  return {
    path: url.pathname.replace(/^\/api(?=\/)/u, '') || '/',
    params,
  }
}

function pageFromItems(items, params, defaultLimit = 30) {
  const limit = Math.max(
    1,
    Math.min(Number(params.get('limit') || defaultLimit), 500)
  )
  const cursor = Math.max(0, Number(params.get('cursor') || 0))
  const query = normalizeText(params.get('q'))
  const filtered = query
    ? items.filter((item) =>
        normalizeText(
          `${item.nombre || item.name || ''} ${item.titulo || ''} ${
            item.descripcion || ''
          }`
        ).includes(query)
      )
    : items
  const pageItems = filtered.slice(cursor, cursor + limit)
  const nextCursor =
    cursor + pageItems.length < filtered.length
      ? String(cursor + pageItems.length)
      : null

  return {
    items: pageItems,
    meta: {
      limit,
      cursor,
      returned: pageItems.length,
      totalVisible: filtered.length,
      total: filtered.length,
      nextCursor,
      hasMore: Boolean(nextCursor),
    },
  }
}

function publicProfilePage(items, params) {
  const page = pageFromItems(items || [], params, 10)

  return {
    items: page.items,
    totalVisible: page.meta.totalVisible,
    nextCursor: page.meta.nextCursor,
    meta: page.meta,
  }
}

function characterPage(params) {
  const view = params.get('view') || 'characters'
  let items = demoData.characters.page.items || []

  if (view === 'bestiary') {
    items = items.filter((item) => item.esCriatura)
  } else if (view === 'tierlist') {
    items = items.filter((item) => item.tier?.id)
  } else {
    items = items.filter((item) => !item.esCriatura)
  }

  return pageFromItems(items, params, view === 'tierlist' ? 100 : 30)
}

function spellPage(params) {
  let items = demoData.spells.page.items || []
  const classIds = String(
    params.get('classFilters') || params.get('classIds') || ''
  )
    .split(/[|,]/u)
    .map((item) => item.trim())
    .filter(Boolean)

  if (classIds.length) {
    const selected = new Set(classIds)
    items = items.filter((spell) =>
      (spell.clases || []).some((item) => selected.has(item))
    )
  }

  return pageFromItems(items, params, 80)
}

function resolveSearchEntity(type, item) {
  const routeByType = {
    character: `/app/personajes/${item.id}`,
    object: `/app/objetos/${item.id}`,
    place: `/app/lugares/${item.id}`,
    spell: `/app/poderes/hechizos/${item.id}`,
    power: `/app/poderes/otros/${item.id}`,
    class: `/app/clases/${item.id}`,
    feat: `/app/clases/dotes/${item.id}`,
    campaign: `/app/campanas/${item.id}`,
    user: `/app/perfiles/${item.id}`,
  }

  return {
    type,
    tipo: type,
    id: item.id,
    name: item.nombre || item.nombreUsuario || item.name,
    nombre: item.nombre || item.nombreUsuario || item.name,
    url: routeByType[type],
    tipoEtiqueta:
      {
        character: 'Personaje',
        object: 'Objeto',
        place: 'Lugar',
        spell: 'Hechizo',
        power: 'Poder',
        class: 'Clase',
        feat: 'Dote',
        campaign: 'Campana',
        user: 'Usuario',
      }[type] || type,
  }
}

function uniqueById(items) {
  const seen = new Set()
  const result = []

  for (const item of items.flat().filter(Boolean)) {
    const key = item.id || `${item.nombre || item.nombreUsuario || ''}`
    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(item)
  }

  return result
}

function classItems() {
  return uniqueById([demoClasses, demoData.classes.page.items || []])
}

function classDetails() {
  return {
    ...Object.fromEntries(demoClasses.map((item) => [item.id, item])),
    ...(demoData.classes.details || {}),
  }
}

function classSubclasses() {
  return {
    ...Object.fromEntries(
      demoClasses.flatMap((item) =>
        (item.subclases || []).map((subclass) => [
          `${item.id}:${subclass.id}`,
          {
            ...subclass,
            clase: {
              id: item.id,
              nombre: item.nombre,
            },
            claseId: item.id,
          },
        ])
      )
    ),
    ...(demoData.classes.subclasses || {}),
  }
}

function featItems() {
  return uniqueById([demoFeats, demoData.feats.page.items || []])
}

function featDetails() {
  return {
    ...Object.fromEntries(demoFeats.map((item) => [item.id, item])),
    ...(demoData.feats.details || {}),
  }
}

function detailItems(record) {
  return Object.values(record || {})
    .map((entry) => entry?.item || entry)
    .filter(Boolean)
}

function campaignNestedItems(key) {
  return Object.values(demoData.campaigns.details || {}).flatMap(
    (entry) => entry?.[key] || []
  )
}

function wikiSources() {
  const characters = uniqueById([
    demoData.characters.page.items || [],
    detailItems(demoData.characters.details),
  ])
  const objects = uniqueById([
    demoData.objects.page.items || [],
    detailItems(demoData.objects.details),
  ])
  const places = uniqueById([
    demoData.places.page.items || [],
    detailItems(demoData.places.details),
  ])
  const spells = uniqueById([
    demoData.spells.page.items || [],
    detailItems(demoData.spells.details),
  ])
  const powers = uniqueById([
    demoData.powers.page.items || [],
    detailItems(demoData.powers.details),
  ])
  const classes = uniqueById([classItems(), detailItems(classDetails())])
  const feats = uniqueById([featItems(), detailItems(featDetails())])
  const campaigns = uniqueById([
    demoData.campaigns.list || [],
    detailItems(demoData.campaigns.details),
  ])

  return {
    personaje: ['character', characters],
    personajes: ['character', characters],
    objeto: ['object', objects],
    objetos: ['object', objects],
    lugar: ['place', places],
    lugares: ['place', places],
    hechizo: ['spell', spells],
    hechizos: ['spell', spells],
    poder: ['power', powers],
    poderes: ['power', powers],
    clase: ['class', classes],
    clases: ['class', classes],
    dote: ['feat', feats],
    dotes: ['feat', feats],
    campana: ['campaign', campaigns],
    campanas: ['campaign', campaigns],
    aventura: ['campaign', campaignNestedItems('aventuras')],
    aventuras: ['campaign', campaignNestedItems('aventuras')],
    arco: ['campaign', campaignNestedItems('arcos')],
    arcos: ['campaign', campaignNestedItems('arcos')],
    partida: ['campaign', campaignNestedItems('partidas')],
    partidas: ['campaign', campaignNestedItems('partidas')],
  }
}

function searchItems(query, limit = 6) {
  const normalizedQuery = normalizeText(query)

  if (!normalizedQuery) {
    return {
      items: [],
      grouped: {},
      meta: { query: normalizedQuery, returned: 0 },
    }
  }

  const sources = {
    character: demoData.characters.page.items || [],
    object: demoData.objects.page.items || [],
    place: demoData.places.page.items || [],
    spell: demoData.spells.page.items || [],
    power: demoData.powers.page.items || [],
    class: classItems(),
    feat: featItems(),
    campaign: demoData.campaigns.list || [],
    user: demoData.users || [],
  }
  const grouped = {}
  const items = []

  for (const [type, values] of Object.entries(sources)) {
    const matches = values
      .filter((item) =>
        normalizeText(item.nombre || item.nombreUsuario || item.name).includes(
          normalizedQuery
        )
      )
      .slice(0, limit)
      .map((item) => resolveSearchEntity(type, item))

    grouped[type] = matches
    items.push(...matches)
  }

  return {
    items,
    grouped,
    meta: {
      query: normalizedQuery,
      perTypeLimit: limit,
      returned: items.length,
    },
  }
}

function wikiTypeToSource(type) {
  return wikiSources()[normalizeText(type)]
}

function wikiSearch(params) {
  const source = wikiTypeToSource(params.get('tipo'))
  const query = normalizeText(params.get('q'))
  const limit = Math.max(1, Math.min(Number(params.get('limit') || 8), 20))

  if (!source) {
    return { items: [] }
  }

  const [entityType, items] = source
  return {
    items: items
      .filter((item) => normalizeText(item.nombre).includes(query))
      .slice(0, limit)
      .map((item) => resolveSearchEntity(entityType, item)),
  }
}

function wikiResolve(body) {
  const references = Array.isArray(body?.referencias) ? body.referencias : []
  const items = references.map((reference) => {
    const [rawType, rawName] = String(reference.key || reference || '').split(
      ':'
    )
    const source = wikiTypeToSource(rawType)

    if (!source || !rawName) {
      return {
        key: reference.key || reference,
        status: 'not_found',
        label: rawName || reference.label || 'Referencia',
      }
    }

    const [entityType, values] = source
    const found = values.find(
      (item) => normalizeText(item.nombre) === normalizeText(rawName)
    )

    if (!found) {
      return {
        key: reference.key || reference,
        status: 'not_found',
        label: rawName,
      }
    }

    return {
      key: reference.key || reference,
      status: 'resolved',
      item: resolveSearchEntity(entityType, found),
    }
  })

  return { items }
}

function campaignContent(campaignId, kind, params) {
  const content = demoData.campaignContent[campaignId]?.[kind]
  return pageFromItems(content?.items || [], params, 30)
}

function collectVersionItems(versionGroups) {
  return Object.entries(versionGroups || {}).flatMap(([baseId, group]) =>
    [
      ...(group.versiones || []),
      ...(group.versionesDerivadas || []),
      ...(group.versionesHermana || []),
    ].map((item) => ({ baseId, item }))
  )
}

function detailWithVersionFallback(section, id, baseIdKey) {
  const directDetail = section.details?.[id]

  if (directDetail) {
    return directDetail
  }

  const version = collectVersionItems(section.versions).find(
    ({ item }) => item?.id === id
  )

  if (!version?.item) {
    return null
  }

  const baseId = version.item[baseIdKey] || version.baseId
  const baseDetail = section.details?.[baseId] || {}

  return {
    ...baseDetail,
    ...version.item,
    puedeEditar: false,
    puedeEliminar: false,
  }
}

function detailOr404(value, config) {
  if (!value) {
    return notFound(config)
  }

  return value
}

function readonlyError(config) {
  const error = new Error(READONLY_MESSAGE)
  error.response = {
    status: 403,
    statusText: 'Forbidden',
    config,
    headers: {},
    data: { message: READONLY_MESSAGE, demoMode: true },
  }
  throw error
}

function notFound(config, message = 'Contenido no disponible en la demo.') {
  const error = new Error(message)
  error.response = {
    status: 404,
    statusText: 'Not Found',
    config,
    headers: {},
    data: { message },
  }
  throw error
}

function ok(config, data, status = 200) {
  return {
    data: clone(data),
    status,
    statusText: status === 201 ? 'Created' : 'OK',
    headers: {},
    config,
    request: null,
  }
}

function parseBody(data) {
  if (!data) {
    return null
  }

  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  return data
}

function handleRead(path, params, config) {
  if (path === '/users/me') return { usuario: demoUser }
  if (path === '/users/me/characters')
    return pageFromItems(demoData.characters.page.items || [], params)
  if (path === '/users/me/objects')
    return pageFromItems(demoData.objects.page.items || [], params)
  if (path === '/users/me/places')
    return pageFromItems(demoData.places.page.items || [], params)
  if (path === '/users/me/spells')
    return pageFromItems(demoData.spells.page.items || [], params)
  if (path === '/users/me/powers')
    return pageFromItems(demoData.powers.page.items || [], params)
  if (path === '/users/me/campaigns')
    return { items: demoData.campaigns.list || [] }
  if (path === '/users/me/saved-traits') return { items: [] }

  if (path === '/notifications/summary') return { total: 0, unreadCount: 0 }
  if (path === '/notifications')
    return { items: [], meta: { total: 0, unreadCount: 0 } }
  if (path === '/comments/personaje' || path === '/comments/objeto')
    return { items: [] }
  if (path.startsWith('/comments/')) return { items: [], meta: { total: 0 } }

  if (path === '/favorites') return { items: [], meta: { total: 0 } }
  const favoriteMatch = path.match(/^\/favorites\/([^/]+)\/([^/]+)$/u)
  if (favoriteMatch) {
    return {
      favorito: demoFavorites.has(
        favoriteKey(favoriteMatch[1], favoriteMatch[2])
      ),
    }
  }

  if (path === '/search')
    return searchItems(params.get('q'), Number(params.get('limit') || 6))
  if (path === '/wiki/search') return wikiSearch(params)

  if (path === '/campaigns') return { items: demoData.campaigns.list || [] }
  if (path === '/campaigns/user-options') {
    return {
      items: (demoData.users || []).filter(
        (user) => user.rol?.codigo !== 'administrador'
      ),
    }
  }
  const campaignMatch = path.match(/^\/campaigns\/([^/]+)$/u)
  if (campaignMatch)
    return detailOr404(demoData.campaigns.details[campaignMatch[1]], config)
  const campaignSessionMatch = path.match(
    /^\/campaigns\/([^/]+)\/sessions\/([^/]+)\/detail$/u
  )
  if (campaignSessionMatch) {
    const detail = detailOr404(
      demoData.campaigns.details[campaignSessionMatch[1]],
      config
    )
    const session = detail.partidas?.find(
      (item) => item.id === campaignSessionMatch[2]
    )

    return {
      item: detailOr404(
        session
          ? {
              ...session,
              puedeGestionar: false,
              campana: detail.item
                ? { id: detail.item.id, nombre: detail.item.nombre }
                : null,
              galeriaImagenes: [],
              temasMusicales: [],
              personajes: [],
              combates: [],
            }
          : null,
        config
      ),
    }
  }
  const campaignItemsMatch = path.match(
    /^\/campaigns\/([^/]+)\/(characters|objects|places|spells|powers)$/u
  )
  if (campaignItemsMatch) {
    return campaignContent(campaignItemsMatch[1], campaignItemsMatch[2], params)
  }

  if (path === '/characters') return characterPage(params)
  if (path === '/characters/recent')
    return pageFromItems(demoData.characters.recent.items || [], params, 20)
  if (path === '/characters/archive/options') return demoData.characterOptions
  if (path === '/characters/editor/new')
    return demoData.characters.creationEditor
  if (path === '/characters/editor/linkable-objects')
    return { items: demoData.characters.linkableObjects || [] }
  if (path === '/characters/editor/linkable-powers')
    return { items: demoData.characters.linkablePowers || [] }
  const characterEditorMatch = path.match(/^\/characters\/([^/]+)\/editor$/u)
  if (characterEditorMatch)
    return (
      demoData.characters.editors[characterEditorMatch[1]] || notFound(config)
    )
  const characterVersionsMatch = path.match(
    /^\/characters\/([^/]+)\/versions$/u
  )
  if (characterVersionsMatch)
    return (
      demoData.characters.versions[characterVersionsMatch[1]] || {
        versiones: [],
      }
    )
  const characterMatch = path.match(/^\/characters\/([^/]+)$/u)
  if (characterMatch)
    return {
      item: detailOr404(
        detailWithVersionFallback(
          demoData.characters,
          characterMatch[1],
          'personajeBaseId'
        ),
        config
      ),
    }

  if (path === '/objects')
    return pageFromItems(demoData.objects.page.items || [], params)
  if (path === '/objects/archive/options') return demoData.objectOptions
  if (path === '/objects/editor/new') return demoData.objects.creationEditor
  const objectEditorMatch = path.match(/^\/objects\/([^/]+)\/editor$/u)
  if (objectEditorMatch)
    return demoData.objects.editors[objectEditorMatch[1]] || notFound(config)
  const objectVersionsMatch = path.match(/^\/objects\/([^/]+)\/versions$/u)
  if (objectVersionsMatch)
    return (
      demoData.objects.versions[objectVersionsMatch[1]] || { versiones: [] }
    )
  const objectMatch = path.match(/^\/objects\/([^/]+)$/u)
  if (objectMatch)
    return {
      item: detailOr404(
        detailWithVersionFallback(
          demoData.objects,
          objectMatch[1],
          'objetoBaseId'
        ),
        config
      ),
    }

  if (path === '/places')
    return pageFromItems(demoData.places.page.items || [], params)
  if (path === '/places/archive/options') return demoData.placeOptions
  if (path === '/places/editor/new') return demoData.places.creationEditor
  if (path === '/places/editor/own-places') return demoData.places.ownPlaces
  if (path === '/places/editor/own-place-trees')
    return demoData.places.ownPlaceTrees
  const placeEditorMatch = path.match(/^\/places\/([^/]+)\/editor$/u)
  if (placeEditorMatch)
    return demoData.places.editors[placeEditorMatch[1]] || notFound(config)
  const placeVersionsMatch = path.match(/^\/places\/([^/]+)\/versions$/u)
  if (placeVersionsMatch)
    return demoData.places.versions[placeVersionsMatch[1]] || { versiones: [] }
  const placeGraphMatch = path.match(/^\/places\/([^/]+)\/graph$/u)
  if (placeGraphMatch)
    return (
      demoData.places.graphs[placeGraphMatch[1]] || { nodes: [], edges: [] }
    )
  const placeMatch = path.match(/^\/places\/([^/]+)$/u)
  if (placeMatch)
    return { item: detailOr404(demoData.places.details[placeMatch[1]], config) }

  if (path === '/powers')
    return pageFromItems(demoData.powers.page.items || [], params)
  if (path === '/powers/options') return demoData.powerOptions
  const powerMatch = path.match(/^\/powers\/([^/]+)$/u)
  if (powerMatch)
    return detailOr404(demoData.powers.details[powerMatch[1]], config)

  if (path === '/spells') return spellPage(params)
  if (path === '/spells/options') return demoData.spellOptions
  const spellMatch = path.match(/^\/spells\/([^/]+)$/u)
  if (spellMatch)
    return detailOr404(demoData.spells.details[spellMatch[1]], config)

  if (path === '/classes') return pageFromItems(classItems(), params)
  if (path === '/classes/options') return demoData.classOptions
  const subclassMatch = path.match(/^\/classes\/([^/]+)\/subclases\/([^/]+)$/u)
  if (subclassMatch) {
    return detailOr404(
      classSubclasses()[`${subclassMatch[1]}:${subclassMatch[2]}`],
      config
    )
  }
  const classMatch = path.match(/^\/classes\/([^/]+)$/u)
  if (classMatch) return detailOr404(classDetails()[classMatch[1]], config)

  if (path === '/feats') return pageFromItems(featItems(), params)
  if (path === '/feats/options') return demoData.featOptions
  const featMatch = path.match(/^\/feats\/([^/]+)$/u)
  if (featMatch) return detailOr404(featDetails()[featMatch[1]], config)

  const publicProfileMatch = path.match(/^\/users\/([^/]+)\/public-profile$/u)
  if (publicProfileMatch) {
    return {
      item: detailOr404(demoData.publicProfiles[publicProfileMatch[1]], config),
      entradas: {
        personajes: publicProfilePage(demoData.characters.page.items, params),
        objetos: publicProfilePage(demoData.objects.page.items, params),
        lugares: publicProfilePage(demoData.places.page.items, params),
        hechizos: publicProfilePage(demoData.spells.page.items, params),
        poderes: publicProfilePage(demoData.powers.page.items, params),
      },
    }
  }
  const publicProfileListMatch = path.match(
    /^\/users\/([^/]+)\/public-profile\/(characters|objects|places|spells|powers)$/u
  )
  if (publicProfileListMatch) {
    const source = {
      characters: demoData.characters.page.items,
      objects: demoData.objects.page.items,
      places: demoData.places.page.items,
      spells: demoData.spells.page.items,
      powers: demoData.powers.page.items,
    }[publicProfileListMatch[2]]

    return pageFromItems(source || [], params)
  }
  if (path === '/users/me/public-profile/editor') {
    return {
      item: {
        ...(demoData.publicProfiles[demoUser.id] || {}),
        opciones: {
          personajes: demoData.characters.page.items || [],
          objetos: demoData.objects.page.items || [],
          lugares: demoData.places.page.items || [],
          hechizos: demoData.spells.page.items || [],
          poderes: demoData.powers.page.items || [],
        },
      },
    }
  }

  return notFound(config)
}

function handleWrite(path, config) {
  const body = parseBody(config.data)

  if (path === '/auth/login' || path === '/auth/register') {
    return { token: 'wikicodex-demo-token', usuario: demoUser }
  }

  if (path === '/auth/logout') {
    return { ok: true }
  }

  if (path === '/auth/admin-session/rotate') {
    return { token: 'wikicodex-demo-token', usuario: demoUser }
  }

  if (path === '/users/me' && String(config.method).toLowerCase() === 'patch') {
    demoUser = {
      ...demoUser,
      ...(body.nombreUsuario ? { nombreUsuario: body.nombreUsuario } : {}),
      ...(body.imagenPerfilUrl !== undefined
        ? { imagenPerfilUrl: body.imagenPerfilUrl }
        : {}),
      ...(body.temaModo ? { temaModo: body.temaModo } : {}),
      ...(body.temaColorHex ? { temaColorHex: body.temaColorHex } : {}),
      ...(body.modoVisualFichas
        ? { modoVisualFichas: body.modoVisualFichas }
        : {}),
    }
    writeJsonStorage(DEMO_USER_STORAGE_KEY, demoUser)
    return { usuario: demoUser }
  }

  if (path === '/wiki/resolve') {
    return wikiResolve(body)
  }

  const favoriteMatch = path.match(/^\/favorites\/([^/]+)\/([^/]+)$/u)
  if (favoriteMatch && String(config.method).toLowerCase() === 'put') {
    const key = favoriteKey(favoriteMatch[1], favoriteMatch[2])
    if (body?.favorito) {
      demoFavorites.add(key)
    } else {
      demoFavorites.delete(key)
    }
    saveFavorites()
    return { favorito: demoFavorites.has(key) }
  }

  if (
    String(config.method).toLowerCase() === 'delete' &&
    path.startsWith('/notifications')
  ) {
    return { ok: true }
  }

  return readonlyError(config)
}

export function createDemoAdapter() {
  return async function demoAdapter(config) {
    const method = String(config.method || 'get').toLowerCase()
    const { path, params } = toParams(config)

    await new Promise((resolve) => window.setTimeout(resolve, 60))

    if (method === 'get') {
      return ok(config, handleRead(path, params, config))
    }

    return ok(config, handleWrite(path, config))
  }
}
