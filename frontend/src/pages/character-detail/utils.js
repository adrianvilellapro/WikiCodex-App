import {
  abilityScoreEntries,
  CHARACTER_NAME_MAX_LENGTH,
  CHARACTER_TITLE_MAX_LENGTH,
  CLASS_NAME_MAX_LENGTH,
  MAX_ABILITY_SCORE,
  MAX_CLASS_LEVEL,
  MAX_DECIMAL_GENERAL,
  MAX_SAVING_THROW,
  MAX_SHEET_COMPETENCE,
  MAX_SHEET_GENERAL_INTEGER,
  MAX_SHEET_SPEED_INTEGER,
  SUBCLASS_NAME_MAX_LENGTH,
  traitTypeDisplayConfig,
} from './constants'
import {
  isSkillTraitGroupName,
  parseSkillTrait,
  SKILL_TOTAL_LIMIT,
} from './skills'
import {
  ensureActionStatsTraitInGroup,
  getVisibleActionStats,
  isActionStatsTrait,
  parseActionStatsTrait,
} from './actions'

export function getDraftStorageKey(characterId) {
  return `wikicodex:character-editor-draft:${characterId}`
}

export function getDraftReloadStorageKey(characterId) {
  return `wikicodex:character-editor-reload:${characterId}`
}

export function markDraftReloadResume(characterId) {
  window.sessionStorage.setItem(
    getDraftReloadStorageKey(characterId),
    JSON.stringify({
      characterId,
      createdAt: Date.now(),
    })
  )
}

export function clearDraftReloadResume(characterId) {
  window.sessionStorage.removeItem(getDraftReloadStorageKey(characterId))
}

export function consumeDraftReloadResume(characterId) {
  const storageKey = getDraftReloadStorageKey(characterId)
  const storedValue = window.sessionStorage.getItem(storageKey)

  if (!storedValue) {
    return false
  }

  window.sessionStorage.removeItem(storageKey)

  try {
    const parsed = JSON.parse(storedValue)
    return parsed?.characterId === characterId
  } catch {
    return false
  }
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function getNavigationType() {
  try {
    return window.performance?.getEntriesByType?.('navigation')?.[0]?.type
  } catch {
    return null
  }
}

export function parseNullableNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

export function clampNumber(value, max, min = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null
  }

  return Math.min(Math.max(Number(value), min), max)
}

export function sanitizeIntegerInput(value, max) {
  const digits = String(value || '').replace(/\D/gu, '')

  if (!digits) {
    return null
  }

  return clampNumber(Number(digits), max)
}

export function sanitizeDecimalCommaInput(value, max = MAX_DECIMAL_GENERAL) {
  const raw = String(value || '')
    .replace(/\./gu, '')
    .replace(/[^\d,]/gu, '')

  const [integerPart = '', ...decimalParts] = raw.split(',')
  const normalizedInteger = integerPart.replace(/\D/gu, '')
  const decimalPart = decimalParts.join('').replace(/\D/gu, '').slice(0, 2)

  if (!normalizedInteger && !decimalPart) {
    return null
  }

  const clampedInteger = Math.min(Number(normalizedInteger || 0), max)
  const numericValue = Number(
    `${clampedInteger}.${decimalPart.padEnd(decimalPart ? decimalPart.length : 0, '')}`
  )

  return Number.isNaN(numericValue) ? null : numericValue
}

export function formatDecimalCommaValue(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value).replace('.', ',')
}

export function isValidHttpUrl(value) {
  if (!value?.trim()) {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

export function getAbilityModifier(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return null
  }

  return Math.floor((Number(score) - 10) / 2)
}

const sheetNumberFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 2,
})

export function formatSheetNumber(value, suffix = '') {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numericValue = Number(value)
  const formattedValue = Number.isFinite(numericValue)
    ? sheetNumberFormatter.format(numericValue)
    : String(value)

  return `${formattedValue}${suffix}`
}

export function getSavingThrowProficiencyKey(abilityKey) {
  return `competenciaSalvacion${abilityKey.charAt(0).toUpperCase()}${abilityKey.slice(1)}`
}

