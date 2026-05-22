const { createHttpError } = require('../lib/errors')
const { prisma } = require('../lib/prisma')
const { serializeVisibleUser } = require('../lib/user-visibility')

const WIKICODEX_CAMPAIGN_FILTER_ID = '__wikicodex'
const NO_CAMPAIGN_SELECTION_FILTER_ID = '__none'
const NO_CLASS_SELECTION_FILTER_ID = '__none'
const SPELL_LEVELS = Array.from({ length: 11 }, (_, index) => index)
const SPELL_SCHOOLS = [
  'Abjuración',
  'Adivinación',
  'Conjuración',
  'Encantamiento',
  'Evocación',
  'Ilusión',
  'Nigromancia',
  'Transmutación',
  'Psionico',
]
const SPELL_CLASSES = [
  'Mago',
  'Druida',
  'Hechicero',
  'Clérigo',
  'Paladín',
  'Brujo',
  'Explorador',
  'Artificiero',
  'Bloodhunter',
  'Pícaro',
  'Guerrero',
  'Bárbaro',
  'Monje',
  'Psíquico',
]
const SPELL_DURATIONS = [
  'Instantáneo',
  '1 ronda',
  '1 minuto',
  '10 minutos',
  '1 hora',
  '8 horas',
  '24 horas',
  'Permanente',
  'Personalizado',
]
const SPELL_CASTING_TYPES = [
  'Acción',
  'Acción adicional',
  'Reacción',
  'Acción Gratuita',
  'Rondas',
  'Minutos',
  'Horas',
]
const SPELL_ATTACK_TYPES = ['Melee', 'Rango']
const SPELL_DAMAGE_TYPES = [
  'Cortante',
  'Perforante',
  'Contundente',
  'Fuego',
  'Frío',
  'Ácido',
  'Veneno',
  'Radiante',
  'Necrótico',
  'Rayo',
  'Trueno',
  'Fuerza',
  'Psíquico',
]
const SPELL_CONDITIONS = [
  'Cegado',
  'Ensordecido',
  'Encantado',
  'Exausto',
  'Asustado',
  'Agarrado',
  'Apresado',
  'Incapacitado',
  'Inmovilizado',
  'Invisible',
  'Petrificado',
  'Aturdido',
  'Derribado',
  'Inconsciente',
  'Envenenado',
  'Sangrado',
]
const SPELL_MISC_TAGS = [
  'Concentración',
  'Verbal',
  'Somático',
  'Material',
  'Material con Coste',
  'El material se consume',
  'El material se consume opcionalmente',
  'Curación',
  'Otorga Puntos de Golpe Temporales',
  'Requiere Visión',
  'Efectos Permanentes',
  'Efectos de Escalado',
  'Objetivos de Escalado',
  'Invoca Criatura',
  'Modifica CA',
  'Teletransportación',
  'Movimiento Forzado',
  'Efectos Aleatorios',
  'Crea Luz Solar',
  'Crea Luz',
  'Usa Acción Adicional',
  'Cambio de Plano',
  'Oscurece la Visión',
  'Terreno Difícil',
  'Daño de Ataque Adicional',
  'Afecta Objetos',
  'Otorga Ventaja',
  'Permanente si se repite',
  'Tiene Imágenes',
  'Tiene Información',
  'Ritual',
]
const SPELL_SAVES = [
  'Salvación de Fuerza',
  'Salvación de Destreza',
  'Salvación de Constitución',
  'Salvación de Inteligencia',
  'Salvación de Sabiduría',
  'Salvación de Carisma',
]
const SPELL_CHECKS = [
  'Prueba de Fuerza',
  'Prueba de Destreza',
  'Prueba de Constitución',
  'Prueba de Inteligencia',
  'Prueba de Sabiduría',
  'Prueba de Carisma',
]
const SPELL_RANGES = [
  'A ti mismo',
  'Toque',
  'Punto',
  'Área',
  'Área (uno mismo)',
]
const SPELL_AREA_STYLES = [
  'Objetivo Único',
  'Múltiples Objetivos',
  'Círculo',
  'Cono',
  'Cubo',
  'Cilindro',
  'Hemisferio',
  'Emanación',
  'Línea',
  'Esfera',
  'Cuadrado',
  'Muro',
]
const SPELL_CREATURE_TYPES = [
  'Aberración',
  'Bestia',
  'Celestial',
  'Constructo',
  'Dragón',
  'Elemental',
  'Feérico',
  'Infernal',
  'Gigante',
  'Humanoide',
  'Monstruosidad',
  'Limo',
  'Planta',
  'No Muerto',
]
function normalizeSpellText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(value.map((item) => String(item || '').trim()).filter(Boolean)),
  ]
}

