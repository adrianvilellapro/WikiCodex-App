import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  Eye,
  ListTree,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { recordRecentActivity } from '../services/recent-activity'
import rulesData from './rules/general-rules-data.json'

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function findPageById(sections, pageId) {
  for (const section of sections) {
    const page = section.pages.find((item) => item.id === pageId)
    if (page) {
      return { section, page }
    }
  }

  return null
}

function getFilteredSections(searchTerm) {
  const normalizedSearch = normalizeSearchText(searchTerm)

  if (!normalizedSearch) {
    return rulesData.sections
  }

  return rulesData.sections
    .map((section) => {
      const sectionMatches = normalizeSearchText(section.title).includes(
        normalizedSearch
      )
      const pages = sectionMatches
        ? section.pages
        : section.pages.filter((page) =>
            normalizeSearchText(`${section.title} ${page.title}`).includes(
              normalizedSearch
            )
          )

      return { ...section, pages }
    })
    .filter((section) => section.pages.length)
}

function RulesRichText({ html }) {
  return (
    <div
      className="rules-rich text-sm leading-7 text-ink-soft"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function scrollToRulePage(pageId) {
  document.getElementById(pageId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function RulesIndex({
  sections,
  activePageId,
  openSections,
  onSelectPage,
  onShowBook,
  onToggleSection,
  isIndexOpen,
  onToggleIndex,
}) {
  if (!isIndexOpen) {
    return (
      <aside className="rounded-2xl border border-stroke bg-white p-2 shadow-card lg:sticky lg:top-6 lg:max-h-[calc(100vh-4rem)]">
        <button
          type="button"
          onClick={onToggleIndex}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand transition hover:border-brand/50 hover:bg-brand/15"
          aria-label="Desplegar índice"
          title="Desplegar índice"
        >
          <ListTree className="h-5 w-5" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="rounded-2xl border border-stroke bg-white p-4 shadow-card lg:sticky lg:top-6 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-3 text-brand">
        <div className="flex items-center gap-2">
          <ListTree className="h-4 w-4" />
          <p className="font-label text-[10px] font-black uppercase tracking-[0.18em]">
            Índice
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleIndex}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stroke text-ink-soft transition hover:border-brand hover:text-brand"
          aria-label="Plegar índice"
          title="Plegar índice"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onShowBook}
        className={`mt-4 w-full rounded-lg px-3 py-2 text-left text-xs font-bold leading-5 transition ${
          activePageId
            ? 'text-ink-soft hover:bg-surface-strong hover:text-ink'
            : 'bg-brand/10 text-brand'
        }`}
      >
        Reglamento completo
      </button>

      <div className="mt-4 space-y-3">
        {sections.map((section) => {
          const isOpen = openSections[section.id] !== false

          return (
            <div key={section.id}>
              <button
                type="button"
                onClick={() => onToggleSection(section.id)}
                className="flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-surface-strong"
                aria-expanded={isOpen}
              >
                <span className="break-words font-label text-[10px] font-black uppercase tracking-[0.14em] text-ink">
                  {section.title}
                </span>
                <ChevronDown
                  className={`mt-0.5 h-4 w-4 shrink-0 text-ink-muted transition ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen ? (
                <div className="mt-1 grid gap-1">
                  {section.pages.map((page) => {
                    const isActive = page.id === activePageId

                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => onSelectPage(page.id)}
                        className={`rounded-lg px-3 py-2 text-left text-xs leading-5 transition ${
                          isActive
                            ? 'bg-brand/10 font-semibold text-brand'
                            : 'text-ink-soft hover:bg-surface-strong hover:text-ink'
                        }`}
                      >
                        {page.title}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function EmptyRulesSearch({ onReset }) {
  return (
    <div className="rounded-2xl border border-stroke bg-white p-8 text-center shadow-card">
      <p className="font-display text-2xl font-bold tracking-[-0.04em] text-ink">
        No hay reglas con ese nombre
      </p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        El buscador localiza secciones y entradas grandes del índice, no cada
        palabra del texto.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 rounded-lg bg-brand px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black"
      >
        Limpiar búsqueda
      </button>
    </div>
  )
}

function RulesBook({ sections }) {
  return (
    <article className="min-w-0 rounded-2xl border border-stroke bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            Documento unificado
          </p>
          <h2 className="mt-2 break-words font-display text-4xl font-bold tracking-[-0.06em] text-ink max-sm:text-3xl">
            Reglamento completo
          </h2>
        </div>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
          <BookOpen className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-8 grid gap-10">
        {sections.map((section) => (
          <section key={section.id} className="min-w-0">
            <h3 className="border-b border-stroke pb-3 font-display text-3xl font-bold tracking-[-0.05em] text-ink max-sm:text-2xl">
              {section.title}
            </h3>
            <div className="mt-6 grid gap-8">
              {section.pages.map((page) => (
                <article
                  key={page.id}
                  id={page.id}
                  data-rule-page-id={page.id}
                  className="min-w-0 scroll-mt-8 rounded-xl border border-stroke/70 bg-surface/35 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4 className="break-words font-display text-2xl font-bold tracking-[-0.04em] text-ink">
                      {page.title}
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('wikicodex:rule-single-page', {
                            detail: page.id,
                          })
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-ink-soft transition hover:border-brand hover:text-brand"
                      aria-label={`Ver solo ${page.title}`}
                      title="Ver solo"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4">
                    <RulesRichText html={page.html} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}

function RulesSinglePage({ selected }) {
  return (
    <article className="min-w-0 rounded-2xl border border-stroke bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            {selected.section.title}
          </p>
          <h2 className="mt-2 break-words font-display text-4xl font-bold tracking-[-0.06em] text-ink max-sm:text-3xl">
            {selected.page.title}
          </h2>
        </div>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
          <BookOpen className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-6">
        <RulesRichText html={selected.page.html} />
      </div>
    </article>
  )
}

export function RulesGeneralPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activePageId, setActivePageId] = useState(null)
  const [isIndexOpen, setIsIndexOpen] = useState(true)
  const [currentBookPageId, setCurrentBookPageId] = useState(
    rulesData.sections[0]?.pages[0]?.id || null
  )
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(rulesData.sections.map((section) => [section.id, true]))
  )
  const filteredSections = useMemo(
    () => getFilteredSections(searchTerm),
    [searchTerm]
  )
  const activeMatch = useMemo(
    () => findPageById(filteredSections, activePageId),
    [activePageId, filteredSections]
  )

  useEffect(() => {
    recordRecentActivity({
      entityType: 'rule',
      entityId: 'rules-general',
      nombre: rulesData.title,
      subtitulo: 'Reglamento general',
      urlDestino: '/app/reglamento/general',
    })
  }, [])

  function toggleIndexSection(sectionId) {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: current[sectionId] === false,
    }))
  }

  useEffect(() => {
    function handleShowSinglePage(event) {
      setActivePageId(event.detail)
    }

    window.addEventListener('wikicodex:rule-single-page', handleShowSinglePage)
    return () =>
      window.removeEventListener(
        'wikicodex:rule-single-page',
        handleShowSinglePage
      )
  }, [])

  useEffect(() => {
    if (activeMatch) {
      return undefined
    }

    const pageElements = [...document.querySelectorAll('[data-rule-page-id]')]

    if (!pageElements.length) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          )[0]

        if (visibleEntry) {
          setCurrentBookPageId(visibleEntry.target.dataset.rulePageId)
        }
      },
      {
        rootMargin: '-22% 0px -68% 0px',
        threshold: 0,
      }
    )

    pageElements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [activeMatch, filteredSections])

  function handleSelectPage(pageId) {
    if (activeMatch) {
      setActivePageId(pageId)
      return
    }

    setCurrentBookPageId(pageId)
    scrollToRulePage(pageId)
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <Link
          to="/app/reglamento"
          className="inline-flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
          Reglamento y Recursos
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              Reglamento estándar
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-ink max-sm:text-3xl">
              {rulesData.title}
            </h1>
          </div>
          <span className="rounded-full border border-brand/25 bg-brand/10 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            {rulesData.sections.length} secciones
          </span>
        </div>

        <p className="mt-4 max-w-4xl text-sm leading-6 text-ink-soft">
          Reglas SRD integradas desde {rulesData.source}. Se omiten clases,
          subclases, razas, conjuros concretos, monstruos individuales y objetos
          mágicos A-Z concretos para mantener esta página como reglamento de
          consulta.
        </p>

        <label className="relative mt-5 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setActivePageId(null)
            }}
            placeholder="Buscar una regla o sección del índice..."
            className="archive-input pl-11"
          />
        </label>
      </div>

      {filteredSections.length ? (
        <div
          className={`grid gap-5 ${
            isIndexOpen
              ? 'lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]'
              : 'lg:grid-cols-[3.5rem_minmax(0,1fr)]'
          }`}
        >
          <RulesIndex
            sections={filteredSections}
            activePageId={activeMatch?.page.id || currentBookPageId}
            openSections={openSections}
            onSelectPage={handleSelectPage}
            onShowBook={() => setActivePageId(null)}
            onToggleSection={toggleIndexSection}
            isIndexOpen={isIndexOpen}
            onToggleIndex={() => setIsIndexOpen((current) => !current)}
          />

          {activeMatch ? (
            <RulesSinglePage selected={activeMatch} />
          ) : (
            <RulesBook sections={filteredSections} />
          )}
        </div>
      ) : (
        <EmptyRulesSearch onReset={() => setSearchTerm('')} />
      )}
    </section>
  )
}
