import { ChevronDown, ChevronLeft, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { recordRecentActivity } from '../services/recent-activity'
import quickReferenceData from './rules/quick-reference-data.json'

const ICON_BASE_PATH = '/rules-reference/icons'

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getItemKey(sectionId, groupIndex, itemIndex) {
  return `${sectionId}-${groupIndex}-${itemIndex}`
}

function itemMatchesSearch(section, item, searchTerm) {
  const normalizedSearch = normalizeSearchText(searchTerm)

  if (!normalizedSearch) {
    return true
  }

  return normalizeSearchText(
    `${section.title} ${item.title} ${item.subtitle || ''} ${
      item.description || ''
    }`
  ).includes(normalizedSearch)
}

function getVisibleGroups(section, searchTerm) {
  return section.groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        itemMatchesSearch(section, item, searchTerm)
      ),
    }))
    .filter((group) => group.items.length)
}

function RuleIcon({ name, color, sizeClass = 'h-11 w-11' }) {
  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-md border border-black/10 bg-black p-1.5 shadow-sm`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      <img
        src={`${ICON_BASE_PATH}/${name}.png`}
        alt=""
        className="h-full w-full object-contain"
        loading="lazy"
      />
    </span>
  )
}

function RichText({ html, className = '' }) {
  return (
    <div
      className={`quick-reference-rich ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ReferenceItem({ item, section, type, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-16 min-w-0 items-center gap-3 rounded-xl border border-stroke bg-white px-3 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-glow max-sm:h-auto max-sm:min-h-16 max-sm:px-3 max-sm:py-3"
      aria-label={`Abrir ${item.title}`}
    >
      <RuleIcon
        name={item.icon || 'perspective-dice-six-faces-one'}
        color={section.color}
      />
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-sm font-bold text-ink"
          title={item.title}
        >
          {item.title}
        </span>
        <span
          className="mt-0.5 block truncate text-xs italic text-ink-soft"
          title={item.subtitle || type}
        >
          {item.subtitle || type}
        </span>
      </span>
    </button>
  )
}

function ReferenceSection({ section, isOpen, onToggle, onOpen, searchTerm }) {
  const visibleGroups = getVisibleGroups(section, searchTerm)
  const visibleItemsCount = visibleGroups.reduce(
    (total, group) => total + group.items.length,
    0
  )

  if (!visibleGroups.length) {
    return null
  }

  return (
    <article
      className="quick-reference-section overflow-hidden rounded-2xl border-8 bg-white shadow-card"
      style={{ borderColor: section.color }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-4 px-4 py-2 text-left text-white transition hover:brightness-110 max-sm:items-start"
        style={{ backgroundColor: section.color }}
        aria-expanded={isOpen}
      >
        <span className="min-w-0">
          <span className="block font-display text-2xl font-bold tracking-[-0.04em]">
            {section.title}
          </span>
          {section.aside ? (
            <span className="mt-1 block font-label text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
              {section.aside}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
          {visibleItemsCount}
          <ChevronDown
            className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {isOpen ? (
        <div className="space-y-4 p-4">
          {section.summary ? (
            <p className="text-sm italic leading-6 text-ink-soft">
              {section.summary}
            </p>
          ) : null}

          {visibleGroups.map((group, groupIndex) => (
            <div key={`${section.id}-${groupIndex}`} className="grid gap-3">
              {group.summary ? (
                <p className="text-sm italic leading-6 text-ink-soft">
                  {group.summary}
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                {group.items.map((item, itemIndex) => (
                  <ReferenceItem
                    key={getItemKey(section.id, groupIndex, itemIndex)}
                    item={item}
                    section={section}
                    type={section.type}
                    onOpen={() =>
                      onOpen({
                        item,
                        section,
                        type: section.type,
                        key: getItemKey(section.id, groupIndex, itemIndex),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function ReferenceModal({ activeItem, onClose }) {
  useEffect(() => {
    if (!activeItem) {
      return undefined
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeItem, onClose])

  if (!activeItem) {
    return null
  }

  const { item, section, type } = activeItem
  const bullets = item.bullets || []

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-black/50 px-3 py-5 backdrop-blur-sm sm:px-6 sm:py-10"
      onClick={onClose}
      role="presentation"
    >
      <article
        className="quick-reference-modal mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border-8 bg-white shadow-2xl"
        style={{ borderColor: section.color }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-reference-modal-title"
      >
        <header
          className="flex items-start justify-between gap-4 px-5 py-4 text-white"
          style={{ backgroundColor: section.color }}
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <RuleIcon
                name={item.icon || 'perspective-dice-six-faces-one'}
                color={section.color}
                sizeClass="h-10 w-10"
              />
              <h2
                id="quick-reference-modal-title"
                className="min-w-0 break-words font-display text-2xl font-bold tracking-[-0.04em]"
              >
                {item.title}
              </h2>
            </div>
            <p className="mt-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
              {type}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/12 text-white transition hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5">
          <p className="text-sm italic leading-6 text-ink-soft">
            {item.description || item.subtitle || ''}
          </p>

          {bullets.length ? (
            <div className="mt-5 divide-y divide-stroke/70">
              {bullets.map((bullet, index) => (
                <RichText
                  key={`${item.title}-${index}`}
                  html={bullet}
                  className="py-3 text-sm leading-7 text-ink-soft first:pt-0 last:pb-0"
                />
              ))}
            </div>
          ) : null}

          {item.reference ? (
            <p className="mt-5 text-xs italic leading-5 text-ink-muted">
              {item.reference}
            </p>
          ) : null}
        </div>
      </article>
    </div>
  )
}

function EmptySearchState({ onReset }) {
  return (
    <div className="rounded-2xl border border-stroke bg-white p-6 text-center shadow-card">
      <p className="font-display text-2xl font-bold tracking-[-0.04em] text-ink">
        No hay resultados
      </p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        Prueba con nombres como Atacar, Cegado, Descanso largo o Cobertura.
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

export function RulesQuickReferencePage() {
  const [activeItem, setActiveItem] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(
      quickReferenceData.sections.map((section) => [section.id, true])
    )
  )
  const totalItems = useMemo(
    () =>
      quickReferenceData.sections.reduce(
        (total, section) =>
          total +
          section.groups.reduce(
            (sectionTotal, group) => sectionTotal + group.items.length,
            0
          ),
        0
      ),
    []
  )
  const visibleSections = useMemo(
    () =>
      quickReferenceData.sections.filter(
        (section) => getVisibleGroups(section, searchTerm).length > 0
      ),
    [searchTerm]
  )

  useEffect(() => {
    recordRecentActivity({
      entityType: 'rule',
      entityId: 'rules-quick-reference',
      nombre: quickReferenceData.title,
      subtitulo: 'Referencia rapida',
      urlDestino: '/app/reglamento/referencia-rapida',
    })
  }, [])

  function toggleSection(sectionId) {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: current[sectionId] === false,
    }))
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
              Referencia Rápida
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-ink max-sm:text-3xl">
              {quickReferenceData.title}
            </h1>
          </div>
          <span className="rounded-full border border-brand/25 bg-brand/10 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            {quickReferenceData.edition} · {totalItems} entradas
          </span>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-soft">
          Pulsa cualquier efecto para ver su detalle. Las secciones están
          desplegadas de base y puedes plegarlas cuando quieras.
        </p>

        <label className="relative mt-5 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar acción, estado, entorno..."
            className="archive-input pl-11"
          />
        </label>
      </div>

      {visibleSections.length ? (
        <div className="grid gap-4">
          {visibleSections.map((section) => (
            <ReferenceSection
              key={section.id}
              section={section}
              isOpen={searchTerm ? true : openSections[section.id] !== false}
              searchTerm={searchTerm}
              onToggle={() => toggleSection(section.id)}
              onOpen={setActiveItem}
            />
          ))}
        </div>
      ) : (
        <EmptySearchState onReset={() => setSearchTerm('')} />
      )}

      <p className="text-center text-xs leading-5 text-ink-muted">
        Referencia basada en D&D 5e 2014 y adaptada visualmente a WikiCodex.
      </p>

      <ReferenceModal
        activeItem={activeItem}
        onClose={() => setActiveItem(null)}
      />
    </section>
  )
}