function normalizeFilterList(value) {
  if (Array.isArray(value)) {
    return normalizeArray(value)
  }

  return normalizeArray(String(value || '').split('|'))
}

function normalizeNumberFilterList(value) {
  return normalizeFilterList(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 10)
}

function splitCampaignFilterValues(value) {
  const selectedIds = normalizeFilterList(value)

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

function pushNumberFilterChecks(checks, value, selectedValues) {
  const normalizedValue = Number(value || 0)

  selectedValues.forEach((selectedValue) => {
    checks.push(normalizedValue === selectedValue)
  })
}

function pushScalarTextFilterChecks(checks, value, selectedValues) {
  const normalizedValue = normalizeSpellText(value)

  selectedValues.forEach((selectedValue) => {
    checks.push(
      Boolean(normalizedValue) &&
        normalizedValue === normalizeSpellText(selectedValue)
    )
  })
}

function pushArrayTextFilterChecks(checks, values, selectedValues) {
  const normalizedValues = new Set(
    normalizeArray(values).map(normalizeSpellText)
  )

  selectedValues.forEach((selectedValue) => {
    checks.push(normalizedValues.has(normalizeSpellText(selectedValue)))
  })
}

function pushSaveOrCheckFilterChecks(checks, spell, selectedValues) {
  const normalizedSave = normalizeSpellText(spell.tipo_salvacion)
  const normalizedCheck = normalizeSpellText(spell.prueba_habilidad)

  selectedValues.forEach((selectedValue) => {
    const normalizedSelected = normalizeSpellText(selectedValue)
    checks.push(
      Boolean(normalizedSelected) &&
        (normalizedSave === normalizedSelected ||
          normalizedCheck === normalizedSelected)
    )
  })
}

function spellMatchesAdvancedFilters(spell, filters = {}) {
  const matchMode = filters.matchMode === 'any' ? 'any' : 'all'
  const checks = []

  pushNumberFilterChecks(
    checks,
    spell.nivel,
    normalizeNumberFilterList(filters.niveles || filters.nivel)
  )
  pushScalarTextFilterChecks(
    checks,
    spell.escuela,
    normalizeFilterList(filters.escuelas || filters.escuela)
  )
  pushArrayTextFilterChecks(
    checks,
    spell.clases,
    normalizeFilterList(filters.clases || filters.clase)
  )
  pushArrayTextFilterChecks(
    checks,
    spell.tipos_dano,
    normalizeFilterList(filters.tiposDano)
  )
  pushArrayTextFilterChecks(
    checks,
    spell.condiciones,
    normalizeFilterList(filters.condiciones)
  )
  pushArrayTextFilterChecks(
    checks,
    spell.miscelanea,
    normalizeFilterList(filters.miscelanea)
  )
  pushScalarTextFilterChecks(
    checks,
    spell.tipo_casteo,
    normalizeFilterList(filters.tiposCasteo)
  )
  pushSaveOrCheckFilterChecks(
    checks,
    spell,
    normalizeFilterList(filters.pruebasSalvaciones)
  )

  if (!checks.length) {
    return true
  }

  return matchMode === 'any' ? checks.some(Boolean) : checks.every(Boolean)
}

function spellMatchesCampaignFilters(spell, filters = {}) {
  const { campaignIds, includeUnscoped, hasNoSelection } =
    splitCampaignFilterValues(filters.campaignIds)

  if (hasNoSelection) {
    return false
  }

  if (!campaignIds.length && !includeUnscoped) {
    return true
  }

  const linkedCampaignIds = new Set(
    (spell.hechizo_campanas || [])
      .map((link) => link.campana_id || link.campanas?.id)
      .filter(Boolean)
  )

  return (
    campaignIds.some((campaignId) => linkedCampaignIds.has(campaignId)) ||
    (includeUnscoped && linkedCampaignIds.size === 0)
  )
}

function spellMatchesIndependentClassFilters(spell, filters = {}) {
  const selectedClasses = normalizeFilterList(filters.classFilters)

  if (selectedClasses.includes(NO_CLASS_SELECTION_FILTER_ID)) {
    return false
  }

  if (!selectedClasses.length) {
    return true
  }

  const spellClasses = new Set(
    normalizeArray(spell.clases).map(normalizeSpellText)
  )

  return selectedClasses.some((className) =>
    spellClasses.has(normalizeSpellText(className))
  )
}

function normalizeComponents(value = {}) {
  return {
    verbal: Boolean(value.verbal),
    somatico: Boolean(value.somatico),
    material: value.material?.trim?.() || '',
    consumeMaterial: Boolean(value.consumeMaterial),
  }
}

function getSpellVisibilityWhere(userId, roleCode) {
  if (roleCode === 'administrador') {
    return {}
  }

  return {
    OR: [
      { es_publico: true },
      { creado_por_usuario_id: userId },
      { hechizos_guardados_usuario: { some: { usuario_id: userId } } },
      {
        personaje_hechizos: {
          some: {
            personajes: {
              campanas: { master_usuario_id: userId },
            },
          },
        },
      },
      {
        objeto_hechizos: {
          some: {
            objetos: {
              OR: [
                { creado_por_usuario_id: userId },
                {
                  objeto_campanas: {
                    some: { campanas: { master_usuario_id: userId } },
                  },
                },
                { campanas: { master_usuario_id: userId } },
              ],
            },
          },
        },
      },
      {
        hechizo_campanas: { some: { campanas: { master_usuario_id: userId } } },
      },
      {
        hechizo_campanas: {
          some: {
            campanas: {
              campana_jugadores: { some: { usuario_id: userId } },
            },
          },
        },
      },
    ],
  }
}

function serializeSpell(spell, userId, roleCode = null) {
  return {
    id: spell.id,
    nombre: spell.nombre,
    nivel: spell.nivel,
    escuela: spell.escuela,
    alcancePies:
      spell.alcance_pies === null || spell.alcance_pies === undefined
        ? null
        : Number(spell.alcance_pies),
    componentes: spell.componentes || {},
    duracion: spell.duracion,
    duracionPersonalizada: spell.duracion_personalizada,
    clases: spell.clases || [],
    tipoCasteo: spell.tipo_casteo,
    concentracion: spell.concentracion,
    tipoAtaque: spell.tipo_ataque,
    tiposDano: spell.tipos_dano || [],
    condiciones: spell.condiciones || [],
    miscelanea: spell.miscelanea || [],
    tipoSalvacion: spell.tipo_salvacion,
    pruebaHabilidad: spell.prueba_habilidad,
    rango: spell.rango,
    estiloArea: spell.estilo_area,
    criaturasAfectadas: spell.criaturas_afectadas || [],
    descripcion: spell.descripcion,
    descripcionHtml: spell.descripcion_html,
    fuente: spell.fuente,
    origen: spell.origen,
    esPublico: spell.es_publico,
    creadoPorUsuarioId: spell.creado_por_usuario_id,
    creadoPor: serializeVisibleUser(spell.usuarios),
    creadoEn: spell.creado_en,
    actualizadoEn: spell.actualizado_en,
    campanas: (spell.hechizo_campanas || []).map((relation) => ({
      id: relation.campanas.id,
      nombre: relation.campanas.nombre,
    })),
    estaGuardado: Boolean(spell.hechizos_guardados_usuario?.length),
    puedeEditar:
      Boolean(userId && spell.creado_por_usuario_id === userId) ||
      roleCode === 'administrador',
  }
}

function buildSpellData(payload, userId) {
  const nombre = payload.nombre?.trim()

  if (!nombre) {
    throw createHttpError(400, 'El hechizo necesita un nombre.')
  }

  return {
    creado_por_usuario_id: userId || null,
    nombre,
    nombre_normalizado: normalizeSpellText(nombre),
    nivel: Number(payload.nivel || 0),
    escuela: payload.escuela?.trim() || null,
    alcance_pies:
      payload.alcancePies === null ||
      payload.alcancePies === undefined ||
      payload.alcancePies === ''
        ? null
        : BigInt(payload.alcancePies),
    componentes: normalizeComponents(payload.componentes),
    duracion: payload.duracion?.trim() || null,
    duracion_personalizada: payload.duracionPersonalizada?.trim() || null,
    clases: normalizeArray(payload.clases),
    tipo_casteo: payload.tipoCasteo?.trim() || null,
    concentracion: Boolean(payload.concentracion),
    tipo_ataque: payload.tipoAtaque?.trim() || null,
    tipos_dano: normalizeArray(payload.tiposDano),
    condiciones: normalizeArray(payload.condiciones),
    miscelanea: normalizeArray(payload.miscelanea),
    tipo_salvacion: payload.tipoSalvacion?.trim() || null,
    prueba_habilidad: payload.pruebaHabilidad?.trim() || null,
    rango: payload.rango?.trim() || null,
    estilo_area: payload.estiloArea?.trim() || null,
    criaturas_afectadas: normalizeArray(payload.criaturasAfectadas),
    descripcion: payload.descripcion?.trim() || null,
    descripcion_html: payload.descripcionHtml?.trim() || null,
    fuente: payload.fuente?.trim() || null,
    origen: payload.origen?.trim() || 'usuario',
    es_publico: payload.esPublico !== false,
  }
}

async function listSpells({ req, limit = 80, cursor = 0, filters = {} }) {
  const safeLimit = Math.max(1, Math.min(limit, 250))
  const safeCursor = Math.max(0, cursor || 0)
  const visibilityWhere = getSpellVisibilityWhere(
    req.auth.userId,
    req.auth.roleCode
  )
  const and = [visibilityWhere]

  if (filters.q) {
    and.push({
      nombre_normalizado: { contains: normalizeSpellText(filters.q) },
    })
  }

  // Nivel y escuela se filtran en memoria para que "todas" y "al menos una"
  // compartan exactamente el mismo criterio combinatorio.

  if (filters.campaignId) {
    and.push({
      hechizo_campanas: { some: { campana_id: filters.campaignId } },
    })
  }

  if (filters.onlySaved) {
    and.push({
      hechizos_guardados_usuario: { some: { usuario_id: req.auth.userId } },
    })
  }

  if (filters.createdByUserId) {
    and.push({
      creado_por_usuario_id: filters.createdByUserId,
    })
  }

  const where = { AND: and }
  const spells = await prisma.hechizos.findMany({
    where,
    orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }],
    include: {
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
      hechizos_guardados_usuario: {
        where: { usuario_id: req.auth.userId },
        select: { id: true },
      },
      hechizo_campanas: {
        include: {
          campanas: {
            select: { id: true, nombre: true },
          },
        },
      },
    },
  })

  const filteredSpells = spells.filter(
    (spell) =>
      spellMatchesCampaignFilters(spell, filters) &&
      spellMatchesIndependentClassFilters(spell, filters) &&
      spellMatchesAdvancedFilters(spell, filters)
  )
  const paginatedSpells = filteredSpells.slice(
    safeCursor,
    safeCursor + safeLimit
  )
  const items = paginatedSpells.map((spell) =>
    serializeSpell(spell, req.auth.userId, req.auth.roleCode)
  )

  return {
    items,
    meta: {
      totalVisible: filteredSpells.length,
      returned: items.length,
      limit: safeLimit,
      cursor: safeCursor,
      nextCursor:
        safeCursor + paginatedSpells.length < filteredSpells.length
          ? String(safeCursor + paginatedSpells.length)
          : null,
    },
  }
}

