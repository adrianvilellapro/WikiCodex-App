import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

import { ObjectPreviewImage } from '../components/ui/ObjectPreviewImage'
import { CampaignCheckboxFilter } from '../components/ui/CampaignCheckboxFilter'
import { useIncrementalCardFeed } from '../hooks/useIncrementalCardFeed'
import { cn } from '../lib/cn'
import { fetchCampaigns } from './campaign-detail/api'
import { fetchObjectArchiveOptions, fetchObjects } from './object-detail/api'

const TABS = [
  {
    id: 'objects',
    label: 'Objetos',
    title: 'Biblioteca de objetos',
    eyebrow: 'Archivo global',
    description:
      'Consulta objetos visibles, reliquias y versiones vinculadas a tus campañas. Cada ficha respeta privacidad, permisos y acceso de campaña.',
    emptyTitle: 'Todavía no hay objetos visibles',
  },
  {
    id: 'tierlist',
    label: 'TierList',
    title: 'TierList de objetos',
    eyebrow: 'Escala de rareza',
    description:
      'Agrupa todos los objetos visibles con tier asignada, de mayor a menor rareza.',
    emptyTitle: 'Todavía no hay objetos con tier visible',
  },
]

const TYPE_LABELS = {
  no_magico: 'No mágico',
  magico: 'Mágico',
  reliquia: 'Reliquia',
}

const MODIFIER_LABELS = {
  ataque: 'Ataque',
  dano: 'Daño',
  cd: 'CD',
  clase_armadura: 'Clase armadura',
  pruebas_caracteristica: 'Pruebas característica',
  otro: 'Otro',
}

const SORT_OPTIONS = [
  ['created_desc', 'Subida reciente'],
  ['created_asc', 'Subida antigua'],
  ['name_asc', 'Nombre A-Z'],
  ['name_desc', 'Nombre Z-A'],
  ['modifier_desc', 'Modificador descendente'],
  ['modifier_asc', 'Modificador ascendente'],
]

function emptyFilters() {
  return {
    q: '',
    tierIds: [],
    campaignIds: null,
    tipoMagicoCodigos: [],
    modifierTypeCodes: [],
    modifierMin: '',
    modifierMax: '',
    matchMode: 'all',
    sort: 'created_desc',
  }
}

function ObjectCard({ item }) {
  const location = useLocation()
  const isPreviewOnly = item.modoVista === 'preview'
  const primaryModifier = item.modificadores?.[0] || null

  return (
    <Link
      to={`/app/objetos/${item.id}`}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="theme-sheet-card archive-responsive-card group overflow-hidden border shadow-card transition hover:-translate-y-1 hover:border-brand/50"
    >
      <div className="archive-responsive-image relative h-64 overflow-hidden bg-ink">
        <ObjectPreviewImage
          src={item.imagenPrincipalUrl}
          alt={item.nombre}
          className="h-full w-full"
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 33vw, 50vw"
        />
      </div>
      <div className="archive-responsive-body p-5">
        <p className="font-label text-[9px] font-black uppercase tracking-[0.22em] text-brand">
          {item.tier?.nombre || 'Sin tier'}
        </p>
        <h2 className="mt-1 line-clamp-1 font-display text-2xl font-bold tracking-[-0.04em] text-ink">
          {item.nombre}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="archive-chip">
            {TYPE_LABELS[item.tipoMagicoCodigo] || 'Objeto'}
          </span>
          {isPreviewOnly ? (
            <span className="archive-chip border-slate-300 bg-slate-100 text-slate-600">
              Solo vista previa
            </span>
          ) : null}
          {primaryModifier ? (
            <span className="archive-chip">
              {MODIFIER_LABELS[primaryModifier.tipoCodigo] || 'Mod.'}{' '}
              {primaryModifier.valor > 0
                ? `+${primaryModifier.valor}`
                : primaryModifier.valor}
            </span>
          ) : null}
        </div>
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-ink-soft">
          {item.descripcion || 'Objeto sin descripción visible.'}
        </p>
      </div>
    </Link>
  )
}