export function getAutoSavingThrow(score, proficiencyBonus, isProficient) {
  const modifier = getAbilityModifier(score)
  const baseValue = modifier ?? 0
  const bonus = isProficient ? Number(proficiencyBonus || 0) : 0
  return baseValue + bonus
}

export function getDisplayedSavingThrow(item, abilityKey, saveKey) {
  const manualValue = item?.[saveKey]

  if (manualValue !== null && manualValue !== undefined) {
    return manualValue
  }

  return getAutoSavingThrow(
    item?.[abilityKey],
    item?.bonificadorCompetencia,
    Boolean(item?.[getSavingThrowProficiencyKey(abilityKey)])
  )
}

export function formatModifier(modifier) {
  if (modifier === null || modifier === undefined) {
    return '-'
  }

  return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

export function formatSheetModifier(modifier) {
  if (modifier === null || modifier === undefined) {
    return '-'
  }

  const numericModifier = Number(modifier)

  if (!Number.isFinite(numericModifier)) {
    return String(modifier)
  }

  const formattedValue = formatSheetNumber(Math.abs(numericModifier))

  return numericModifier >= 0 ? `+${formattedValue}` : `-${formattedValue}`
}

function clampSheetSkillTotal(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return null
  }

  return Math.min(
    Math.max(Math.trunc(numericValue), -SKILL_TOTAL_LIMIT),
    SKILL_TOTAL_LIMIT
  )
}

export function getCharacterSkillTotal(item, skillName) {
  const skillGroup = item?.rasgosAgrupados?.find((group) =>
    isSkillTraitGroupName(group.nombre)
  )

  if (!skillGroup) {
    return null
  }

  const normalizedSkillName = normalizeLooseText(skillName)
  const trait = skillGroup.rasgos?.find(
    (entry) => normalizeLooseText(entry.nombre) === normalizedSkillName
  )

  if (!trait) {
    return null
  }

  const skill = parseSkillTrait(trait)

  if (skill.manual !== null && skill.manual !== undefined) {
    return clampSheetSkillTotal(skill.manual)
  }

  const abilityModifier = getAbilityModifier(item?.[skill.ability]) ?? 0
  const proficiencyBonus = Number(item?.bonificadorCompetencia || 0)

  return clampSheetSkillTotal(
    abilityModifier + proficiencyBonus * Number(skill.multiplier || 0)
  )
}

export function getAutomaticPassiveScore(item, skillName) {
  const skillTotal = getCharacterSkillTotal(item, skillName)

  if (skillTotal === null || skillTotal === undefined) {
    return null
  }

  return clampSheetSkillTotal(10 + skillTotal)
}

export function getDisplayedPassiveScore(item, fieldName) {
  const manualValue = item?.[fieldName]

  if (manualValue !== null && manualValue !== undefined) {
    return manualValue
  }

  if (fieldName === 'percepcionPasiva') {
    return getAutomaticPassiveScore(item, 'Percepción')
  }

  if (fieldName === 'investigacionPasiva') {
    return getAutomaticPassiveScore(item, 'Investigación')
  }

  return manualValue
}

export function formatNullableValue(value, suffix = '') {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return `${value}${suffix}`
}

export function getCharacterClassSummary(item) {
  if (!item?.clases?.length) {
    return 'Sin clase registrada'
  }

  return item.clases
    .map((entry) => {
      const className = entry.clase?.nombre || entry.claseNombre || 'Clase'
      const subclassName = entry.subclase?.nombre || entry.subclaseNombre

      return subclassName
        ? `${className} ${formatSheetNumber(entry.nivelClase)} | ${subclassName}`
        : `${className} ${formatSheetNumber(entry.nivelClase)}`
    })
    .join(' | ')
}

export function getMetersFromFeet(feet) {
  if (feet === null || feet === undefined || Number.isNaN(Number(feet))) {
    return null
  }

  return Number((Number(feet) * 0.3048).toFixed(2))
}

export function getMovementSummary(item) {
  const parts = []

  if (item.velocidadPies !== null && item.velocidadPies !== undefined) {
    parts.push(`${formatSheetNumber(item.velocidadPies)}ft`)
  }

  const calculatedMeters = getMetersFromFeet(item.velocidadPies)

  if (calculatedMeters !== null) {
    parts.push(`${formatSheetNumber(calculatedMeters)}m`)
  }

  return parts.length ? parts.join(' | ') : '-'
}