async function requireSpellViewAccess({ spellId, req }) {
  const spell = await prisma.hechizos.findFirst({
    where: {
      id: spellId,
      AND: [getSpellVisibilityWhere(req.auth.userId, req.auth.roleCode)],
    },
    include: {
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
      hechizos_guardados_usuario: {
        where: { usuario_id: req.auth.userId },
        select: { id: true },
      },
      hechizo_campanas: {
        include: {
          campanas: {
            select: { id: true, nombre: true },
          },
        },
      },
    },
  })

  if (!spell) {
    throw createHttpError(404, 'El hechizo indicado no existe o no es visible.')
  }

  return spell
}

async function getSpellDetail({ spellId, req }) {
  const spell = await requireSpellViewAccess({ spellId, req })
  return serializeSpell(spell, req.auth.userId, req.auth.roleCode)
}

async function requireSpellEditAccess({ spellId, req }) {
  const spell = await requireSpellViewAccess({ spellId, req })
  const canEdit =
    req.auth.roleCode === 'administrador' ||
    spell.creado_por_usuario_id === req.auth.userId

  if (!canEdit) {
    throw createHttpError(403, 'No tienes permiso para editar este hechizo.')
  }

  return spell
}

async function getManageableCampaignIds(req, campaignIds = []) {
  const ids = normalizeArray(campaignIds)

  if (!ids.length) {
    return []
  }

  const campaigns = await prisma.campanas.findMany({
    where:
      req.auth.roleCode === 'administrador'
        ? { id: { in: ids } }
        : {
            id: { in: ids },
            master_usuario_id: req.auth.userId,
          },
    select: { id: true },
  })

  return campaigns.map((campaign) => campaign.id)
}

