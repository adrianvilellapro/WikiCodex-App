import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom'

import { CampaignCheckboxFilter } from '../components/ui/CampaignCheckboxFilter'
import { PlacePreviewImage } from '../components/ui/PlacePreviewImage'
import { useIncrementalCardFeed } from '../hooks/useIncrementalCardFeed'
import { cn } from '../lib/cn'
import { fetchCampaigns } from './campaign-detail/api'
import { fetchPowerOptions, fetchPowers } from './powers/api'

const SORT_OPTIONS = [
  ['created_desc', 'Subida reciente'],
  ['created_asc', 'Subida antigua'],
  ['updated_desc', 'Actualización reciente'],
  ['updated_asc', 'Actualización antigua'],
  ['name_asc', 'Nombre A-Z'],
  ['name_desc', 'Nombre Z-A'],
]

function emptyFilters() {
  return {
    q: '',
    categoryIds: [],
    campaignIds: null,
    matchMode: 'all',
    sort: 'created_desc',
  }
}

function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function OtherPowerCard({ item }) {
  const location = useLocation()

  return (
    <Link
      to={`/app/poderes/otros/${item.id}`}
      state={{
        returnTo: { pathname: location.pathname, scrollY: window.scrollY },
      }}
      className="theme-sheet-card archive-responsive-card group overflow-hidden border shadow-card transition hover:-translate-y-1 hover:border-brand/50"
    >
      <div className="archive-responsive-image relative h-64 overflow-hidden bg-ink">
        <PlacePreviewImage
          src={item.imagenUrl}
          alt={item.nombre}
          className="h-full w-full"
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 33vw, 50vw"
          fallbackIcon={Sparkles}
        />
      </div>
      <div className="archive-responsive-body p-5">
        <div>
          <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            Otro poder
          </p>
          <h3 className="mt-1 truncate font-display text-2xl font-bold tracking-[-0.05em] text-ink">
            {item.nombre}
          </h3>
        </div>
        <p className="line-clamp-3 text-sm leading-6 text-ink-soft">
          {item.descripcion || 'Sin descripción registrada.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {(item.categorias || []).slice(0, 4).map((category) => (
            <span key={category.id || category.nombre} className="archive-chip">
              {category.nombre}
            </span>
          ))}
          {item.modoVista === 'preview' ? (
            <span className="archive-chip">Vista previa</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function CategorySelectorPanel({ options, selectedIds, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedSet = new Set(selectedIds)
  const selectedOptions = selectedIds
    .map((id) => options.find((option) => option.id === id))
    .filter(Boolean)
  const visibleOptions = options.filter((option) =>
    normalizeLooseText(option.nombre).includes(normalizeLooseText(query))
  )

  function toggleCategory(categoryId) {
    onChange(
      selectedSet.has(categoryId)
        ? selectedIds.filter((id) => id !== categoryId)
        : [...selectedIds, categoryId]
    )
  }

  return (
    <div className="relative grid gap-3">
      <div className="min-h-16 rounded-2xl border border-stroke bg-white p-3">
        {selectedOptions.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleCategory(option.id)}
                className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 font-label text-[9px] font-black uppercase tracking-[0.14em] text-brand transition hover:bg-brand hover:text-black"
              >
                {option.nombre}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        ) : (
          <p className="px-1 py-2 text-sm text-ink-soft">
            No hay categorías seleccionadas.
          </p>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="archive-input flex min-h-11 items-center justify-between rounded-xl text-left"
        >
          <span>Añadir categoría</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-ink-muted transition',
              open && 'rotate-180'
            )}
          />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-full z-[80] mt-2 overflow-hidden rounded-2xl border border-stroke bg-white shadow-card">
            <div className="p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="archive-input h-10 rounded-xl pl-11"
                  style={{ paddingLeft: '3rem' }}
                  placeholder="Buscar categoría"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto px-2 pb-2">
              {visibleOptions.length ? (
                visibleOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleCategory(option.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition',
                      selectedSet.has(option.id)
                        ? 'bg-brand/10 text-brand'
                        : 'text-ink-soft hover:bg-surface-strong hover:text-ink'
                    )}
                  >
                    <span>{option.nombre}</span>
                    {selectedSet.has(option.id) ? (
                      <span className="h-2 w-2 rounded-full bg-brand" />
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-sm text-ink-soft">
                  No hay categorías que coincidan.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
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

function PowerFiltersPanel({ filters, setFilters, options }) {
  const [showFilters, setShowFilters] = useState(false)
  const categoryCount = filters.categoryIds.length
  const campaignCount = Array.isArray(filters.campaignIds)
    ? filters.campaignIds.length
    : 0
  const matchCount = filters.matchMode === 'any' ? 1 : 0
  const activeFilterCount = categoryCount + matchCount

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
            placeholder="Buscar poderes"
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
          <FilterSection title="Categorias" activeCount={categoryCount}>
            <CategorySelectorPanel
              options={options.categorias || []}
              selectedIds={filters.categoryIds}
              onChange={(categoryIds) =>
                setFilters((current) => ({ ...current, categoryIds }))
              }
            />
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

function PowersGrid({ items, expandedGrid }) {
  return (
    <div
      className={cn(
        'archive-responsive-grid grid grid-cols-1 gap-4 sm:grid-cols-2',
        items.length > 0 && (expandedGrid ? 'lg:grid-cols-5' : 'lg:grid-cols-4')
      )}
    >
      {items.map((item) => (
        <OtherPowerCard key={item.id} item={item} />
      ))}
    </div>
  )
}

export function OtherPowersPage() {
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const expandedGrid = Boolean(
    outletContext.isLeftCollapsed && outletContext.isRightCollapsed
  )
  const [filters, setFilters] = useState(() => emptyFilters())
  const optionsQuery = useQuery({
    queryKey: ['power-options'],
    queryFn: fetchPowerOptions,
    staleTime: 5 * 60 * 1000,
  })
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', 'power-filter-options'],
    queryFn: fetchCampaigns,
    staleTime: 5 * 60 * 1000,
  })
  const filterKey = JSON.stringify(filters)
  const powersQuery = useQuery({
    queryKey: ['powers', 'archive', filters],
    queryFn: () => fetchPowers({ filters, limit: 30 }),
    staleTime: 60 * 1000,
  })
  const feed = useIncrementalCardFeed({
    seedKey: `${filterKey}:${powersQuery.dataUpdatedAt}`,
    initialItems: powersQuery.data?.items || [],
    initialTotal: powersQuery.data?.meta?.totalVisible || 0,
    initialNextCursor: powersQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    initialShownCount: 30,
    fetchPage: ({ limit, cursor }) => fetchPowers({ filters, limit, cursor }),
  })
  const powers = feed.items
  const options = {
    ...(optionsQuery.data || { categorias: [] }),
    campanas: campaignsQuery.data || [],
  }
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <button
          type="button"
          onClick={() => navigate('/app/poderes')}
          className="theme-back-button mb-3 inline-flex items-center gap-2 rounded-xl border border-stroke bg-surface px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand/50 hover:text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a poderes
        </button>
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
          Poderes / Otros poderes
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-[-0.06em] text-ink">
              Otros poderes
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
              Bendiciones, maldiciones, mutaciones y poderes narrativos con
              categorías propias, campañas y privacidad granular.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/poderes/otros/nuevo')}
            className="theme-solid-button inline-flex items-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
          >
            <Plus className="h-4 w-4" />
            Crear otro poder
          </button>
        </div>
      </div>

      <PowerFiltersPanel
        filters={filters}
        setFilters={setFilters}
        options={options}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {powersQuery.isLoading
            ? 'Cargando poderes visibles...'
            : `${feed.total} poderes visibles`}
        </p>
        {feed.error ? (
          <p className="text-sm font-semibold text-danger">{feed.error}</p>
        ) : null}
      </div>

      {powersQuery.isLoading ? (
        <div className="theme-sheet-card border p-8 text-sm text-ink-soft shadow-card">
          Cargando poderes...
        </div>
      ) : null}

      {powersQuery.isError ? (
        <div className="theme-sheet-card border border-danger/40 p-8 text-sm font-semibold text-danger shadow-card">
          No se pudieron cargar los poderes.
        </div>
      ) : null}

      {!powersQuery.isLoading && !powersQuery.isError && powers.length === 0 ? (
        <div className="theme-sheet-card border p-8 text-center shadow-card">
          <Sparkles className="mx-auto h-10 w-10 text-brand" />
          <h2 className="mt-4 font-display text-2xl font-bold text-ink">
            Todavía no hay poderes visibles
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-soft">
            Ajusta la búsqueda o limpia los filtros para ampliar los resultados.
          </p>
        </div>
      ) : null}

      {!powersQuery.isLoading && !powersQuery.isError && powers.length ? (
        <PowersGrid items={powers} expandedGrid={expandedGrid} />
      ) : null}

      {!powersQuery.isLoading && !powersQuery.isError ? (
        <FeedActions feed={feed} />
      ) : null}
    </section>
  )
}
