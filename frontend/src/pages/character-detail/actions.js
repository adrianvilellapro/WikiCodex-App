const ACTION_STATS_MARKER = 'wikicodex:action-stats:v1'

export const ACTION_STATS_TRAIT_NAME = 'Datos de accion'

export const actionStatFields = [
  {
    key: 'cantidadAtaques',
    token: 'cantidadAtaques',
    label: 'Cantidad de Ataques',
    multiple: false,
  },
  {
    key: 'ataque',
    token: 'ataque',
    label: 'Ataque',
    multiple: true,
    signed: true,
  },
  {
    key: 'dano',
    token: 'dano',
    label: 'Daño',
    multiple: true,
    signed: true,
  },
  {
    key: 'ataqueMagico',
    token: 'ataqueMagico',
    label: 'Ataque Mágico',
    multiple: true,
    signed: true,
  },
  {
    key: 'danoMagico',
    token: 'danoMagico',
    label: 'Daño Mágico',
    multiple: true,
    signed: true,
  },
  { key: 'cd', token: 'cd', label: 'CD', multiple: true },
]

const actionStatFieldByKey = new Map(
  actionStatFields.map((field) => [field.key, field])
)

function createClientId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

function cleanStatValue(value, field = null) {
  const rawValue = String(value ?? '').trim()

  if (field?.signed) {
    const explicitBonus = rawValue.match(/\+(\d+)/u)
    if (explicitBonus) {
      return explicitBonus[1]
    }

    const firstNumber = rawValue.match(/\d+/u)
    return firstNumber ? firstNumber[0] : ''
  }

  if (field?.key === 'cd' || field?.key === 'cantidadAtaques') {
    return rawValue.replace(/\D/gu, '')
  }

  return rawValue
}

function normalizeStatValues(values, field) {
  const list = Array.isArray(values) ? values : [values]
  const cleaned = list.map((value) => cleanStatValue(value, field))
  return cleaned.length ? cleaned : ['']
}

function normalizeActionStats(stats = {}) {
  return actionStatFields.reduce((accumulator, field) => {
    if (field.multiple) {
      accumulator[field.key] = normalizeStatValues(stats[field.key], field)
    } else {
      accumulator[field.key] = cleanStatValue(stats[field.key], field)
    }
    return accumulator
  }, {})
}