async function collectFilteredSpellIds(req, filters = {}) {
  const ids = []
  let cursor = 0

  for (let guard = 0; guard < 40; guard += 1) {
    const result = await listSpells({
      req,
      limit: 250,
      cursor,
      filters,
    })

    ids.push(...result.items.map((item) => item.id))

    if (!result.meta.nextCursor) {
      return ids
    }

    cursor = Number(result.meta.nextCursor)
  }

  return ids
}

async function createSpell({ req, payload }) {
  const spell = await prisma.hechizos.create({
    data: buildSpellData(payload, req.auth.userId),
  })

  const campaignIds = await getManageableCampaignIds(req, payload.campanaIds)

  if (campaignIds.length) {
    await prisma.hechizo_campanas.createMany({
      data: campaignIds.map((campaignId) => ({
        hechizo_id: spell.id,
        campana_id: campaignId,
      })),
      skipDuplicates: true,
    })
  }

  await prisma.hechizos_guardados_usuario.create({
    data: {
      usuario_id: req.auth.userId,
      hechizo_id: spell.id,
    },
  })

  return getSpellDetail({ spellId: spell.id, req })
}

async function updateSpell({ req, spellId, payload }) {
  await requireSpellEditAccess({ spellId, req })

  await prisma.hechizos.update({
    where: { id: spellId },
    data: {
      ...buildSpellData(payload, req.auth.userId),
      creado_por_usuario_id: undefined,
      origen: undefined,
      actualizado_en: new Date(),
    },
  })

  const campaignIds = await getManageableCampaignIds(req, payload.campanaIds)

  await prisma.hechizo_campanas.deleteMany({
    where: { hechizo_id: spellId },
  })

  if (campaignIds.length) {
    await prisma.hechizo_campanas.createMany({
      data: campaignIds.map((campaignId) => ({
        hechizo_id: spellId,
        campana_id: campaignId,
      })),
      skipDuplicates: true,
    })
  }

  return getSpellDetail({ spellId, req })
}