export function getMusicTitle(item, index) {
  if (item?.titulo?.trim()) {
    return item.titulo.trim()
  }

  try {
    const url = new URL(item.musicaUrl)
    const hostname = url.hostname.replace(/^www\./u, '')

    return `Tema ${String(index + 1).padStart(2, '0')} · ${hostname}`
  } catch {
    return `Tema ${String(index + 1).padStart(2, '0')}`
  }
}

export function buildTraitColumns(groups, editorTraitTypes = []) {
  if (!groups?.length) {
    return { allGroups: [], leftGroups: [], rightGroups: [] }
  }

  const typeOrderMap = new Map(
    editorTraitTypes.map((item) => [item.id, item.ordenVisualizacion || 999])
  )

  const orderedGroups = groups
    .map((group) => {
      const config = traitTypeDisplayConfig[group.nombre] || null
      const estimatedHeight = group.rasgos.reduce(
        (accumulator, trait) =>
          accumulator + 1 + Math.ceil((trait.descripcion?.length || 0) / 140),
        2
      )

      return {
        ...group,
        displayName: config?.label || group.nombre,
        sortOrder:
          config?.order ??
          typeOrderMap.get(group.tipoRasgoId) ??
          group.ordenVisualizacion ??
          999,
        estimatedHeight,
      }
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)

  if (orderedGroups.length === 1) {
    return {
      allGroups: orderedGroups,
      leftGroups: orderedGroups,
      rightGroups: [],
    }
  }

  const totalHeight = orderedGroups.reduce(
    (accumulator, group) => accumulator + group.estimatedHeight,
    0
  )

  let bestIndex = 1
  let runningHeight = 0
  let bestDelta = Number.POSITIVE_INFINITY

  for (let index = 0; index < orderedGroups.length - 1; index += 1) {
    runningHeight += orderedGroups[index].estimatedHeight
    const delta = Math.abs(totalHeight - runningHeight * 2)

    if (delta < bestDelta) {
      bestDelta = delta
      bestIndex = index + 1
    }
  }

  return {
    allGroups: orderedGroups,
    leftGroups: orderedGroups.slice(0, bestIndex),
    rightGroups: orderedGroups.slice(bestIndex),
  }
}

export function derivePrivacyDraft(item, editorMeta) {
  if (item.ambitoVisibilidadCodigo === 'campana_completo') {
    return {
      mode: 'public',
      userPermissions: [],
    }
  }

  if (item.ambitoVisibilidadCodigo === 'campana_vista_previa') {
    return {
      mode: 'preview',
      userPermissions: [],
    }
  }

  if (item.ambitoVisibilidadCodigo === 'usuarios_seleccionados') {
    return {
      mode: 'custom',
      userPermissions: (editorMeta?.permisosActuales || []).map(
        (permission) => ({
          usuarioId: permission.usuarioId,
          nivelAccesoCodigo: permission.nivelAccesoCodigo,
        })
      ),
    }
  }

  return {
    mode: 'private',
    userPermissions: [],
  }
}

export function isObjectDerivedTrait(trait) {
  return (
    trait?.origenTipo === 'objeto' ||
    trait?.origen_tipo === 'objeto' ||
    Boolean(trait?.esRasgoObjeto)
  )
}

export function getObjectTraitOverrideKey(trait) {
  const objectId =
    trait?.origenEntidadId || trait?.origen_entidad_id || trait?.objetoId
  const traitId =
    trait?.origenRasgoClave || trait?.origen_rasgo_clave || trait?.id

  return objectId && traitId ? `${objectId}:${traitId}` : null
}

function getObjectId(object) {
  return object?.objetoId || object?.id || null
}

function getObjectTraitGroups(object) {
  const existingGroups = (object?.rasgosAgrupados || [])
    .map((group) => ({
      ...group,
      rasgos: [...(group.rasgos || [])],
    }))
    .filter((group) => group.rasgos.length)

  if (existingGroups.length) {
    return existingGroups
  }

  const groups = new Map()

  for (const trait of object?.rasgos || []) {
    const groupName = trait.tipoRasgoNombre || 'Rasgos'
    const groupKey = normalizeLooseText(groupName) || 'rasgos'

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        id: trait.tipoRasgoId || groupKey,
        nombre: groupName,
        ordenVisualizacion: trait.tipoRasgoOrden ?? 990,
        rasgos: [],
      })
    }

    groups.get(groupKey).rasgos.push(trait)
  }

  return [...groups.values()]
}

