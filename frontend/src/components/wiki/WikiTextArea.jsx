import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'

import { cn } from '../../lib/cn'
import { api } from '../../services/http'
import { WIKI_TYPES, normalizeWikiType } from './wiki-text-utils'

function getWikiTrigger(value, cursorPosition) {
  const beforeCursor = String(value || '').slice(0, cursorPosition)
  const openIndex = beforeCursor.lastIndexOf('[[')

  if (openIndex < 0) {
    return null
  }

  const closeIndex = beforeCursor.lastIndexOf(']]')
  if (closeIndex > openIndex) {
    return null
  }

  const raw = beforeCursor.slice(openIndex + 2)
  if (raw.includes('\n')) {
    return null
  }

  const aliasIndex = raw.indexOf('|')
  if (aliasIndex >= 0) {
    return null
  }

  const colonIndex = raw.indexOf(':')
  if (colonIndex < 0) {
    return {
      mode: 'type',
      start: openIndex + 2,
      raw,
      query: raw.trim().toLowerCase(),
    }
  }

  return {
    mode: 'entity',
    start: openIndex + 2,
    raw,
    type: normalizeWikiType(raw.slice(0, colonIndex)),
    query: raw.slice(colonIndex + 1).trim(),
  }
}

function getInlineTokenTrigger(value, cursorPosition) {
  const beforeCursor = String(value || '').slice(0, cursorPosition)
  const openIndex = beforeCursor.lastIndexOf('{')

  if (openIndex < 0) {
    return null
  }

  const closeIndex = beforeCursor.lastIndexOf('}')
  if (closeIndex > openIndex) {
    return null
  }

  const raw = beforeCursor.slice(openIndex + 1)
  if (raw.includes('\n')) {
    return null
  }

  return {
    start: openIndex,
    raw,
    query: raw.trim().toLowerCase(),
  }
}

function normalizeInlineTokenSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

async function searchWikiEntities({ type, query }) {
  if (!type) {
    return []
  }

  const { data } = await api.get('/wiki/search', {
    params: {
      tipo: type,
      q: query,
      limit: 8,
    },
  })

  return data.items || []
}

