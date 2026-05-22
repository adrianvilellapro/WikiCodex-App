require('dotenv').config()

const fs = require('fs')
const path = require('path')

const { prisma } = require('../src/lib/prisma')

const CACHE_PATH = path.resolve(__dirname, 'feat-translation-cache-es.json')

let translationCache = {}
let translationCacheDirty = false

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

function loadTranslationCache() {
  if (!fs.existsSync(CACHE_PATH)) {
    translationCache = {}
    return
  }

  try {
    translationCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    translationCache = {}
  }
}

function saveTranslationCache() {
  if (!translationCacheDirty) {
    return
  }

  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(translationCache, null, 2)}\n`)
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function normalizeSpanishDndTerms(value) {
  return String(value || '')
    .replace(/\bCA\b/g, 'Clase de Armadura')
    .replace(/\bclase de armadura\b/gi, 'Clase de Armadura')
    .replace(/\bpuntos de golpe\b/gi, 'puntos de golpe')
    .replace(
      /\bbonificaci[oó]n de competencia\b/gi,
      'bonificador de competencia'
    )
    .replace(
      /\bbonificaci[oó]n por competencia\b/gi,
      'bonificador de competencia'
    )
    .replace(/\bbonificador por competencia\b/gi, 'bonificador de competencia')
    .replace(/\bControl de fuerza\b/gi, 'prueba de Fuerza')
    .replace(/\bControl de destreza\b/gi, 'prueba de Destreza')
    .replace(/\bControl de constitución\b/gi, 'prueba de Constitución')
    .replace(/\bControl de inteligencia\b/gi, 'prueba de Inteligencia')
    .replace(/\bControl de sabiduría\b/gi, 'prueba de Sabiduría')
    .replace(/\bControl de carisma\b/gi, 'prueba de Carisma')
    .replace(/\btirada de ahorro\b/gi, 'tirada de salvación')
    .replace(/\btiradas de ahorro\b/gi, 'tiradas de salvación')
    .replace(
      /\btirada de salvación de fuerza\b/gi,
      'tirada de salvación de Fuerza'
    )
    .replace(
      /\btirada de salvación de destreza\b/gi,
      'tirada de salvación de Destreza'
    )
    .replace(
      /\btirada de salvación de constitución\b/gi,
      'tirada de salvación de Constitución'
    )
    .replace(
      /\btirada de salvación de inteligencia\b/gi,
      'tirada de salvación de Inteligencia'
    )
    .replace(
      /\btirada de salvación de sabiduría\b/gi,
      'tirada de salvación de Sabiduría'
    )
    .replace(
      /\btirada de salvación de carisma\b/gi,
      'tirada de salvación de Carisma'
    )
    .replace(/\bprueba de habilidad\b/gi, 'prueba de característica')
    .replace(/\bpruebas de habilidad\b/gi, 'pruebas de característica')
    .replace(/\bmodificador de habilidad\b/gi, 'modificador de característica')
    .replace(/\bacción de bonificación\b/gi, 'acción adicional')
    .replace(/\bacciones de bonificación\b/gi, 'acciones adicionales')
    .replace(/\bhechizos\b/gi, 'conjuros')
    .replace(/\bhechizo\b/gi, 'conjuro')
    .replace(/\bespacios de conjuro\b/gi, 'espacios de conjuro')
    .replace(/\bespacios de hechizo\b/gi, 'espacios de conjuro')
    .replace(/\bespacio de hechizo\b/gi, 'espacio de conjuro')
    .replace(/\bdescanso prolongado\b/gi, 'descanso largo')
    .replace(/\bElija\b/g, 'Elige')
    .replace(/\belija\b/g, 'elige')
}

function splitForTranslation(value, maxLength = 3200) {
  const paragraphs = String(value || '').split(/\n{2,}/)
  const chunks = []
  let current = ''

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph

    if (next.length <= maxLength) {
      current = next
      continue
    }

    if (current) {
      chunks.push(current)
    }

    if (paragraph.length <= maxLength) {
      current = paragraph
      continue
    }

    const sentences = paragraph.match(/[^.!?]+[.!?]+|\S+/g) || [paragraph]
    current = ''

    for (const sentence of sentences) {
      const sentenceNext = current ? `${current} ${sentence}` : sentence

      if (sentenceNext.length <= maxLength) {
        current = sentenceNext
      } else {
        if (current) {
          chunks.push(current)
        }
        current = sentence
      }
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

async function translateChunkToSpanish(value) {
  const text = String(value || '').trim()

  if (!text || !/[a-z]/i.test(text)) {
    return value
  }

  if (translationCache[text]) {
    return normalizeSpanishDndTerms(translationCache[text])
  }

  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: 'es',
    dt: 't',
    q: text,
  })

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?${params}`
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = await response.json()
      const translated = normalizeSpanishDndTerms(
        (payload?.[0] || []).map((part) => part?.[0] || '').join('')
      )

      translationCache[text] = translated
      translationCacheDirty = true
      saveTranslationCache()
      await sleep(80)

      return translated
    } catch (error) {
      if (attempt === 3) {
        console.warn(`No se pudo traducir: ${text.slice(0, 80)}`, error.message)
        return normalizeSpanishDndTerms(text)
      }

      await sleep(300 * attempt)
    }
  }

  return normalizeSpanishDndTerms(text)
}