function findCharacterTraitType(editorMeta, objectGroup, objectTrait) {
  const objectGroupName =
    objectTrait.tipoRasgoNombre || objectGroup.nombre || 'Rasgos'

  return (
    editorMeta?.tiposRasgo?.find(
      (traitType) =>
        normalizeLooseText(traitType.nombre) ===
        normalizeLooseText(objectGroupName)
    ) ||
    editorMeta?.tiposRasgo?.find(
      (traitType) => normalizeLooseText(traitType.nombre) === 'rasgos'
    ) ||
    editorMeta?.tiposRasgo?.[0] ||
    null
  )
}

function ensureDraftTraitGroup(draft, traitType, objectGroup, objectTrait) {
  const groupName =
    traitType?.nombre ||
    objectTrait.tipoRasgoNombre ||
    objectGroup.nombre ||
    'Rasgos'
  const groupId = traitType?.id || objectTrait.tipoRasgoId || objectGroup.id

  let group = draft.rasgosAgrupados.find(
    (item) =>
      (groupId && item.tipoRasgoId === groupId) ||
      normalizeLooseText(item.nombre) === normalizeLooseText(groupName)
  )

  if (!group) {
    group = {
      tipoRasgoId: groupId,
      nombre: groupName,
      ordenVisualizacion:
        traitType?.ordenVisualizacion ??
        objectTrait.tipoRasgoOrden ??
        objectGroup.ordenVisualizacion ??
        990,
      rasgos: [],
    }
    draft.rasgosAgrupados.push(group)
  }

  return group
}

function buildObjectTraitDraft({
  object,
  objectGroup,
  objectTrait,
  traitType,
}) {
  const objectId = getObjectId(object)
  const traitId = objectTrait.id || objectTrait.origenRasgoClave
  const objectName = object.nombre || 'Objeto'

  return {
    id: null,
    nombre: `[${objectName}] ${objectTrait.nombre || 'Rasgo'}`,
    descripcion: objectTrait.descripcion || '',
    esReutilizable: false,
    esRasgoObjeto: true,
    objetoId: objectId,
    objetoNombre: objectName,
    origenTipo: 'objeto',
    origenEntidadId: objectId,
    origenEntidadNombre: objectName,
    origenGrupoId:
      objectTrait.tipoRasgoId || objectGroup.id || objectGroup.nombre || null,
    origenRasgoClave: traitId,
    origenRasgoNombre: objectTrait.nombre || null,
    origenDatos: {
      tipoRasgoId: objectTrait.tipoRasgoId || objectGroup.id || null,
      tipoRasgoNombre:
        objectTrait.tipoRasgoNombre || objectGroup.nombre || traitType?.nombre,
      tipoRasgoOrden:
        objectTrait.tipoRasgoOrden ??
        objectGroup.ordenVisualizacion ??
        traitType?.ordenVisualizacion ??
        null,
    },
  }
}

export function removeObjectTraitDrafts(draft, objectId) {
  if (!draft || !objectId) {
    return draft
  }

  draft.rasgosAgrupados = (draft.rasgosAgrupados || []).map((group) => ({
    ...group,
    rasgos: (group.rasgos || []).filter(
      (trait) =>
        !(
          isObjectDerivedTrait(trait) &&
          (trait.origenEntidadId || trait.objetoId) === objectId
        )
    ),
  }))

  return draft
}