export function WikiTextArea({
  value,
  onChange,
  className,
  helperClassName,
  inlineTokens = [],
  inlineTokenHelp = '',
  ...props
}) {
  const textareaRef = useRef(null)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isFocused, setIsFocused] = useState(false)
  const trigger = useMemo(
    () => getWikiTrigger(value, cursorPosition),
    [cursorPosition, value]
  )
  const inlineTokenTrigger = useMemo(
    () => getInlineTokenTrigger(value, cursorPosition),
    [cursorPosition, value]
  )
  const matchingTypes = useMemo(() => {
    if (trigger?.mode !== 'type') {
      return []
    }

    return WIKI_TYPES.filter(
      (type) =>
        !trigger.query ||
        type.tipo.includes(trigger.query) ||
        type.etiqueta.toLowerCase().includes(trigger.query)
    )
  }, [trigger])
  const searchQuery = useQuery({
    queryKey: ['wiki-search', trigger?.type, trigger?.query],
    queryFn: () =>
      searchWikiEntities({ type: trigger?.type, query: trigger?.query }),
    enabled: isFocused && trigger?.mode === 'entity' && Boolean(trigger.type),
    staleTime: 30 * 1000,
  })
  const showSuggestions =
    isFocused &&
    ((trigger?.mode === 'type' && matchingTypes.length > 0) ||
      (trigger?.mode === 'entity' && searchQuery.data?.length > 0))
  const matchingInlineTokens = useMemo(() => {
    if (!inlineTokenTrigger || !inlineTokens.length) {
      return []
    }

    return inlineTokens.filter((token) => {
      if (token.hiddenFromPicker) {
        return false
      }

      const haystack = normalizeInlineTokenSearch(
        `${token.label || ''} ${token.value || ''} ${token.token || ''}`
      )
      const query = normalizeInlineTokenSearch(inlineTokenTrigger.query)

      return !query || haystack.includes(query)
    })
  }, [inlineTokenTrigger, inlineTokens])
  const showInlineTokenSuggestions =
    isFocused &&
    !showSuggestions &&
    inlineTokenTrigger &&
    matchingInlineTokens.length > 0

  function emitChange(nextValue, nextCursor = null) {
    onChange?.({ target: { value: nextValue } })

    if (nextCursor !== null) {
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
        setCursorPosition(nextCursor)
      })
    }
  }

  function insertText(replacement) {
    if (!trigger) {
      return
    }

    const text = String(value || '')
    const nextValue =
      text.slice(0, trigger.start) + replacement + text.slice(cursorPosition)
    emitChange(nextValue, trigger.start + replacement.length)
  }

  function insertInlineToken(token) {
    if (!inlineTokenTrigger) {
      return
    }

    const text = String(value || '')
    const nextValue =
      text.slice(0, inlineTokenTrigger.start) +
      token.token +
      text.slice(cursorPosition)

    emitChange(nextValue, inlineTokenTrigger.start + token.token.length)
  }

  return (
    <div className="relative min-w-0">
      <textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          setCursorPosition(event.target.selectionStart || 0)
          onChange?.(event)
        }}
        onSelect={(event) =>
          setCursorPosition(event.target.selectionStart || 0)
        }
        onFocus={(event) => {
          setIsFocused(true)
          setCursorPosition(event.target.selectionStart || 0)
          props.onFocus?.(event)
        }}
        onBlur={(event) => {
          window.setTimeout(() => setIsFocused(false), 140)
          props.onBlur?.(event)
        }}
        className={className}
      />

      {showSuggestions ? (
        <div className="absolute left-2 right-2 top-full z-40 mt-2 max-h-64 overflow-auto rounded-xl border border-stroke bg-white p-2 shadow-xl">
          {trigger.mode === 'type'
            ? matchingTypes.map((type) => (
                <button
                  key={type.tipo}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertText(`${type.tipo}:`)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink transition hover:bg-brand/10 hover:text-brand"
                >
                  <span>{type.etiqueta}</span>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {type.tipo}:
                  </span>
                </button>
              ))
            : (searchQuery.data || []).map((item) => (
                <button
                  key={`${item.tipo}:${item.id}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertText(`${item.tipo}:${item.nombre}]]`)}
                  className="grid w-full gap-1 rounded-lg px-3 py-2 text-left transition hover:bg-brand/10"
                >
                  <span className="break-words text-sm font-bold text-ink [overflow-wrap:anywhere]">
                    {item.nombre}
                  </span>
                  <span className="break-words text-[11px] font-semibold text-ink-muted [overflow-wrap:anywhere]">
                    {item.tipoEtiqueta}
                    {item.contexto ? ` · ${item.contexto}` : ''}
                  </span>
                </button>
              ))}
        </div>
      ) : null}

      {showInlineTokenSuggestions ? (
        <div className="absolute left-2 right-2 top-full z-40 mt-2 max-h-64 overflow-auto rounded-xl border border-stroke bg-white p-2 shadow-xl">
          {matchingInlineTokens.map((token) => (
            <button
              key={token.token}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertInlineToken(token)}
              className="grid w-full gap-1 rounded-lg px-3 py-2 text-left transition hover:bg-brand/10"
            >
              <span className="break-words text-sm font-bold text-ink [overflow-wrap:anywhere]">
                {token.label}
              </span>
              <span className="break-words text-[11px] font-semibold text-ink-muted [overflow-wrap:anywhere]">
                {token.value} · {token.token}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className={cn('mt-2 flex justify-end', helperClassName)}>
        <div className="group relative inline-flex">
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-stroke bg-white text-ink-muted transition hover:border-brand hover:text-brand focus:border-brand focus:text-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            aria-label="Ayuda de texto wiki"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-stroke bg-white px-3 py-2 text-[11px] font-semibold leading-5 text-ink-soft opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-within:opacity-100">
            Usa [[tipo:nombre]], [[tipo:nombre|texto visible]], **negrita**,
            *cursiva* y ==destacado==.
            {inlineTokenHelp ? (
              <span className="mt-1 block">{inlineTokenHelp}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
