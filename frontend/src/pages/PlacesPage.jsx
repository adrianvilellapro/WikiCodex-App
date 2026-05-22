import { useState } from 'react'
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

import { PlacePreviewImage } from '../components/ui/PlacePreviewImage'
import { CampaignCheckboxFilter } from '../components/ui/CampaignCheckboxFilter'
import { useIncrementalCardFeed } from '../hooks/useIncrementalCardFeed'
import { cn } from '../lib/cn'
import { fetchCampaigns } from './campaign-detail/api'
import { fetchPlaceArchiveOptions, fetchPlaces } from './place-detail/api'

const SORT_OPTIONS = [
  ['created_desc', 'Subida reciente'],
  ['created_asc', 'Subida antigua'],
  ['name_asc', 'Nombre A-Z'],
  ['name_desc', 'Nombre Z-A'],
  ['type_asc', 'Tipo superior primero'],
  ['type_desc', 'Tipo inferior primero'],
]

function emptyFilters() {
  return {
    q: '',
    tipoLugarIds: [],
    campaignIds: null,
    matchMode: 'all',
    sort: 'created_desc',
  }
}

function PlaceCard({ item }) {
  const location = useLocation()
  const isPreviewOnly = item.modoVista === 'preview'

  return (
    <Link
      to={`/app/lugares/${item.id}`}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="theme-sheet-card archive-responsive-card group overflow-hidden border shadow-card transition hover:-translate-y-1 hover:border-brand/50"
    >
      <div className="archive-responsive-image relative h-64 overflow-hidden bg-ink">
        <PlacePreviewImage
          src={item.imagenPrincipalUrl}
          alt={item.nombre}
          className="h-full w-full"
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 33vw, 50vw"
        />
      </div>
      <div className="archive-responsive-body p-5">
        <p className="font-label text-[9px] font-black uppercase tracking-[0.22em] text-brand">
          {item.tipo?.nombre || 'Lugar'}
        </p>
        <h2 className="mt-1 line-clamp-1 font-display text-2xl font-bold tracking-[-0.04em] text-ink">
          {item.nombre}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={cn(
              'rounded-full px-3 py-1 font-label text-[9px] font-black uppercase tracking-[0.18em]',
              isPreviewOnly
                ? 'bg-surface-strong text-ink-soft'
                : 'bg-brand/10 text-brand'
            )}
          >
            {isPreviewOnly ? 'Vista previa' : 'Acceso completo'}
          </span>
        </div>
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-ink-soft">
          {item.descripcion || 'Lugar sin descripción visible.'}
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

function PlacesFiltersPanel({ filters, setFilters, options }) {
  const [showFilters, setShowFilters] = useState(false)
  const typeCount = filters.tipoLugarIds.length
  const campaignCount = Array.isArray(filters.campaignIds)
    ? filters.campaignIds.length
    : 0
  const matchCount = filters.matchMode === 'any' ? 1 : 0
  const activeFilterCount = typeCount + matchCount

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
            placeholder="Buscar lugares"
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
          <FilterSection title="Tipo de lugar" activeCount={typeCount}>
            <FilterButtonGroup
              title="Tipos"
              options={(options.tiposLugar || []).map((type) => ({
                value: type.id,
                label: type.nombre,
              }))}
              selectedValues={filters.tipoLugarIds}
              onChange={(tipoLugarIds) =>
                setFilters((current) => ({ ...current, tipoLugarIds }))
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

function PlacesGrid({ items, expandedGrid }) {
  return (
    <div
      className={cn(
        'archive-responsive-grid grid gap-5',
        items.length > 0 &&
          (expandedGrid
            ? 'sm:grid-cols-2 lg:grid-cols-6'
            : 'sm:grid-cols-2 lg:grid-cols-5')
      )}
    >
      {items.map((item) => (
        <PlaceCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function PlacesArchive({ filters, setFilters, expandedGrid, options }) {
  const filterKey = JSON.stringify(filters)
  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['places', 'archive', filters],
    queryFn: () => fetchPlaces({ filters, limit: 30 }),
    staleTime: 60 * 1000,
  })
  const feed = useIncrementalCardFeed({
    seedKey: `${filterKey}:${dataUpdatedAt}`,
    initialItems: data?.items || [],
    initialTotal: data?.meta?.totalVisible || 0,
    initialNextCursor: data?.meta?.nextCursor || null,
    pageSize: 10,
    initialShownCount: 30,
    fetchPage: ({ limit, cursor }) => fetchPlaces({ filters, limit, cursor }),
  })
  const places = feed.items

  return (
    <section className="grid gap-6">
      <PlacesFiltersPanel
        filters={filters}
        setFilters={setFilters}
        options={options}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {isLoading
            ? 'Cargando lugares visibles...'
            : `${feed.total} lugares visibles`}
        </p>
        {feed.error ? (
          <p className="text-sm font-semibold text-danger">{feed.error}</p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="theme-sheet-card border p-8 text-sm text-ink-soft shadow-card">
          Cargando lugares...
        </div>
      ) : null}

      {isError ? (
        <div className="theme-sheet-card border border-danger/40 p-8 text-sm font-semibold text-danger shadow-card">
          No se pudieron cargar los lugares.
        </div>
      ) : null}

      {!isLoading && !isError && places.length === 0 ? (
        <div className="theme-sheet-card border p-8 text-center shadow-card">
          <Sparkles className="mx-auto h-10 w-10 text-brand" />
          <h2 className="mt-4 font-display text-2xl font-bold text-ink">
            Todavía no hay lugares visibles
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-soft">
            Ajusta la búsqueda o limpia los filtros para ampliar los resultados.
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && places.length ? (
        <PlacesGrid items={places} expandedGrid={expandedGrid} />
      ) : null}

      {!isLoading && !isError ? <FeedActions feed={feed} /> : null}
    </section>
  )
}

export function PlacesPage() {
  const outletContext = useOutletContext() || {}
  const hasCollapsedSidebar = Boolean(
    outletContext.isLeftCollapsed || outletContext.isRightCollapsed
  )
  const expandedGrid = Boolean(
    outletContext.isLeftCollapsed && outletContext.isRightCollapsed
  )
  const [filters, setFilters] = useState(() => emptyFilters())
  const optionsQuery = useQuery({
    queryKey: ['places', 'archive-options'],
    queryFn: fetchPlaceArchiveOptions,
    staleTime: 5 * 60 * 1000,
  })
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', 'place-filter-options'],
    queryFn: fetchCampaigns,
    staleTime: 5 * 60 * 1000,
  })
  const options = {
    ...(optionsQuery.data || { tiposLugar: [] }),
    campanas: campaignsQuery.data || [],
  }

  return (
    <div
      className={cn(
        'mx-auto w-full',
        hasCollapsedSidebar ? 'max-w-none' : 'max-w-7xl'
      )}
    >
      <section className="theme-sheet-shell overflow-hidden shadow-card">
        <div className="theme-sheet-frame border px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-label text-[10px] font-black uppercase tracking-[0.24em] text-brand">
                Atlas global
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
                Biblioteca de lugares
              </h1>
              <p className="theme-sheet-copy mt-4 max-w-3xl text-base leading-8">
                Explora mundos, ciudades y emplazamientos visibles. Cada lugar
                puede tener versiones, galería, privacidad y una jerarquía para
                contener lugares más pequeños.
              </p>
            </div>
            <Link
              to="/app/lugares/nuevo"
              className="theme-solid-button inline-flex items-center justify-center gap-2 px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.18em]"
            >
              <Plus className="h-4 w-4" />
              Crear lugar
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <PlacesArchive
          filters={filters}
          setFilters={setFilters}
          expandedGrid={expandedGrid}
          options={options}
        />
      </div>
    </div>
  )
}
