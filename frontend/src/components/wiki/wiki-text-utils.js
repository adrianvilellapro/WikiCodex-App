export const WIKI_TYPES = [
  { tipo: 'personaje', etiqueta: 'Personaje' },
  { tipo: 'objeto', etiqueta: 'Objeto' },
  { tipo: 'lugar', etiqueta: 'Lugar' },
  { tipo: 'campana', etiqueta: 'Campaña' },
  { tipo: 'aventura', etiqueta: 'Aventura' },
  { tipo: 'arco', etiqueta: 'Arco' },
  { tipo: 'partida', etiqueta: 'Partida' },
  { tipo: 'hechizo', etiqueta: 'Hechizo' },
  { tipo: 'poder', etiqueta: 'Poder' },
]

export function normalizeWikiType(value) {
  const normalized = String(value || '')
    .trim()
    .normalize('NFC')
    .toLowerCase()

  if (normalized === 'campaña' || normalized === 'capaña') {
    return 'campana'
  }

  return normalized
}

export function parseWikiLinkContent(content) {
  const [targetPart, aliasPart] = String(content || '').split('|')
  const colonIndex = targetPart.indexOf(':')

  if (colonIndex <= 0) {
    return null
  }

  const tipo = normalizeWikiType(targetPart.slice(0, colonIndex))
  const nombre = targetPart.slice(colonIndex + 1).trim()
  const alias = aliasPart?.trim() || ''

  if (!tipo || !nombre) {
    return null
  }

  return {
    tipo,
    nombre,
    alias,
    key: `${tipo}:${nombre}`,
  }
}

export function extractWikiReferences(text) {
  const references = new Map()
  const pattern = /\[\[([^\]]+)\]\]/g
  let match

  while ((match = pattern.exec(String(text || '')))) {
    const parsed = parseWikiLinkContent(match[1])
    if (parsed && !references.has(parsed.key)) {
      references.set(parsed.key, {
        key: parsed.key,
        tipo: parsed.tipo,
        nombre: parsed.nombre,
      })
    }
  }

  return [...references.values()]
}