export function ensureObjectTraitDrafts(draft, object, editorMeta) {
  const objectId = getObjectId(object)

  if (!draft || !objectId || !object?.mostrarRasgosEnFicha) {
    return draft
  }

  const existingKeys = new Set()

  for (const group of draft.rasgosAgrupados || []) {
    for (const trait of group.rasgos || []) {
      const key = getObjectTraitOverrideKey(trait)

      if (key) {
        existingKeys.add(key)
      }
    }
  }

  for (const objectGroup of getObjectTraitGroups(object)) {
    for (const objectTrait of objectGroup.rasgos || []) {
      const traitId = objectTrait.id || objectTrait.origenRasgoClave
      const key = traitId ? `${objectId}:${traitId}` : null

      if (!key || existingKeys.has(key)) {
        continue
      }

      const traitType = findCharacterTraitType(
        editorMeta,
        objectGroup,
        objectTrait
      )
      const targetGroup = ensureDraftTraitGroup(
        draft,
        traitType,
        objectGroup,
        objectTrait
      )

      targetGroup.rasgos.push(
        buildObjectTraitDraft({
          object,
          objectGroup,
          objectTrait,
          traitType,
        })
      )
      existingKeys.add(key)
    }
  }

  return draft
}

export function syncObjectTraitDrafts(draft, editorMeta) {
  if (!draft) {
    return draft
  }

  const linkedObjectIds = new Set(
    (draft.objetos || []).map(getObjectId).filter(Boolean)
  )
  const visibleObjectIds = new Set(
    (draft.objetos || [])
      .filter((object) => object.mostrarRasgosEnFicha)
      .map(getObjectId)
      .filter(Boolean)
  )

  draft.rasgosAgrupados = (draft.rasgosAgrupados || []).map((group) => ({
    ...group,
    rasgos: (group.rasgos || []).filter((trait) => {
      if (!isObjectDerivedTrait(trait)) {
        return true
      }

      const objectId = trait.origenEntidadId || trait.objetoId
      return linkedObjectIds.has(objectId) && visibleObjectIds.has(objectId)
    }),
  }))

  for (const object of draft.objetos || []) {
    ensureObjectTraitDrafts(draft, object, editorMeta)
  }

  return draft
}

