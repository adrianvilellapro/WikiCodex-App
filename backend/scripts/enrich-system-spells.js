require('dotenv').config()

const fs = require('node:fs/promises')
const path = require('node:path')

const { prisma } = require('../src/lib/prisma')

const SYSTEM_ORIGIN = 'sistema'

const BASE_DAMAGE_TYPES = [
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

const BASE_CONDITIONS = [
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

const BASE_MISC_TAGS = [
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

const SAVE_LABELS = [
  ['FUE', 'Salvación de Fuerza', ['salvacion de fuerza']],
  ['DES', 'Salvación de Destreza', ['salvacion de destreza']],
  ['CON', 'Salvación de Constitución', ['salvacion de constitucion']],
  ['INT', 'Salvación de Inteligencia', ['salvacion de inteligencia']],
  ['SAB', 'Salvación de Sabiduría', ['salvacion de sabiduria']],
  ['CAR', 'Salvación de Carisma', ['salvacion de carisma']],
]

const CHECK_LABELS = [
  ['FUE', 'Prueba de Fuerza', ['prueba de fuerza']],
  ['DES', 'Prueba de Destreza', ['prueba de destreza']],
  ['CON', 'Prueba de Constitución', ['prueba de constitucion']],
  ['INT', 'Prueba de Inteligencia', ['prueba de inteligencia']],
  ['SAB', 'Prueba de Sabiduría', ['prueba de sabiduria']],
  ['CAR', 'Prueba de Carisma', ['prueba de carisma']],
]

const DAMAGE_RULES = [
  ['Cortante', ['cortante']],
  ['Perforante', ['perforante']],
  ['Contundente', ['contundente']],
  ['Fuego', ['fuego']],
  ['Frío', ['frio', 'fria', 'hielo']],
  ['Ácido', ['acido']],
  ['Veneno', ['veneno', 'venenoso']],
  ['Radiante', ['radiante']],
  ['Necrótico', ['necrotico']],
  ['Rayo', ['rayo', 'relampago', 'electric']],
  ['Trueno', ['trueno']],
  ['Fuerza', ['fuerza']],
  ['Psíquico', ['psiquico']],
]

const CONDITION_RULES = [
  ['Cegado', ['cegad']],
  ['Ensordecido', ['ensordecid']],
  ['Encantado', ['encantad', 'hechizad']],
  ['Exausto', ['exhaust', 'agotamiento']],
  ['Asustado', ['asustad', 'atemorizad']],
  ['Agarrado', ['agarrad']],
  ['Apresado', ['apresad', 'restringid', 'restrenid']],
  ['Incapacitado', ['incapacitad']],
  ['Inmovilizado', ['inmovilizad', 'paralizad']],
  ['Invisible', ['invisible']],
  ['Petrificado', ['petrificad']],
  ['Aturdido', ['aturdid']],
  ['Derribado', ['derribad', 'tumbad']],
  ['Inconsciente', ['inconsciente']],
  ['Envenenado', ['envenenad']],
  ['Sangrado', ['sangrad']],
]

const CONDITION_BOLD_TERMS = {
  Cegado: ['cegado', 'cegada', 'cegados', 'cegadas'],
  Ensordecido: ['ensordecido', 'ensordecida', 'ensordecidos', 'ensordecidas'],
  Encantado: [
    'encantado',
    'encantada',
    'encantados',
    'encantadas',
    'hechizado',
    'hechizada',
    'hechizados',
    'hechizadas',
  ],
  Exausto: ['exausto', 'exhausto', 'agotamiento'],
  Asustado: [
    'asustado',
    'asustada',
    'asustados',
    'asustadas',
    'atemorizado',
    'atemorizada',
    'atemorizados',
    'atemorizadas',
  ],
  Agarrado: ['agarrado', 'agarrada', 'agarrados', 'agarradas'],
  Apresado: [
    'apresado',
    'apresada',
    'apresados',
    'apresadas',
    'restringido',
    'restringida',
    'restringidos',
    'restringidas',
  ],
  Incapacitado: [
    'incapacitado',
    'incapacitada',
    'incapacitados',
    'incapacitadas',
  ],
  Inmovilizado: [
    'inmovilizado',
    'inmovilizada',
    'inmovilizados',
    'inmovilizadas',
    'paralizado',
    'paralizada',
    'paralizados',
    'paralizadas',
  ],
  Invisible: ['invisible'],
  Petrificado: ['petrificado', 'petrificada', 'petrificados', 'petrificadas'],
  Aturdido: ['aturdido', 'aturdida', 'aturdidos', 'aturdidas'],
  Derribado: [
    'derribado',
    'derribada',
    'derribados',
    'derribadas',
    'tumbado',
    'tumbada',
    'tumbados',
    'tumbadas',
  ],
  Inconsciente: ['inconsciente'],
  Envenenado: ['envenenado', 'envenenada', 'envenenados', 'envenenadas'],
  Sangrado: ['sangrado'],
}

const DAMAGE_BOLD_TERMS = {
  Cortante: ['cortante'],
  Perforante: ['perforante'],
  Contundente: ['contundente'],
  Fuego: ['fuego'],
  Frío: ['frío', 'frio'],
  Ácido: ['ácido', 'acido'],
  Veneno: ['veneno'],
  Radiante: ['radiante'],
  Necrótico: ['necrótico', 'necrotico'],
  Rayo: ['rayo', 'relámpago', 'relampago'],
  Trueno: ['trueno'],
  Fuerza: ['fuerza'],
  Psíquico: ['psíquico', 'psiquico'],
}

const MISC_RULES = [
  [
    'Curación',
    [
      'recupera puntos de golpe',
      'recuperar puntos de golpe',
      'curacion',
      'cura ',
      'sanar',
    ],
  ],
  ['Otorga Puntos de Golpe Temporales', ['puntos de golpe temporales']],
  ['Requiere Visión', ['que puedas ver', 'puedas ver dentro']],
  ['Efectos Permanentes', ['permanente', 'hasta que sea disipado']],
  [
    'Efectos de Escalado',
    [
      'mejora de truco',
      'a niveles superiores',
      'por cada nivel de espacio',
      'espacio de conjuro de nivel',
    ],
  ],
  ['Objetivos de Escalado', ['objetivo adicional', 'criatura adicional']],
  [
    'Invoca Criatura',
    [
      'invocas',
      'invoca ',
      'convocas',
      'convoca ',
      'criatura invocada',
      'familiar',
    ],
  ],
  ['Modifica CA', [' clase de armadura', ' ca ', ' ca.']],
  ['Teletransportación', ['teletransport']],
  [
    'Movimiento Forzado',
    ['empuja', 'empujar', 'arrastra', 'arrastrarlo', 'atraerlo', 'alejarlo'],
  ],
  ['Efectos Aleatorios', ['aleatorio', 'aleatoria', 'al azar']],
  ['Crea Luz Solar', ['luz solar']],
  ['Crea Luz', ['luz brillante', 'luz tenue', 'emite luz', 'ilumina']],
  ['Usa Acción Adicional', ['accion adicional', 'acción adicional']],
  ['Cambio de Plano', ['plano de existencia', 'otro plano', 'cambio de plano']],
  ['Oscurece la Visión', ['oscuridad', 'oscurece', 'niebla', 'bruma']],
  ['Terreno Difícil', ['terreno dificil', 'terreno difícil']],
  ['Daño de Ataque Adicional', ['dano adicional', 'daño adicional']],
  ['Afecta Objetos', ['objeto', 'objetos']],
  ['Otorga Ventaja', ['ventaja']],
  [
    'Permanente si se repite',
    ['permanente si', 'durante 1 ano', 'durante un ano'],
  ],
  ['Ritual', ['ritual']],
]

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function includesAny(normalizedText, patterns) {
  return patterns.some((pattern) =>
    normalizedText.includes(normalizeText(pattern))
  )
}

function makeBaseLookup(labels) {
  return new Map(labels.map((label) => [normalizeText(label), label]))
}

function normalizeExistingTags(values, baseLabels) {
  const lookup = makeBaseLookup(baseLabels)

  return Array.isArray(values)
    ? values.map((value) => lookup.get(normalizeText(value))).filter(Boolean)
    : []
}

function mergeTags(existingValues, inferredValues, baseLabels) {
  const allowed = new Set(baseLabels)
  const merged = [
    ...normalizeExistingTags(existingValues, baseLabels),
    ...inferredValues,
  ].filter((value) => allowed.has(value))

  return [...new Set(merged)].sort((left, right) => left.localeCompare(right))
}

function boldDiceExpressions(description) {
  const text = String(description || '')
  const diceExpressionRegex = /\b\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?\b/gi

  return text.replace(diceExpressionRegex, (match, offset, fullText) => {
    const before = fullText.slice(Math.max(0, offset - 2), offset)
    const after = fullText.slice(
      offset + match.length,
      offset + match.length + 2
    )

    if (before === '**' && after === '**') {
      return match
    }

    return `**${match}**`
  })
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function isAlreadyBold(fullText, offset, length) {
  return (
    fullText.slice(Math.max(0, offset - 2), offset) === '**' &&
    fullText.slice(offset + length, offset + length + 2) === '**'
  )
}

function isInsideBold(fullText, offset) {
  const before = fullText.slice(0, offset)
  const markers = before.match(/\*\*/gu) || []

  return markers.length % 2 === 1
}

function boldRegex(text, regex) {
  return String(text || '').replace(regex, (...args) => {
    const match = args[0]
    const offset = args.at(-2)
    const fullText = args.at(-1)

    if (
      isAlreadyBold(fullText, offset, match.length) ||
      isInsideBold(fullText, offset)
    ) {
      return match
    }

    return `**${match}**`
  })
}

function boldTermList(text, terms) {
  let nextText = String(text || '')

  for (const term of terms) {
    nextText = boldRegex(
      nextText,
      new RegExp(`\\b${escapeRegExp(term)}\\b`, 'giu')
    )
  }

  return nextText
}

function boldSaveAndCheckPhrases(text) {
  let nextText = String(text || '')

  for (const [, fullLabel] of [...SAVE_LABELS, ...CHECK_LABELS]) {
    nextText = boldRegex(
      nextText,
      new RegExp(`\\b${escapeRegExp(fullLabel)}\\b`, 'giu')
    )
  }

  return nextText
}

function inferRuleTags(normalizedText, rules) {
  return rules
    .filter(([, patterns]) => includesAny(normalizedText, patterns))
    .map(([label]) => label)
}

function inferDamageTags(normalizedText) {
  return DAMAGE_RULES.filter(([, patterns]) =>
    patterns.some((pattern) => {
      const normalizedPattern = normalizeText(pattern)
      const damageContext = new RegExp(
        `dan[ao][^.。\\n]{0,180}\\b${normalizedPattern}\\b`,
        'u'
      )

      return damageContext.test(normalizedText)
    })
  ).map(([label]) => label)
}

function isConditionApplied(normalizedText, pattern) {
  const appliedStatus = new RegExp(
    `(se\\s+le\\s+aplica|se\\s+les\\s+aplica|se\\s+aplica|tendra|tendran|sufrira|sufriran|recibira|recibiran|adopta|entrara|entraran|queda|quedara|quedaran|caera|caeran)[^.\\n]{0,90}(estado|condicion|alterado)?[^.\\n]{0,40}${pattern}`,
    'u'
  )
  const failedSaveStatus = new RegExp(
    `(si\\s+la\\s+falla|si\\s+fallan|si\\s+falla|si\\s+el\\s+objetivo\\s+falla)[^.\\n]{0,160}${pattern}`,
    'u'
  )

  return (
    appliedStatus.test(normalizedText) || failedSaveStatus.test(normalizedText)
  )
}

function inferConditionTags(normalizedText) {
  return CONDITION_RULES.filter(([, patterns]) =>
    patterns.some((pattern) => isConditionApplied(normalizedText, pattern))
  ).map(([label]) => label)
}

function normalizeSaveOrCheck(existingValue, labels, normalizedText) {
  const existing = normalizeText(existingValue)
  const byExisting = labels.find(
    ([shortLabel, fullLabel]) =>
      existing === normalizeText(shortLabel) ||
      existing === normalizeText(fullLabel)
  )

  if (byExisting) {
    return byExisting[1]
  }

  const byDescription = labels.find(([, , patterns]) =>
    patterns.some((pattern) => {
      const normalizedPattern = normalizeText(pattern)

      return new RegExp(
        `(tirada\\s+de\\s+${normalizedPattern}|${normalizedPattern})`,
        'u'
      ).test(normalizedText)
    })
  )

  return byDescription?.[1] || null
}

function buildEnrichedDescription(description, damageTags, conditionTags) {
  let nextDescription = boldDiceExpressions(description)

  nextDescription = boldSaveAndCheckPhrases(nextDescription)

  for (const damageTag of damageTags) {
    nextDescription = boldTermList(
      nextDescription,
      DAMAGE_BOLD_TERMS[damageTag] || [damageTag]
    )
  }

  for (const conditionTag of conditionTags) {
    nextDescription = boldTermList(
      nextDescription,
      CONDITION_BOLD_TERMS[conditionTag] || [conditionTag]
    )
  }

  return nextDescription
}

function inferMiscTags(spell, normalizedText) {
  const components = spell.componentes || {}
  const material = String(components.material || '')
  const materialText = normalizeText(material)
  const tags = inferRuleTags(normalizedText, MISC_RULES)

  if (spell.concentracion) tags.push('Concentración')
  if (components.verbal) tags.push('Verbal')
  if (components.somatico) tags.push('Somático')
  if (material.trim()) tags.push('Material')
  if (components.consumeMaterial) tags.push('El material se consume')
  if (
    materialText.includes(' po') ||
    materialText.includes('valor') ||
    materialText.includes('coste') ||
    materialText.includes('precio')
  ) {
    tags.push('Material con Coste')
  }

  return tags
}

function buildUpdateData(spell) {
  const plainDescription = String(spell.descripcion || '').replace(/\*\*/gu, '')
  const classificationText = normalizeText(
    [
      spell.nombre,
      plainDescription,
      spell.descripcion_html,
      spell.componentes?.material,
    ].join('\n')
  )
  const damageTags = inferDamageTags(classificationText)
  const conditionTags = inferConditionTags(classificationText)
  const nextDescription = buildEnrichedDescription(
    plainDescription,
    damageTags,
    conditionTags
  )

  return {
    descripcion: nextDescription || null,
    tipos_dano: mergeTags([], damageTags, BASE_DAMAGE_TYPES),
    condiciones: mergeTags([], conditionTags, BASE_CONDITIONS),
    miscelanea: mergeTags(
      spell.miscelanea,
      inferMiscTags(spell, classificationText),
      BASE_MISC_TAGS
    ),
    tipo_salvacion: normalizeSaveOrCheck(
      spell.tipo_salvacion,
      SAVE_LABELS,
      classificationText
    ),
    prueba_habilidad: normalizeSaveOrCheck(
      spell.prueba_habilidad,
      CHECK_LABELS,
      classificationText
    ),
    actualizado_en: new Date(),
  }
}

function hasChanged(spell, data) {
  return (
    spell.descripcion !== data.descripcion ||
    JSON.stringify(spell.tipos_dano || []) !==
      JSON.stringify(data.tipos_dano) ||
    JSON.stringify(spell.condiciones || []) !==
      JSON.stringify(data.condiciones) ||
    JSON.stringify(spell.miscelanea || []) !==
      JSON.stringify(data.miscelanea) ||
    (spell.tipo_salvacion || null) !== data.tipo_salvacion ||
    (spell.prueba_habilidad || null) !== data.prueba_habilidad
  )
}

async function backupDeletedSpells(spells) {
  if (!spells.length) {
    return null
  }

  const backupDir = path.join(__dirname, '..', 'dev-local')
  await fs.mkdir(backupDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(backupDir, `deleted-user-spells-${stamp}.json`)

  await fs.writeFile(filePath, JSON.stringify(spells, null, 2), 'utf8')
  return filePath
}

async function main() {
  const userSpells = await prisma.hechizos.findMany({
    where: { NOT: { origen: SYSTEM_ORIGIN } },
    include: {
      usuarios: {
        select: { id: true, nombre_usuario: true },
      },
      hechizo_campanas: true,
      hechizos_guardados_usuario: true,
      personaje_hechizos: true,
      objeto_hechizos: true,
    },
    orderBy: [{ origen: 'asc' }, { nombre: 'asc' }],
  })

  const backupPath = await backupDeletedSpells(userSpells)

  const deleteResult = await prisma.hechizos.deleteMany({
    where: { NOT: { origen: SYSTEM_ORIGIN } },
  })

  const systemSpells = await prisma.hechizos.findMany({
    where: { origen: SYSTEM_ORIGIN },
    orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }],
  })

  let updated = 0

  for (const spell of systemSpells) {
    const data = buildUpdateData(spell)

    if (!hasChanged(spell, data)) {
      continue
    }

    await prisma.hechizos.update({
      where: { id: spell.id },
      data,
    })
    updated += 1
  }

  const damageTagged = await prisma.hechizos.count({
    where: {
      origen: SYSTEM_ORIGIN,
      NOT: { tipos_dano: { equals: [] } },
    },
  })
  const conditionsTagged = await prisma.hechizos.count({
    where: {
      origen: SYSTEM_ORIGIN,
      NOT: { condiciones: { equals: [] } },
    },
  })
  const miscTagged = await prisma.hechizos.count({
    where: {
      origen: SYSTEM_ORIGIN,
      NOT: { miscelanea: { equals: [] } },
    },
  })

  console.log(
    JSON.stringify(
      {
        deletedUserSpells: deleteResult.count,
        deletedBackupPath: backupPath,
        systemSpells: systemSpells.length,
        updatedSystemSpells: updated,
        taggedSystemSpells: {
          damage: damageTagged,
          conditions: conditionsTagged,
          misc: miscTagged,
        },
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