function extractSortableNumber(value) {
  const match = String(value || '').match(/[-+]?\d+(?:[.,]\d+)?/u)
  if (!match) {
    return null
  }

  const parsed = Number(match[0].replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function sortStatValues(values) {
  return [...new Set((values || []).map(cleanStatValue).filter(Boolean))].sort(
    (left, right) => {
      const leftNumber = extractSortableNumber(left)
      const rightNumber = extractSortableNumber(right)

      if (leftNumber !== null && rightNumber !== null) {
        return leftNumber - rightNumber
      }

      if (leftNumber !== null) {
        return -1
      }

      if (rightNumber !== null) {
        return 1
      }

      return left.localeCompare(right, 'es', { numeric: true })
    }
  )
}

function formatActionStatSingleValue(field, value) {
  const cleanedValue = cleanStatValue(value, field)
  if (!cleanedValue) {
    return ''
  }

  return field.signed ? `+${cleanedValue}` : cleanedValue
}

function getSortedActionStatValues(stats, key) {
  const field = actionStatFieldByKey.get(key)
  if (!field) {
    return []
  }

  const values = field.multiple ? stats?.[key] : [stats?.[key]]
  return sortStatValues(values).map((value) =>
    formatActionStatSingleValue(field, value)
  )
}

export function isActionTraitGroupName(name) {
  const normalizedName = normalizeLooseText(name)
  return normalizedName === 'accion' || normalizedName === 'acciones'
}

export function serializeActionStats(stats) {
  const normalized = normalizeActionStats(stats)
  const payload = actionStatFields.reduce((accumulator, field) => {
    if (field.multiple) {
      accumulator[field.key] = (normalized[field.key] || []).map((value) =>
        cleanStatValue(value, field)
      )
    } else {
      accumulator[field.key] = cleanStatValue(normalized[field.key], field)
    }
    return accumulator
  }, {})

  return JSON.stringify({
    marker: ACTION_STATS_MARKER,
    ...payload,
  })
}

export function parseActionStatsTrait(trait) {
  let parsed = null

  try {
    parsed = JSON.parse(trait?.descripcion || '{}')
  } catch {
    parsed = null
  }

  if (parsed?.marker !== ACTION_STATS_MARKER) {
    return normalizeActionStats()
  }

  return normalizeActionStats(parsed)
}

export function isActionStatsTrait(trait) {
  if (!trait) {
    return false
  }

  if (trait.esActionStats) {
    return true
  }

  if (
    normalizeLooseText(trait.nombre) ===
    normalizeLooseText(ACTION_STATS_TRAIT_NAME)
  ) {
    return true
  }

  try {
    return JSON.parse(trait.descripcion || '{}')?.marker === ACTION_STATS_MARKER
  } catch {
    return false
  }
}

export function createDefaultActionStatsTrait() {
  return {
    id: null,
    clientId: createClientId(),
    nombre: ACTION_STATS_TRAIT_NAME,
    descripcion: serializeActionStats({}),
    esReutilizable: false,
    esActionStats: true,
  }
}

export function ensureActionStatsTraitInGroup(group) {
  if (!group || !isActionTraitGroupName(group.nombre)) {
    return group
  }

  const hasStatsTrait = (group.rasgos || []).some(isActionStatsTrait)

  if (hasStatsTrait) {
    group.rasgos = group.rasgos.map((trait) =>
      isActionStatsTrait(trait)
        ? {
            ...trait,
            nombre: ACTION_STATS_TRAIT_NAME,
            esReutilizable: false,
            esActionStats: true,
          }
        : trait
    )
    return group
  }

  group.rasgos = [createDefaultActionStatsTrait(), ...(group.rasgos || [])]
  return group
}

export function getActionStatsTraitEntry(group) {
  const traits = group?.rasgos || []
  const traitIndex = traits.findIndex(isActionStatsTrait)

  if (traitIndex < 0) {
    return {
      trait: createDefaultActionStatsTrait(),
      traitIndex: -1,
    }
  }

  return {
    trait: traits[traitIndex],
    traitIndex,
  }
}

export function formatActionStatValue(stats, key) {
  const field = actionStatFieldByKey.get(key)

  if (!field) {
    return ''
  }

  if (!field.multiple) {
    return cleanStatValue(stats?.[key], field)
  }

  return getSortedActionStatValues(stats, key).join('/')
}

export function getVisibleActionStats(stats) {
  return actionStatFields
    .map((field) => ({
      ...field,
      value: formatActionStatValue(stats, field.key),
    }))
    .filter((field) => field.value)
}

export function getActionStatToken(field) {
  return `{accion.${field.token || field.key}}`
}

function getActionStatOptionToken(field, index) {
  return `{accion.${field.token || field.key}.${index + 1}}`
}

export function getVisibleActionStatTokens(stats) {
  return getVisibleActionStats(stats).flatMap((field) => {
    const values = getSortedActionStatValues(stats, field.key)
    const tokens = [
      {
        key: field.key,
        token: getActionStatToken(field),
        label: field.label,
        value: field.value,
        hiddenFromPicker: field.multiple && values.length > 1,
      },
    ]

    if (field.multiple && values.length > 1) {
      tokens.push(
        ...values.map((value, index) => ({
          key: `${field.key}:${index}`,
          groupKey: field.key,
          token: getActionStatOptionToken(field, index),
          label: `${field.label} ${value}`,
          value,
        }))
      )
    }

    return tokens
  })
}