function FilterButtonGroup({ title, options, selectedValues, onChange }) {
  const selectedSet = new Set(selectedValues)

  return (
    <div>
      <p className="mb-2 font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              onChange(
                selectedSet.has(option.value)
                  ? selectedValues.filter((value) => value !== option.value)
                  : [...selectedValues, option.value]
              )
            }
            className={cn(
              'rounded-xl px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] transition',
              selectedSet.has(option.value)
                ? 'bg-brand text-black'
                : 'bg-white text-ink-soft hover:text-brand'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RangeField({ label, min, max, onMinChange, onMaxChange }) {
  return (
    <div>
      <p className="mb-2 font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={min}
          onChange={(event) => onMinChange(event.target.value)}
          className="archive-input h-11 rounded-xl"
          inputMode="decimal"
          placeholder="Mín."
        />
        <input
          value={max}
          onChange={(event) => onMaxChange(event.target.value)}
          className="archive-input h-11 rounded-xl"
          inputMode="decimal"
          placeholder="Máx."
        />
      </div>
    </div>
  )
}

function FilterSection({ title, activeCount = 0, children }) {
  const [open, setOpen] = useState(false)

  return (
    <article className="relative overflow-visible rounded-2xl border border-stroke bg-surface-strong/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <span>
          <span className="block font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink">
            {title}
          </span>
          {!open && activeCount ? (
            <span className="mt-1 block text-xs font-semibold text-brand">
              {activeCount} activo{activeCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-2">
          {activeCount ? (
            <span className="rounded-full bg-brand px-2 py-1 font-label text-[9px] font-black uppercase tracking-[0.12em] text-black">
              {activeCount}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              'h-5 w-5 text-ink-muted transition',
              open && 'rotate-180'
            )}
          />
        </span>
      </button>
      {open ? (
        <div className="border-t border-stroke p-4">{children}</div>
      ) : null}
    </article>
  )
}

function ObjectFiltersPanel({ tab, filters, setFilters, options }) {
  const [showFilters, setShowFilters] = useState(false)
  const showTierFilter = tab !== 'tierlist'
  const typeCount = filters.tipoMagicoCodigos.length
  const modifierTypeCount = filters.modifierTypeCodes.length
  const modifierRangeCount = [filters.modifierMin, filters.modifierMax].filter(
    (value) => String(value).trim()
  ).length
  const tierCount = showTierFilter ? filters.tierIds.length : 0
  const campaignCount = Array.isArray(filters.campaignIds)
    ? filters.campaignIds.length
    : 0
  const matchCount = filters.matchMode === 'any' ? 1 : 0
  const classificationCount = tierCount + typeCount
  const modifierCount = modifierTypeCount + modifierRangeCount
  const activeFilterCount = classificationCount + modifierCount + matchCount

  return (
    <div className="grid gap-4 rounded-3xl border border-stroke bg-surface p-4 shadow-card">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={filters.q}
            onChange={(event) =>
              setFilters((current) => ({ ...current, q: event.target.value }))
            }
            className="archive-input h-11 w-full rounded-xl pl-12"
            style={{ paddingLeft: '3.15rem' }}
            placeholder={
              tab === 'tierlist' ? 'Buscar en TierList' : 'Buscar en objetos'
            }
          />
        </div>
        <select
          value={filters.sort}
          onChange={(event) =>
            setFilters((current) => ({ ...current, sort: event.target.value }))
          }
          className="archive-input h-11 rounded-xl"
        >
          {SORT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilterCount ? (
            <span className="rounded-full bg-brand px-2 py-0.5 text-black">
              {activeFilterCount}
            </span>
          ) : null}
          <ChevronDown
            className={cn('h-4 w-4 transition', showFilters && 'rotate-180')}
          />
        </button>
      </div>

      {showFilters ? (
        <div className="grid gap-3">
          <FilterSection
            title={showTierFilter ? 'Tier y tipo' : 'Tipo'}
            activeCount={classificationCount}
          >
            <div className="grid gap-5 lg:grid-cols-2">
              {showTierFilter ? (
                <FilterButtonGroup
                  title="Tier"
                  options={(options.tiers || []).map((tier) => ({
                    value: tier.id,
                    label: tier.nombre,
                  }))}
                  selectedValues={filters.tierIds}
                  onChange={(tierIds) =>
                    setFilters((current) => ({ ...current, tierIds }))
                  }
                />
              ) : null}

              <FilterButtonGroup
                title="Tipo"
                options={(options.tiposMagico || []).map((typeCode) => ({
                  value: typeCode,
                  label: TYPE_LABELS[typeCode] || typeCode,
                }))}
                selectedValues={filters.tipoMagicoCodigos}
                onChange={(tipoMagicoCodigos) =>
                  setFilters((current) => ({ ...current, tipoMagicoCodigos }))
                }
              />
            </div>
          </FilterSection>

          <FilterSection title="Modificadores" activeCount={modifierCount}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <FilterButtonGroup
                title="Tipo de modificador"
                options={(options.tiposModificador || []).map((typeCode) => ({
                  value: typeCode,
                  label: MODIFIER_LABELS[typeCode] || typeCode,
                }))}
                selectedValues={filters.modifierTypeCodes}
                onChange={(modifierTypeCodes) =>
                  setFilters((current) => ({ ...current, modifierTypeCodes }))
                }
              />
              <RangeField
                label="Valor del modificador"
                min={filters.modifierMin}
                max={filters.modifierMax}
                onMinChange={(modifierMin) =>
                  setFilters((current) => ({ ...current, modifierMin }))
                }
                onMaxChange={(modifierMax) =>
                  setFilters((current) => ({ ...current, modifierMax }))
                }
              />
            </div>
          </FilterSection>

          <FilterSection title="Campañas" activeCount={campaignCount}>
            <CampaignCheckboxFilter
              campaigns={options.campanas || []}
              selectedIds={filters.campaignIds}
              onChange={(campaignIds) =>
                setFilters((current) => ({ ...current, campaignIds }))
              }
            />
          </FilterSection>

          <FilterSection
            title="Coincidencia y acciones"
            activeCount={matchCount}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFilters((current) => ({ ...current, matchMode: 'all' }))
                  }
                  className={cn(
                    'rounded-xl px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]',
                    filters.matchMode === 'all'
                      ? 'bg-brand text-black'
                      : 'bg-white text-ink-soft'
                  )}
                >
                  Cumplir todo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((current) => ({ ...current, matchMode: 'any' }))
                  }
                  className={cn(
                    'rounded-xl px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]',
                    filters.matchMode === 'any'
                      ? 'bg-brand text-black'
                      : 'bg-white text-ink-soft'
                  )}
                >
                  Al menos una
                </button>
              </div>

              <button
                type="button"
                onClick={() => setFilters(emptyFilters())}
                className="inline-flex items-center gap-2 rounded-xl border border-stroke bg-white px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
              >
                <X className="h-4 w-4" />
                Limpiar filtros
              </button>
            </div>
          </FilterSection>
        </div>
      ) : null}
    </div>
  )
}

function FeedActions({ feed }) {
  if (feed.total <= 0) {
    return null
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <span className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
        {feed.shownCount} mostrados de {feed.total}
      </span>
      <button
        type="button"
        onClick={feed.loadMore}
        disabled={!feed.canLoadMore || feed.isFetchingMore}
        className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ChevronDown className="h-4 w-4" />
        Cargar 10 más
      </button>
      <button
        type="button"
        onClick={feed.loadLess}
        disabled={!feed.canLoadLess || feed.isFetchingMore}
        className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ChevronUp className="h-4 w-4" />
        Cargar 10 menos
      </button>
      <button
        type="button"
        onClick={feed.loadAll}
        disabled={!feed.canLoadMore || feed.isFetchingMore}
        className="theme-solid-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45"
      >
        Cargar todos
      </button>
      <button
        type="button"
        onClick={feed.showRecent}
        disabled={!feed.canLoadLess || feed.isFetchingMore}
        className="inline-flex items-center gap-2 rounded-md bg-surface-strong px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
      >
        <RotateCcw className="h-4 w-4" />
        Mostrar inicio
      </button>
    </div>
  )
}

function ObjectGrid({ items, expandedGrid }) {
  return (
    <div
      className={cn(
        'archive-responsive-grid grid gap-5',
        items.length > 0 &&
          (expandedGrid
            ? 'sm:grid-cols-2 lg:grid-cols-5'
            : 'sm:grid-cols-2 lg:grid-cols-4')
      )}
    >
      {items.map((item) => (
        <ObjectCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function ObjectTierListGrid({ items, tiers, expandedGrid }) {
  const [openTiers, setOpenTiers] = useState({})
  const [reverseTierOrder, setReverseTierOrder] = useState(false)
  const groupedByTier = useMemo(() => {
    const groups = new Map()

    tiers.forEach((tier) => groups.set(tier.id, []))
    items.forEach((item) => {
      if (!item.tier?.id) {
        return
      }

      if (!groups.has(item.tier.id)) {
        groups.set(item.tier.id, [])
      }

      groups.get(item.tier.id).push(item)
    })

    const grouped = tiers
      .map((tier) => [tier, groups.get(tier.id) || []])
      .filter(([, tierItems]) => tierItems.length)

    return reverseTierOrder ? grouped.reverse() : grouped
  }, [items, reverseTierOrder, tiers])

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setReverseTierOrder((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl border border-stroke bg-white px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <ChevronUp
            className={cn(
              'h-4 w-4 transition',
              reverseTierOrder && 'rotate-180'
            )}
          />
          Invertir orden de tiers
        </button>
      </div>
      {groupedByTier.map(([tier, tierItems]) => {
        const open = openTiers[tier.id] ?? true

        return (
          <section
            key={tier.id}
            className="overflow-hidden rounded-3xl border border-stroke bg-white shadow-card"
          >
            <button
              type="button"
              onClick={() =>
                setOpenTiers((current) => ({
                  ...current,
                  [tier.id]: !(current[tier.id] ?? true),
                }))
              }
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span>
                <span className="block font-display text-2xl font-bold tracking-[-0.05em] text-ink">
                  {tier.nombre}
                </span>
                <span className="text-sm text-ink-muted">
                  {tierItems.length} objetos visibles
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-ink-muted transition',
                  open ? 'rotate-180' : ''
                )}
              />
            </button>

            {open ? (
              <div className="border-t border-stroke bg-surface/60 p-4">
                <ObjectGrid items={tierItems} expandedGrid={expandedGrid} />
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

function ObjectArchiveTab({ tab, filters, setFilters, expandedGrid, options }) {
  const tabConfig = TABS.find((item) => item.id === tab) || TABS[0]
  const autoLoadedTierKeyRef = useRef('')
  const filterKey = JSON.stringify({ tab, filters })
  const initialLimit = tab === 'tierlist' ? 100 : 30
  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['objects', 'archive', tab, filters, initialLimit],
    queryFn: () => fetchObjects({ view: tab, filters, limit: initialLimit }),
    staleTime: 60 * 1000,
  })
  const feed = useIncrementalCardFeed({
    seedKey: `${filterKey}:${dataUpdatedAt}`,
    initialItems: data?.items || [],
    initialTotal: data?.meta?.totalVisible || 0,
    initialNextCursor: data?.meta?.nextCursor || null,
    pageSize: 10,
    initialShownCount: initialLimit,
    fetchPage: ({ limit, cursor }) =>
      fetchObjects({ view: tab, filters, limit, cursor }),
  })
  const items = feed.items

  useEffect(() => {
    if (tab !== 'tierlist' || isLoading || isError || !data) {
      return
    }

    const autoLoadKey = `${filterKey}:${dataUpdatedAt}:${data?.meta?.nextCursor || 'done'}`
    if (autoLoadedTierKeyRef.current === autoLoadKey) {
      return
    }

    if (feed.canLoadMore && !feed.isFetchingMore) {
      autoLoadedTierKeyRef.current = autoLoadKey
      void feed.loadAll()
    }
  }, [data, dataUpdatedAt, feed, filterKey, isError, isLoading, tab])

  return (
    <section className="grid gap-6">
      <ObjectFiltersPanel
        tab={tab}
        filters={filters}
        setFilters={setFilters}
        options={options}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {isLoading
            ? 'Cargando objetos visibles...'
            : `${feed.total} objetos visibles en ${tabConfig.label}`}
        </p>
        {feed.error ? (
          <p className="text-sm font-semibold text-danger">{feed.error}</p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="theme-sheet-card border p-8 text-sm text-ink-soft shadow-card">
          Cargando objetos...
        </div>
      ) : null}

      {isError ? (
        <div className="theme-sheet-card border border-danger/40 p-8 text-sm font-semibold text-danger shadow-card">
          No se pudieron cargar los objetos.
        </div>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <div className="theme-sheet-card border p-8 text-center shadow-card">
          <Sparkles className="mx-auto h-10 w-10 text-brand" />
          <h2 className="mt-4 font-display text-2xl font-bold text-ink">
            {tabConfig.emptyTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-soft">
            Ajusta la búsqueda o limpia los filtros para ampliar los resultados.
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && items.length ? (
        tab === 'tierlist' ? (
          <ObjectTierListGrid
            items={items}
            tiers={options.tiers || []}
            expandedGrid={expandedGrid}
          />
        ) : (
          <ObjectGrid items={items} expandedGrid={expandedGrid} />
        )
      ) : null}

      {!isLoading && !isError && tab === 'tierlist' && feed.isFetchingMore ? (
        <p className="text-sm font-semibold text-brand">
          Cargando TierList completa...
        </p>
      ) : null}

      {!isLoading && !isError && tab !== 'tierlist' ? (
        <FeedActions feed={feed} />
      ) : null}
    </section>
  )
}

export function ObjectsPage() {
  const outletContext = useOutletContext() || {}
  const hasCollapsedSidebar = Boolean(
    outletContext.isLeftCollapsed || outletContext.isRightCollapsed
  )
  const expandedGrid = Boolean(
    outletContext.isLeftCollapsed && outletContext.isRightCollapsed
  )
  const [activeTab, setActiveTab] = useState('objects')
  const [filtersByTab, setFiltersByTab] = useState(() =>
    Object.fromEntries(TABS.map((tab) => [tab.id, emptyFilters()]))
  )
  const optionsQuery = useQuery({
    queryKey: ['objects', 'archive-options'],
    queryFn: fetchObjectArchiveOptions,
    staleTime: 5 * 60 * 1000,
  })
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', 'object-filter-options'],
    queryFn: fetchCampaigns,
    staleTime: 5 * 60 * 1000,
  })
  const activeTabConfig = TABS.find((item) => item.id === activeTab) || TABS[0]
  const activeFilters = filtersByTab[activeTab] || emptyFilters()
  const setActiveFilters = (updater) => {
    setFiltersByTab((current) => ({
      ...current,
      [activeTab]:
        typeof updater === 'function'
          ? updater(current[activeTab] || emptyFilters())
          : updater,
    }))
  }
  const options = {
    ...(optionsQuery.data || {
      tiers: [],
      tiposMagico: Object.keys(TYPE_LABELS),
      tiposModificador: Object.keys(MODIFIER_LABELS),
    }),
    campanas: campaignsQuery.data || [],
  }

  return (
    <div
      className={cn(
        'mx-auto w-full',
        hasCollapsedSidebar ? 'max-w-none' : 'max-w-7xl'
      )}
    >
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'group rounded-2xl border px-5 py-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-glow',
              activeTab === tab.id
                ? 'border-brand bg-brand text-black'
                : 'border-stroke bg-white text-ink hover:border-brand/60'
            )}
          >
            <span className="block font-display text-2xl font-bold tracking-[-0.04em]">
              {tab.label}
            </span>
            <span
              className={cn(
                'mt-1 block font-label text-[10px] font-black uppercase tracking-[0.18em]',
                activeTab === tab.id
                  ? 'text-black/65'
                  : 'text-ink-muted group-hover:text-brand'
              )}
            >
              {tab.eyebrow}
            </span>
          </button>
        ))}
      </div>

      <section className="theme-sheet-shell overflow-hidden shadow-card">
        <div className="theme-sheet-frame border px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-label text-[10px] font-black uppercase tracking-[0.24em] text-brand">
                {activeTabConfig.eyebrow}
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
                {activeTabConfig.title}
              </h1>
              <p className="theme-sheet-copy mt-4 max-w-3xl text-base leading-8">
                {activeTabConfig.description}
              </p>
            </div>
            <Link
              to="/app/objetos/nuevo"
              className="theme-solid-button inline-flex items-center justify-center gap-2 px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.18em]"
            >
              <Plus className="h-4 w-4" />
              Crear objeto
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <ObjectArchiveTab
          tab={activeTab}
          filters={activeFilters}
          setFilters={setActiveFilters}
          expandedGrid={expandedGrid}
          options={options}
        />
      </div>
    </div>
  )
}
