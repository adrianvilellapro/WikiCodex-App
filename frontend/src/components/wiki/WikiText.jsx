import { Fragment, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { cn } from '../../lib/cn'
import { api } from '../../services/http'
import { extractWikiReferences, parseWikiLinkContent } from './wiki-text-utils'

async function resolveWikiReferences(references) {
  if (!references.length) {
    return { items: [] }
  }

  const { data } = await api.post('/wiki/resolve', {
    referencias: references,
  })
  return data
}

function splitFormattedText(text) {
  const parts = []
  const pattern = /(\*\*[^*]+\*\*|==[^=]+==|\*[^*\n]+\*)/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }

    const value = match[0]
    if (value.startsWith('**')) {
      parts.push({ type: 'bold', value: value.slice(2, -2) })
    } else if (value.startsWith('==')) {
      parts.push({ type: 'highlight', value: value.slice(2, -2) })
    } else {
      parts.push({ type: 'italic', value: value.slice(1, -1) })
    }

    lastIndex = match.index + value.length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts
}

function renderPlainSegment(text, keyPrefix) {
  return splitFormattedText(text).map((part, index) => {
    const key = `${keyPrefix}-${index}`

    if (part.type === 'bold') {
      return (
        <strong key={key} className="font-bold text-ink">
          {part.value}
        </strong>
      )
    }

    if (part.type === 'italic') {
      return (
        <em key={key} className="italic">
          {part.value}
        </em>
      )
    }

    if (part.type === 'highlight') {
      return (
        <mark
          key={key}
          className="rounded bg-brand/15 px-1 font-semibold text-brand"
        >
          {part.value}
        </mark>
      )
    }

    return <Fragment key={key}>{part.value}</Fragment>
  })
}

function renderWikiLink(parsed, resolution, index, disableLinks = false) {
  if (resolution?.status === 'resolved') {
    const label = parsed.alias || resolution.item.nombre

    if (disableLinks) {
      return (
        <span
          key={`wiki-${index}`}
          className="font-semibold text-brand"
          title={`${resolution.item.tipoEtiqueta}: ${resolution.item.nombre}`}
        >
          {label}
        </span>
      )
    }

    return (
      <Link
        key={`wiki-${index}`}
        to={resolution.item.url}
        className="font-semibold text-brand underline decoration-brand/35 underline-offset-4 transition hover:text-brand-strong hover:decoration-brand"
        title={`${resolution.item.tipoEtiqueta}: ${resolution.item.nombre}`}
      >
        {label}
      </Link>
    )
  }

  return (
    <span
      key={`wiki-${index}`}
      className="rounded border border-stroke bg-surface-strong px-1.5 py-0.5 text-[0.92em] font-semibold text-ink-muted"
      title={resolution?.status || 'Referencia no resuelta'}
    >
      {resolution?.label || 'Referencia no resuelta'}
    </span>
  )
}

function renderInlineToken(token, index) {
  return (
    <strong
      key={`token-${index}`}
      className="font-bold text-ink"
      title={token.label}
    >
      {token.value}
    </strong>
  )
}

export function WikiText({
  children,
  text,
  className,
  emptyText = null,
  disableLinks = false,
  inlineTokens = [],
}) {
  const value = String(text ?? children ?? '')
  const references = useMemo(() => extractWikiReferences(value), [value])
  const inlineTokenMap = useMemo(() => {
    const map = new Map()
    for (const token of inlineTokens || []) {
      if (token?.token && token?.value) {
        map.set(token.token, token)
        map.set(token.token.toLowerCase(), token)
      }
    }
    return map
  }, [inlineTokens])
  const resolveQuery = useQuery({
    queryKey: ['wiki-text-resolve', references],
    queryFn: () => resolveWikiReferences(references),
    enabled: references.length > 0,
    staleTime: 60 * 1000,
  })
  const resolvedByKey = useMemo(() => {
    const map = new Map()
    for (const item of resolveQuery.data?.items || []) {
      map.set(item.key, item)
    }
    return map
  }, [resolveQuery.data?.items])

  if (!value.trim()) {
    return emptyText ? <>{emptyText}</> : null
  }

  const nodes = []
  const pattern = /(\[\[([^\]]+)\]\]|\{([^{}\n]+)\})/g
  let lastIndex = 0
  let match
  let nodeIndex = 0

  while ((match = pattern.exec(value))) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderPlainSegment(
          value.slice(lastIndex, match.index),
          `text-${nodeIndex}`
        )
      )
    }

    if (match[2] !== undefined) {
      const parsed = parseWikiLinkContent(match[2])
      if (parsed) {
        nodes.push(
          renderWikiLink(
            parsed,
            resolvedByKey.get(parsed.key),
            nodeIndex,
            disableLinks
          )
        )
      } else {
        nodes.push(...renderPlainSegment(match[0], `invalid-${nodeIndex}`))
      }
    } else {
      const token =
        inlineTokenMap.get(match[0]) ||
        inlineTokenMap.get(match[0].toLowerCase())
      if (token) {
        nodes.push(renderInlineToken(token, nodeIndex))
      } else {
        nodes.push(...renderPlainSegment(match[0], `token-${nodeIndex}`))
      }
    }

    lastIndex = match.index + match[0].length
    nodeIndex += 1
  }

  if (lastIndex < value.length) {
    nodes.push(
      ...renderPlainSegment(value.slice(lastIndex), `tail-${nodeIndex}`)
    )
  }

  return (
    <span
      className={cn(
        'whitespace-pre-line break-words [overflow-wrap:anywhere]',
        className
      )}
    >
      {nodes}
    </span>
  )
}