async function translateManyTextsToSpanish(values = []) {
  const unique = [
    ...new Set(
      values
        .flatMap((value) => splitForTranslation(value))
        .map((value) => String(value || '').trim())
        .filter(
          (value) => value && /[a-z]/i.test(value) && !translationCache[value]
        )
    ),
  ]
  const maxBatchLength = 4500
  let index = 0

  while (index < unique.length) {
    const group = []
    let groupLength = 0

    while (index < unique.length) {
      const next = unique[index]
      const nextLength = next.length + 34

      if (group.length && groupLength + nextLength > maxBatchLength) {
        break
      }

      group.push(next)
      groupLength += nextLength
      index += 1
    }

    if (group.length === 1) {
      await translateChunkToSpanish(group[0])
      continue
    }

    const separators = group.slice(1).map((_, separatorIndex) => {
      return `<WIKICODEX_FEAT_SEGMENT_${separatorIndex + 1}>`
    })
    const batchedText = group
      .map((item, itemIndex) =>
        itemIndex === 0 ? item : `${separators[itemIndex - 1]}\n${item}`
      )
      .join('\n')
    const params = new URLSearchParams({
      client: 'gtx',
      sl: 'en',
      tl: 'es',
      dt: 't',
      q: batchedText,
    })

    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?${params}`
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = await response.json()
      const translatedText = normalizeSpanishDndTerms(
        (payload?.[0] || []).map((part) => part?.[0] || '').join('')
      )
      const parts = translatedText
        .split(/<WIKICODEX_FEAT_SEGMENT_\d+>/)
        .map((part) => normalizeSpanishDndTerms(part).trim())

      if (parts.length !== group.length) {
        throw new Error('La traduccion por lotes no preservo los separadores.')
      }

      group.forEach((sourceText, partIndex) => {
        translationCache[sourceText] = parts[partIndex]
      })
      translationCacheDirty = true
      saveTranslationCache()
      await sleep(110)
    } catch (error) {
      console.warn(
        `Lote de traduccion degradado a modo individual: ${error.message}`
      )

      for (const sourceText of group) {
        await translateChunkToSpanish(sourceText)
      }
    }
  }
}

async function translateTextToSpanish(value) {
  const text = String(value || '').trim()

  if (!text) {
    return ''
  }

  const chunks = splitForTranslation(text)
  const translated = []

  for (const chunk of chunks) {
    translated.push(await translateChunkToSpanish(chunk))
  }

  return normalizeSpanishDndTerms(translated.join('\n\n'))
}

function collectText(value, output = []) {
  if (typeof value === 'string') {
    if (value.trim()) {
      output.push(value)
    }
    return output
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, output))
    return output
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectText(item, output))
  }

  return output
}

async function translateBenefits(benefits = []) {
  const translated = []

  for (const benefit of benefits || []) {
    translated.push({
      ...benefit,
      nombre: await translateTextToSpanish(benefit.nombre),
      descripcion: await translateTextToSpanish(benefit.descripcion),
    })
  }

  return translated
}

async function translatePrerequisites(value = []) {
  if (!Array.isArray(value)) {
    return []
  }

  const translated = []

  for (const item of value) {
    if (item?.texto) {
      translated.push({
        ...item,
        texto: await translateTextToSpanish(item.texto),
      })
    } else {
      translated.push(item)
    }
  }

  return translated
}

async function main() {
  loadTranslationCache()

  const feats = await prisma.dotes.findMany({
    where: { idioma_codigo: 'en', es_catalogo: true },
    orderBy: [{ nombre: 'asc' }, { fuente: 'asc' }],
  })
  const strings = []

  for (const feat of feats) {
    collectText(feat.nombre, strings)
    collectText(feat.categoria, strings)
    collectText(feat.descripcion, strings)
    collectText(feat.resumen, strings)
    collectText(feat.beneficios || [], strings)
    collectText(feat.prerrequisitos || [], strings)
  }

  await translateManyTextsToSpanish(strings)

  let translatedCount = 0

  for (const feat of feats) {
    const translatedName = await translateTextToSpanish(feat.nombre)
    const slug = `${slugify(translatedName || feat.nombre)}-${slugify(
      feat.fuente || '5etools'
    )}-${feat.id.slice(0, 8)}`
    const payload = {
      creado_por_usuario_id: feat.creado_por_usuario_id,
      nombre: translatedName || feat.nombre,
      nombre_normalizado: normalizeText(translatedName || feat.nombre),
      slug,
      idioma_codigo: 'es',
      fuente: feat.fuente,
      edicion: feat.edicion,
      es_catalogo: true,
      categoria: feat.categoria
        ? await translateTextToSpanish(feat.categoria)
        : null,
      prerrequisitos: await translatePrerequisites(feat.prerrequisitos || []),
      descripcion: await translateTextToSpanish(feat.descripcion),
      resumen: await translateTextToSpanish(feat.resumen),
      beneficios: await translateBenefits(feat.beneficios || []),
      datos_fuente: {
        ...(feat.datos_fuente || {}),
        traduccion: 'completa_es',
        nombreOriginal: feat.nombre,
        doteOriginalId: feat.id,
      },
      actualizado_en: new Date(),
    }
    const existing = await prisma.dotes.findFirst({
      where: {
        idioma_codigo: 'es',
        fuente: feat.fuente,
        datos_fuente: {
          path: ['doteOriginalId'],
          equals: feat.id,
        },
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

    translatedCount += 1
  }

  saveTranslationCache()
  console.log(`Traduccion terminada: ${translatedCount} dotes en espanol.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    saveTranslationCache()
    await prisma.$disconnect()
  })