export function buildEditorDraft(item, editorMeta) {
  const saveBehavior = abilityScoreEntries.reduce((accumulator, ability) => {
    const proficiencyKey = getSavingThrowProficiencyKey(ability.key)
    const manualValue = item[ability.saveKey]

    accumulator[ability.key] = {
      manual: manualValue !== null && manualValue !== undefined,
      competent: Boolean(item[proficiencyKey]),
    }

    return accumulator
  }, {})

  const draft = {
    core: {
      campanaId: item.campana?.id || item.campanaId || '',
      aventuraId: item.aventura?.id || item.aventuraId || null,
      partidaAparicionId:
        item.partidaAparicion?.id || item.partidaAparicionId || null,
      partidaDefuncionId:
        item.partidaDefuncion?.id || item.partidaDefuncionId || null,
      propietarioUsuarioId: item.propietario?.id || item.propietarioUsuarioId,
      personajeBaseId: item.personajeBaseId || null,
      tierId: item.tier?.id || null,
      estadoId: item.estado?.id || null,
      nombre: item.nombre || '',
      titulo: item.titulo || '',
      imagenPrincipalUrl: item.imagenPrincipalUrl || '',
      descripcion: item.descripcion || '',
      lore: item.lore || '',
      edad: item.edad ?? null,
      alturaMetros: parseNullableNumber(item.alturaMetros),
      pesoKg: parseNullableNumber(item.pesoKg),
      esCriatura: Boolean(item.esCriatura),
      puntosGolpe: item.puntosGolpe ?? null,
      claseArmadura: item.claseArmadura ?? null,
      velocidadPies: item.velocidadPies ?? null,
      velocidadMetros: parseNullableNumber(item.velocidadMetros),
      bonificadorCompetencia: item.bonificadorCompetencia ?? null,
      iniciativa: item.iniciativa ?? null,
      percepcionPasiva: item.percepcionPasiva ?? null,
      investigacionPasiva: item.investigacionPasiva ?? null,
      puntosExperiencia: item.puntosExperiencia ?? null,
      fuerza: item.fuerza ?? null,
      destreza: item.destreza ?? null,
      constitucion: item.constitucion ?? null,
      inteligencia: item.inteligencia ?? null,
      sabiduria: item.sabiduria ?? null,
      carisma: item.carisma ?? null,
      salvacionFuerza: item.salvacionFuerza ?? null,
      salvacionDestreza: item.salvacionDestreza ?? null,
      salvacionConstitucion: item.salvacionConstitucion ?? null,
      salvacionInteligencia: item.salvacionInteligencia ?? null,
      salvacionSabiduria: item.salvacionSabiduria ?? null,
      salvacionCarisma: item.salvacionCarisma ?? null,
      competenciaSalvacionFuerza: Boolean(item.competenciaSalvacionFuerza),
      competenciaSalvacionDestreza: Boolean(item.competenciaSalvacionDestreza),
      competenciaSalvacionConstitucion: Boolean(
        item.competenciaSalvacionConstitucion
      ),
      competenciaSalvacionInteligencia: Boolean(
        item.competenciaSalvacionInteligencia
      ),
      competenciaSalvacionSabiduria: Boolean(
        item.competenciaSalvacionSabiduria
      ),
      competenciaSalvacionCarisma: Boolean(item.competenciaSalvacionCarisma),
    },
    saveBehavior,
    categorias: (item.categorias || []).map((category) => ({
      id: category.id,
      nombre: category.nombre,
    })),
    clases: (item.clases || []).map((entry) => ({
      claseNombre: entry.clase?.nombre || '',
      subclaseNombre: entry.subclase?.nombre || '',
      nivelClase: entry.nivelClase || 1,
    })),
    rasgosAgrupados: (item.rasgosAgrupados || []).map((group) =>
      ensureActionStatsTraitInGroup({
        tipoRasgoId: group.id,
        nombre: group.nombre,
        ordenVisualizacion: group.ordenVisualizacion,
        rasgos: group.rasgos.map((trait) => ({
          id: trait.id,
          nombre: trait.nombre,
          descripcion: trait.descripcion || '',
          esReutilizable: Boolean(trait.esReutilizable),
          esRasgoObjeto: isObjectDerivedTrait(trait),
          objetoId: trait.origenEntidadId || trait.objetoId || null,
          objetoNombre: trait.origenEntidadNombre || trait.objetoNombre || null,
          origenTipo: trait.origenTipo || null,
          origenEntidadId: trait.origenEntidadId || null,
          origenEntidadNombre: trait.origenEntidadNombre || null,
          origenGrupoId: trait.origenGrupoId || null,
          origenRasgoClave: trait.origenRasgoClave || null,
          origenRasgoNombre: trait.origenRasgoNombre || null,
          origenDatos: trait.origenDatos || {},
        })),
      })
    ),
    hechizos: (item.hechizos || []).map((spell) => ({
      hechizoId: spell.id,
      id: spell.id,
      nombre: spell.nombre,
      nivel: spell.nivel,
      escuela: spell.escuela,
      tipoCasteo: spell.tipoCasteo,
      concentracion: Boolean(spell.concentracion),
    })),
    hechizosSlots: item.hechizosSlots || {},
    poderes: (item.poderes || []).map((power) => ({
      ...power,
      poderId: power.poderId || power.id,
      id: power.id || power.poderId,
    })),
    objetos: (item.objetos || []).map((object) => ({
      ...object,
      objetoId: object.objetoId || object.id,
      id: object.id || object.objetoId,
      mostrarRasgosEnFicha: Boolean(object.mostrarRasgosEnFicha),
    })),
    temasMusicales: (item.temasMusicales || []).map((entry) => ({
      id: entry.id,
      titulo: entry.titulo || '',
      musicaUrl: entry.musicaUrl || '',
    })),
    galeriaImagenes: (item.galeriaImagenes || []).map((entry) => ({
      id: entry.id,
      imagenUrl: entry.imagenUrl,
    })),
    privacidad: derivePrivacyDraft(item, editorMeta),
  }

  return syncObjectTraitDrafts(draft, editorMeta)
}