async function deleteSpell({ req, spellId }) {
  const spell = await requireSpellEditAccess({ spellId, req })

  if (spell.origen === 'sistema') {
    throw createHttpError(
      409,
      'Los hechizos de sistema estan protegidos y no se pueden borrar desde la aplicacion.'
    )
  }

  await prisma.hechizos.delete({
    where: { id: spellId },
  })

  return { eliminado: true }
}

async function setSpellSaved({ req, spellId, saved }) {
  await requireSpellViewAccess({ spellId, req })

  if (!saved) {
    await prisma.hechizos_guardados_usuario.deleteMany({
      where: {
        usuario_id: req.auth.userId,
        hechizo_id: spellId,
      },
    })
    return { guardado: false }
  }

  await prisma.hechizos_guardados_usuario.upsert({
    where: {
      usuario_id_hechizo_id: {
        usuario_id: req.auth.userId,
        hechizo_id: spellId,
      },
    },
    update: {},
    create: {
      usuario_id: req.auth.userId,
      hechizo_id: spellId,
    },
  })

  return { guardado: true }
}

async function saveSpellGroup({ req, filters }) {
  const shouldSave = filters.guardado !== false
  const publicIds = await collectFilteredSpellIds(req, {
    ...filters,
    onlySaved: false,
  })

  if (!publicIds.length) {
    return { actualizados: 0, guardados: 0, quitados: 0 }
  }

  if (!shouldSave) {
    const result = await prisma.hechizos_guardados_usuario.deleteMany({
      where: {
        usuario_id: req.auth.userId,
        hechizo_id: { in: publicIds },
      },
    })

    return {
      actualizados: result.count,
      guardados: 0,
      quitados: result.count,
    }
  }

  await prisma.hechizos_guardados_usuario.createMany({
    data: publicIds.map((spellId) => ({
      usuario_id: req.auth.userId,
      hechizo_id: spellId,
    })),
    skipDuplicates: true,
  })

  return {
    actualizados: publicIds.length,
    guardados: publicIds.length,
    quitados: 0,
  }
}

