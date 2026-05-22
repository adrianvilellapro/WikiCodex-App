require('dotenv/config')

const https = require('node:https')

const { prisma } = require('../src/lib/prisma')
const { normalizeSpellText } = require('../src/services/spell.service')

const SOURCE_URL =
  'https://raw.githubusercontent.com/Jtachan/DnD-5.5-Spells-ES/main/spells/ed5_5/all.json'

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(
            new Error(`No se pudo descargar ${url}: ${response.statusCode}`)
          )
          response.resume()
          return
        }

        let raw = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          raw += chunk
        })
        response.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', reject)
  })
}

function htmlToText(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/p>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

function parseRangeFeet(value) {
  const first = Array.isArray(value) ? value[0] : value
  const match = String(first || '').match(/(\d+)/u)
  return match ? Number(match[1]) : null
}

function parseComponents(components = [], materials = null) {
  return {
    verbal: components.includes('V'),
    somatico: components.includes('S'),
    material: materials || (components.includes('M') ? 'Material' : ''),
    consumeMaterial: /consume|consum/iu.test(materials || ''),
  }
}

async function ensureSpellTraitType() {
  const existing = await prisma.tipos_rasgo.findFirst({
    where: { nombre: 'Hechizos' },
    select: { id: true },
  })

  if (existing) {
    return
  }

  await prisma.tipos_rasgo.create({
    data: {
      nombre: 'Hechizos',
      orden_visualizacion: 100,
    },
  })
}

async function main() {
  await ensureSpellTraitType()
  const spells = await fetchJson(SOURCE_URL)
  let imported = 0

  for (const spell of spells) {
    const nombre = spell.nombre?.trim()

    if (!nombre) {
      continue
    }

    const nivel = Number(spell.nivel || 0)
    const descripcionHtml = Array.isArray(spell.descripcion)
      ? spell.descripcion[0]
      : spell.descripcion
    const misc = [
      spell.ritual ? 'Ritual' : null,
      spell.concentracion ? 'Concentración' : null,
      ...(spell.componentes || []).map((component) =>
        component === 'V'
          ? 'Verbal'
          : component === 'S'
            ? 'Somático'
            : 'Material'
      ),
    ].filter(Boolean)

    await prisma.hechizos.upsert({
      where: {
        fuente_nombre_normalizado_nivel: {
          fuente: 'DnD-5.5-Spells-ES',
          nombre_normalizado: normalizeSpellText(nombre),
          nivel,
        },
      },
      update: {
        escuela: spell.escuela || null,
        clases: spell.clases || [],
        tipo_casteo: spell.tiempo_de_lanzamiento || null,
        alcance_pies: parseRangeFeet(spell.alcance),
        componentes: parseComponents(spell.componentes || [], spell.materiales),
        concentracion: Boolean(spell.concentracion),
        duracion: spell.duracion || null,
        tipo_salvacion: spell.tirada_de_salvacion || null,
        descripcion: htmlToText(descripcionHtml),
        descripcion_html: descripcionHtml || null,
        miscelanea: misc,
        es_publico: true,
        origen: 'sistema',
      },
      create: {
        nombre,
        nombre_normalizado: normalizeSpellText(nombre),
        nivel,
        escuela: spell.escuela || null,
        clases: spell.clases || [],
        tipo_casteo: spell.tiempo_de_lanzamiento || null,
        alcance_pies: parseRangeFeet(spell.alcance),
        componentes: parseComponents(spell.componentes || [], spell.materiales),
        concentracion: Boolean(spell.concentracion),
        duracion: spell.duracion || null,
        tipo_salvacion: spell.tirada_de_salvacion || null,
        descripcion: htmlToText(descripcionHtml),
        descripcion_html: descripcionHtml || null,
        miscelanea: misc,
        fuente: 'DnD-5.5-Spells-ES',
        origen: 'sistema',
        es_publico: true,
      },
    })

    imported += 1
  }

  console.log(`Hechizos importados o actualizados: ${imported}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