export function buildEmptyEditorDraft(editorMeta, currentUserId) {
  const defaultCampaign = editorMeta?.campanas?.[0] || null

  return {
    core: {
      campanaId: defaultCampaign?.id || '',
      aventuraId: null,
      partidaAparicionId: null,
      partidaDefuncionId: null,
      propietarioUsuarioId: currentUserId || '',
      personajeBaseId: null,
      tierId: null,
      estadoId: null,
      nombre: '',
      titulo: '',
      imagenPrincipalUrl: '',
      descripcion: '',
      lore: '',
      edad: null,
      alturaMetros: null,
      pesoKg: null,
      esCriatura: false,
      puntosGolpe: null,
      claseArmadura: null,
      velocidadPies: null,
      velocidadMetros: null,
      bonificadorCompetencia: null,
      iniciativa: null,
      percepcionPasiva: null,
      investigacionPasiva: null,
      puntosExperiencia: null,
      fuerza: 10,
      destreza: 10,
      constitucion: 10,
      inteligencia: 10,
      sabiduria: 10,
      carisma: 10,
      salvacionFuerza: null,
      salvacionDestreza: null,
      salvacionConstitucion: null,
      salvacionInteligencia: null,
      salvacionSabiduria: null,
      salvacionCarisma: null,
      competenciaSalvacionFuerza: false,
      competenciaSalvacionDestreza: false,
      competenciaSalvacionConstitucion: false,
      competenciaSalvacionInteligencia: false,
      competenciaSalvacionSabiduria: false,
      competenciaSalvacionCarisma: false,
    },
    saveBehavior: abilityScoreEntries.reduce((accumulator, ability) => {
      accumulator[ability.key] = {
        manual: false,
        competent: false,
      }
      return accumulator
    }, {}),
    categorias: [],
    clases: [],
    rasgosAgrupados: [],
    hechizos: [],
    hechizosSlots: {},
    poderes: [],
    objetos: [],
    temasMusicales: [],
    galeriaImagenes: [],
    privacidad: {
      mode: 'public',
      userPermissions: [],
    },
  }
}

export function getPermissionCode(privacy, userId) {
  return (
    privacy.userPermissions.find((item) => item.usuarioId === userId)
      ?.nivelAccesoCodigo || 'sin_acceso'
  )
}

export function getSelectedGalleryImage(
  galleryImages,
  selectedState,
  characterId
) {
  return selectedState.characterId === characterId &&
    galleryImages.some((image) => image.imagenUrl === selectedState.imageUrl)
    ? selectedState.imageUrl
    : galleryImages[0]?.imagenUrl || null
}

