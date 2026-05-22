require('dotenv').config()

const { prisma } = require('../src/lib/prisma')

const FEATS_URL =
  'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/feats.json'

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

function cleanTagContent(value) {
  const parts = String(value || '')
    .split('|')
    .filter(Boolean)
  const first = parts[0] || ''
  const tagType = first.split(/\s+/)[0] || ''
  const fallback = first.replace(/^[a-zA-Z0-9_:-]+\s+/, '').trim()
  const display =
    tagType === 'filter' || parts[2]?.includes('=')
      ? fallback
      : parts[2] || fallback || ''

  return display || fallback || first
}

function enhanceImportantTerms(value) {
  const damageTypes =
    'acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder'
  const abilityTerms =
    'Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma'
  const conditions =
    'blinded|charmed|deafened|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious|exhaustion'

  return String(value || '')
    .replace(/\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\b/gi, '**$1**')
    .replace(
      new RegExp(`\\b(${abilityTerms})\\s+(saving throw|check)s?\\b`, 'gi'),
      '**$1 $2**'
    )
    .replace(
      new RegExp(`\\b(${damageTypes})\\s+damage\\b`, 'gi'),
      '==$1 damage=='
    )
    .replace(new RegExp(`\\b(${conditions})\\b`, 'gi'), '==$1==')
}

function cleanText(value) {
  const cleaned = String(value || '')
    .replace(/\{@([^}]+)\}/g, (_match, content) => cleanTagContent(content))
    .replace(/\{=([^}]+)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  return enhanceImportantTerms(cleaned)
}

function renderEntry(entry) {
  if (entry === null || entry === undefined) {
    return ''
  }

  if (typeof entry === 'string' || typeof entry === 'number') {
    return cleanText(entry)
  }

  if (Array.isArray(entry)) {
    return entry.map(renderEntry).filter(Boolean).join('\n')
  }

  if (entry.type === 'bonus') {
    return `${entry.value >= 0 ? '+' : ''}${entry.value}`
  }

  if (entry.type === 'dice') {
    return cleanText(entry.toRoll || entry.displayText || entry.rollable || '')
  }

  if (entry.type === 'list') {
    return (entry.items || [])
      .map((item) => `- ${renderEntry(item)}`)
      .filter((item) => item.trim() !== '-')
      .join('\n')
  }

  if (entry.type === 'table') {
    const lines = []

    if (entry.caption) {
      lines.push(`**${cleanText(entry.caption)}**`)
    }

    if (entry.colLabels?.length) {
      lines.push(entry.colLabels.map(cleanText).join(' | '))
    }

    for (const row of entry.rows || []) {
      lines.push(
        row
          .map((cell) =>
            typeof cell === 'object' && cell?.roll
              ? String(cell.roll.exact || cell.roll.min || '')
              : renderEntry(cell)
          )
          .join(' | ')
      )
    }

    return lines.filter(Boolean).join('\n')
  }

  const title = entry.name ? cleanText(entry.name) : ''
  const body = renderEntry(entry.entries || entry.items || entry.entry)

  if (title && body) {
    return `**${title}**\n${body}`
  }

  return title ? `**${title}**` : body
}

function summarizeEntries(entries) {
  const text = renderEntry(entries)
  const firstParagraph = text
    .replace(/\*\*/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 40 && !line.startsWith('-'))

  return firstParagraph ? firstParagraph.slice(0, 900) : ''
}

function buildBenefits(entries = []) {
  return entries
    .filter((entry) => entry && typeof entry === 'object' && entry.name)
    .map((entry) => ({
      nombre: cleanText(entry.name),
      descripcion: renderEntry(entry.entries || entry.items || entry.entry),
    }))
}

async function resolveOwnerId() {
  const admin = await prisma.usuarios.findFirst({
    where: {
      roles: {
        codigo: 'administrador',
      },
    },
    select: { id: true },
  })

  if (admin) {
    return admin.id
  }

  const firstUser = await prisma.usuarios.findFirst({
    orderBy: { creado_en: 'asc' },
    select: { id: true },
  })

  if (!firstUser) {
    throw new Error('No hay usuarios para asignar la propiedad de las dotes.')
  }

  return firstUser.id
}

async function main() {
  const ownerId = await resolveOwnerId()
  const response = await fetch(FEATS_URL)

  if (!response.ok) {
    throw new Error(`No se pudo descargar feats.json: ${response.status}`)
  }

  const data = await response.json()
  let imported = 0

  for (const feat of data.feat || []) {
    const source = feat.source || '5etools'
    const slug = `${slugify(feat.name)}-${slugify(source)}`
    const payload = {
      creado_por_usuario_id: ownerId,
      nombre: feat.name,
      nombre_normalizado: normalizeText(feat.name),
      slug,
      idioma_codigo: 'en',
      fuente: source,
      edicion: source === 'XPHB' || source === 'PHB24' ? 'one' : 'classic',
      es_catalogo: true,
      categoria: feat.category || null,
      prerrequisitos: feat.prerequisite || [],
      descripcion: renderEntry(feat.entries || []),
      resumen: summarizeEntries(feat.entries || []),
      beneficios: buildBenefits(feat.entries || []),
      datos_fuente: {
        source,
        page: feat.page,
        srd: Boolean(feat.srd),
        basicRules: Boolean(feat.basicRules),
      },
      actualizado_en: new Date(),
    }

    const existing = await prisma.dotes.findFirst({
      where: {
        slug,
        idioma_codigo: 'en',
        fuente: source,
      },
      select: { id: true },
    })

    if (existing) {
      await prisma.dotes.update({
        where: { id: existing.id },
        data: {
          ...payload,
          creado_por_usuario_id: undefined,
        },
      })
    } else {
      await prisma.dotes.create({ data: payload })
    }

    imported += 1
  }

  console.log(`Importacion terminada: ${imported} dotes.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