async function getSavedSpellsForEditor(userId) {
  const saved = await prisma.hechizos_guardados_usuario.findMany({
    where: { usuario_id: userId },
    orderBy: [{ hechizos: { nivel: 'asc' } }, { hechizos: { nombre: 'asc' } }],
    include: {
      hechizos: {
        include: {
          hechizos_guardados_usuario: {
            where: { usuario_id: userId },
            select: { id: true },
          },
        },
      },
    },
  })

  return saved.map((item) => serializeSpell(item.hechizos, userId))
}

async function getSpellCatalogOptions({ req }) {
  const visibleSpells = await prisma.hechizos.findMany({
    where: getSpellVisibilityWhere(req.auth.userId, req.auth.roleCode),
    select: {
      escuela: true,
      clases: true,
      duracion: true,
      tipo_casteo: true,
      tipo_ataque: true,
      tipos_dano: true,
      condiciones: true,
      miscelanea: true,
      tipo_salvacion: true,
      prueba_habilidad: true,
      rango: true,
      estilo_area: true,
      criaturas_afectadas: true,
    },
  })
  const mergeOptions = (staticValues, dynamicValues) =>
    [
      ...new Set(
        [...staticValues, ...dynamicValues]
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      ),
    ].sort((left, right) => left.localeCompare(right))
  const collectScalar = (fieldName) =>
    visibleSpells.map((spell) => spell[fieldName]).filter(Boolean)
  const collectArray = (fieldName) =>
    visibleSpells.flatMap((spell) => normalizeArray(spell[fieldName]))
  const dynamicSaves = collectScalar('tipo_salvacion').filter((value) =>
    normalizeSpellText(value).startsWith('salvacion de ')
  )

  return {
    niveles: SPELL_LEVELS,
    escuelas: mergeOptions(SPELL_SCHOOLS, collectScalar('escuela')),
    clases: mergeOptions(SPELL_CLASSES, collectArray('clases')),
    duraciones: mergeOptions(SPELL_DURATIONS, collectScalar('duracion')),
    tiposCasteo: mergeOptions(
      SPELL_CASTING_TYPES,
      collectScalar('tipo_casteo')
    ),
    tiposAtaque: mergeOptions(SPELL_ATTACK_TYPES, collectScalar('tipo_ataque')),
    tiposDano: mergeOptions(SPELL_DAMAGE_TYPES, collectArray('tipos_dano')),
    condiciones: mergeOptions(SPELL_CONDITIONS, collectArray('condiciones')),
    miscelanea: mergeOptions(SPELL_MISC_TAGS, collectArray('miscelanea')),
    salvaciones: mergeOptions(SPELL_SAVES, dynamicSaves),
    pruebasHabilidad: mergeOptions(
      SPELL_CHECKS,
      collectScalar('prueba_habilidad')
    ),
    pruebasSalvaciones: mergeOptions(
      [...SPELL_SAVES, ...SPELL_CHECKS],
      [...dynamicSaves, ...collectScalar('prueba_habilidad')]
    ),
    rangos: mergeOptions(SPELL_RANGES, collectScalar('rango')),
    estilosArea: mergeOptions(SPELL_AREA_STYLES, collectScalar('estilo_area')),
    criaturas: mergeOptions(
      SPELL_CREATURE_TYPES,
      collectArray('criaturas_afectadas')
    ),
  }
}

module.exports = {
  createSpell,
  deleteSpell,
  getSavedSpellsForEditor,
  getSpellCatalogOptions,
  getSpellDetail,
  getSpellVisibilityWhere,
  listSpells,
  normalizeSpellText,
  saveSpellGroup,
  serializeSpell,
  setSpellSaved,
  updateSpell,
}
