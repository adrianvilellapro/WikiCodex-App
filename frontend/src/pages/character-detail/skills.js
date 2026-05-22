const SKILL_DESCRIPTION_MARKER = 'wikicodex:skill:v1'
export const SKILL_TOTAL_LIMIT = 9_999_999

export const skillAbilityOptions = [
  { key: 'fuerza', label: 'Fuerza', shortLabel: 'Fue' },
  { key: 'destreza', label: 'Destreza', shortLabel: 'Des' },
  { key: 'constitucion', label: 'Constitución', shortLabel: 'Con' },
  { key: 'inteligencia', label: 'Inteligencia', shortLabel: 'Int' },
  { key: 'sabiduria', label: 'Sabiduría', shortLabel: 'Sab' },
  { key: 'carisma', label: 'Carisma', shortLabel: 'Car' },
]

export const baseSkillDefinitions = [
  ['Atletismo', 'fuerza'],
  ['Acrobacias', 'destreza'],
  ['Juego de Manos', 'destreza'],
  ['Sigilo', 'destreza'],
  ['Conocimiento Arcano', 'inteligencia'],
  ['Historia', 'inteligencia'],
  ['Investigación', 'inteligencia'],
  ['Naturaleza', 'inteligencia'],
  ['Religión', 'inteligencia'],
  ['Trato con Animales', 'sabiduria'],
  ['Perspicacia', 'sabiduria'],
  ['Medicina', 'sabiduria'],
  ['Percepción', 'sabiduria'],
  ['Supervivencia', 'sabiduria'],
  ['Engaño', 'carisma'],
  ['Intimidación', 'carisma'],
  ['Interpretación', 'carisma'],
  ['Persuasión', 'carisma'],
]

function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

function clampSkillMultiplier(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.min(Math.max(Math.trunc(numeric), 0), 10)
}

function normalizeManualValue(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  return Math.min(
    Math.max(Math.trunc(numeric), -SKILL_TOTAL_LIMIT),
    SKILL_TOTAL_LIMIT
  )
}

export function isSkillTraitGroupName(name) {
  return normalizeLooseText(name) === 'habilidades'
}

export function getSkillAbilityOption(abilityKey) {
  return (
    skillAbilityOptions.find((item) => item.key === abilityKey) ||
    skillAbilityOptions[0]
  )
}

export function serializeSkillDescription(skill) {
  return JSON.stringify({
    marker: SKILL_DESCRIPTION_MARKER,
    ability: getSkillAbilityOption(skill.ability).key,
    multiplier: clampSkillMultiplier(skill.multiplier),
    manual: normalizeManualValue(skill.manual),
    custom: Boolean(skill.custom),
  })
}

export function createSkillTrait({ nombre, ability, custom = false }) {
  return {
    id: null,
    clientId:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    nombre,
    descripcion: serializeSkillDescription({
      ability,
      multiplier: 0,
      manual: null,
      custom,
    }),
    esReutilizable: false,
  }
}

export function buildDefaultSkillTraits() {
  return baseSkillDefinitions.map(([nombre, ability]) =>
    createSkillTrait({ nombre, ability })
  )
}

export function parseSkillTrait(trait) {
  let parsed = null

  try {
    parsed = JSON.parse(trait?.descripcion || '{}')
  } catch {
    parsed = null
  }

  const knownBaseSkill = baseSkillDefinitions.find(
    ([name]) => normalizeLooseText(name) === normalizeLooseText(trait?.nombre)
  )

  if (parsed?.marker !== SKILL_DESCRIPTION_MARKER) {
    return {
      nombre: trait?.nombre || '',
      ability: knownBaseSkill?.[1] || 'fuerza',
      multiplier: 0,
      manual: null,
      custom: !knownBaseSkill,
    }
  }

  return {
    nombre: trait?.nombre || '',
    ability: getSkillAbilityOption(parsed.ability).key,
    multiplier: clampSkillMultiplier(parsed.multiplier),
    manual: normalizeManualValue(parsed.manual),
    custom: Boolean(parsed.custom || !knownBaseSkill),
  }
}