export function buildSavePayload(draft) {
  const nextCore = draft.core || {}

  return {
    ...draft,
    core: {
      ...nextCore,
      nombre: String(nextCore.nombre || '').slice(0, CHARACTER_NAME_MAX_LENGTH),
      titulo: String(nextCore.titulo || '').slice(
        0,
        CHARACTER_TITLE_MAX_LENGTH
      ),
      imagenPrincipalUrl: nextCore.imagenPrincipalUrl?.trim() || null,
      edad: clampNumber(nextCore.edad, MAX_SHEET_SPEED_INTEGER),
      alturaMetros: clampNumber(nextCore.alturaMetros, MAX_DECIMAL_GENERAL),
      pesoKg: clampNumber(nextCore.pesoKg, MAX_DECIMAL_GENERAL),
      puntosGolpe: clampNumber(nextCore.puntosGolpe, MAX_SHEET_GENERAL_INTEGER),
      claseArmadura: clampNumber(
        nextCore.claseArmadura,
        MAX_SHEET_GENERAL_INTEGER
      ),
      velocidadPies: clampNumber(
        nextCore.velocidadPies,
        MAX_SHEET_SPEED_INTEGER
      ),
      velocidadMetros: getMetersFromFeet(nextCore.velocidadPies),
      bonificadorCompetencia: clampNumber(
        nextCore.bonificadorCompetencia,
        MAX_SHEET_COMPETENCE
      ),
      iniciativa: clampNumber(nextCore.iniciativa, MAX_SHEET_GENERAL_INTEGER),
      percepcionPasiva: clampNumber(
        nextCore.percepcionPasiva,
        MAX_SHEET_GENERAL_INTEGER
      ),
      investigacionPasiva: clampNumber(
        nextCore.investigacionPasiva,
        MAX_SHEET_GENERAL_INTEGER
      ),
      puntosExperiencia: clampNumber(
        nextCore.puntosExperiencia,
        MAX_SHEET_GENERAL_INTEGER
      ),
      fuerza: clampNumber(nextCore.fuerza, MAX_ABILITY_SCORE),
      destreza: clampNumber(nextCore.destreza, MAX_ABILITY_SCORE),
      constitucion: clampNumber(nextCore.constitucion, MAX_ABILITY_SCORE),
      inteligencia: clampNumber(nextCore.inteligencia, MAX_ABILITY_SCORE),
      sabiduria: clampNumber(nextCore.sabiduria, MAX_ABILITY_SCORE),
      carisma: clampNumber(nextCore.carisma, MAX_ABILITY_SCORE),
      salvacionFuerza: clampNumber(nextCore.salvacionFuerza, MAX_SAVING_THROW),
      salvacionDestreza: clampNumber(
        nextCore.salvacionDestreza,
        MAX_SAVING_THROW
      ),
      salvacionConstitucion: clampNumber(
        nextCore.salvacionConstitucion,
        MAX_SAVING_THROW
      ),
      salvacionInteligencia: clampNumber(
        nextCore.salvacionInteligencia,
        MAX_SAVING_THROW
      ),
      salvacionSabiduria: clampNumber(
        nextCore.salvacionSabiduria,
        MAX_SAVING_THROW
      ),
      salvacionCarisma: clampNumber(
        nextCore.salvacionCarisma,
        MAX_SAVING_THROW
      ),
    },
    saveBehavior: undefined,
    clases: (draft.clases || [])
      .filter((entry) => entry.claseNombre?.trim())
      .map((entry) => ({
        claseNombre: entry.claseNombre.trim().slice(0, CLASS_NAME_MAX_LENGTH),
        subclaseNombre: entry.subclaseNombre
          ? entry.subclaseNombre.trim().slice(0, SUBCLASS_NAME_MAX_LENGTH)
          : '',
        nivelClase: clampNumber(entry.nivelClase, MAX_CLASS_LEVEL, 1) || 1,
      })),
    rasgosAgrupados: (draft.rasgosAgrupados || []).map((group) => ({
      ...group,
      rasgos: (group.rasgos || []).filter((trait) => {
        if (isActionStatsTrait(trait)) {
          return getVisibleActionStats(parseActionStatsTrait(trait)).length > 0
        }

        return trait.nombre?.trim() && trait.descripcion?.trim()
      }),
    })),
    hechizos: (draft.hechizos || [])
      .map((spell) => ({ hechizoId: spell.hechizoId || spell.id }))
      .filter((spell) => spell.hechizoId),
    hechizosSlots: draft.hechizosSlots || {},
    poderes: (draft.poderes || [])
      .map((power) => ({ poderId: power.poderId || power.id }))
      .filter((power) => power.poderId),
    objetos: (draft.objetos || [])
      .map((object) => ({
        objetoId: object.objetoId || object.id,
        mostrarRasgosEnFicha: Boolean(object.mostrarRasgosEnFicha),
      }))
      .filter((object) => object.objetoId),
    temasMusicales: (draft.temasMusicales || []).filter((entry) =>
      entry.musicaUrl?.trim()
    ),
    galeriaImagenes: (draft.galeriaImagenes || []).filter((entry) =>
      entry.imagenUrl?.trim()
    ),
  }
}

export function getDraftValidationErrors(draft) {
  const errors = []

  if (!draft?.core?.nombre?.trim()) {
    errors.push('El nombre del personaje no puede quedar vacio.')
  }

  if (!draft?.core?.campanaId) {
    errors.push('Selecciona una campana para el personaje.')
  }

  if (!draft?.core?.propietarioUsuarioId) {
    errors.push('Todo personaje debe tener un propietario asignado.')
  }

  ;(draft?.temasMusicales || []).forEach((entry, index) => {
    if (entry.musicaUrl?.trim() && !isValidHttpUrl(entry.musicaUrl)) {
      errors.push(`El enlace musical ${index + 1} no es una URL valida.`)
    }
  })

  return errors
}
