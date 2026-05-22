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
  UserRound,
  X,
} from 'lucide-react'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { CampaignCheckboxFilter } from '../components/ui/CampaignCheckboxFilter'
import { useIncrementalCardFeed } from '../hooks/useIncrementalCardFeed'
import { cn } from '../lib/cn'
import { api } from '../services/http'
import { fetchCampaigns } from './campaign-detail/api'

const TABS = [
  {
    id: 'characters',
    label: 'Personajes',
    title: 'Biblioteca de personajes',
    eyebrow: 'Archivo global',
    description:
      'Consulta personajes visibles, versiones y fichas accesibles según privacidad, permisos y rol dentro de cada campaña.',
    emptyTitle: 'Todavía no hay personajes visibles',
  },
  {
    id: 'bestiary',
    label: 'Bestiario',
    title: 'Bestiario',
    eyebrow: 'Archivo de criaturas',
    description:
      'Consulta criaturas visibles, bestias, monstruos y entidades marcadas como criatura dentro de las campañas disponibles.',
    emptyTitle: 'Todavía no hay criaturas visibles',
  },
  {
    id: 'tierlist',
    label: 'TierList',
    title: 'TierList de personajes',
    eyebrow: 'Escala de poder',
    description:
      'Agrupa todos los personajes visibles con tier asignada, de Omnipotente a Desconocido.',
    emptyTitle: 'Todavía no hay personajes con tier visible',
  },
]

const SORT_OPTIONS = [
  ['created_desc', 'Subida reciente'],
  ['created_asc', 'Subida antigua'],
  ['name_asc', 'Nombre A-Z'],
  ['name_desc', 'Nombre Z-A'],
  ['age_asc', 'Edad ascendente'],
  ['age_desc', 'Edad descendente'],
  ['height_asc', 'Altura ascendente'],
  ['height_desc', 'Altura descendente'],
  ['weight_asc', 'Peso ascendente'],
  ['weight_desc', 'Peso descendente'],
]

function emptyFilters() {
  return {
    q: '',
    categoryIds: [],
    tierIds: [],
    campaignIds: null,
    estadoCodigos: [],
    ageMin: '',
    ageMax: '',
    heightMin: '',
    heightMax: '',
    weightMin: '',
    weightMax: '',
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

function toOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }

  const normalizedValue = String(value).trim().replace(',', '.')
  const parsed = Number(normalizedValue)
  return Number.isFinite(parsed) ? parsed : undefined
}

function buildCharacterParams({ view, filters, limit, cursor }) {
  return {
    view,
    limit,
    cursor: cursor || undefined,
    q: filters.q.trim() || undefined,
    matchMode: filters.matchMode,
    sort: filters.sort,
    categoryIds: filters.categoryIds.length
      ? filters.categoryIds.join(',')
      : undefined,
    tierIds:
      view !== 'tierlist' && filters.tierIds.length
        ? filters.tierIds.join(',')
        : undefined,
    campaignIds: Array.isArray(filters.campaignIds)
      ? filters.campaignIds.length
        ? filters.campaignIds.join(',')
        : '__none'
      : undefined,
    estadoCodigos: filters.estadoCodigos.length
      ? filters.estadoCodigos.join(',')
      : undefined,
    ageMin: toOptionalNumber(filters.ageMin),
    ageMax: toOptionalNumber(filters.ageMax),
    heightMin: toOptionalNumber(filters.heightMin),
    heightMax: toOptionalNumber(filters.heightMax),
    weightMin: toOptionalNumber(filters.weightMin),
    weightMax: toOptionalNumber(filters.weightMax),
  }
}

async function fetchCharacters({ view, filters, limit = 30, cursor = null }) {
  const { data } = await api.get('/characters', {
    params: buildCharacterParams({ view, filters, limit, cursor }),
  })

  return data
}

async function fetchCharacterArchiveOptions() {
  const { data } = await api.get('/characters/archive/options')
  return data
}

function CharacterCard({ item }) {
  const location = useLocation()
  const isPreviewOnly = item.modoVista === 'preview'

  return (
    <Link
      to={`/app/personajes/${item.id}`}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="archive-card-virtual archive-responsive-card group block rounded-lg bg-white p-2 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="archive-responsive-image relative h-96 overflow-hidden rounded-md bg-surface-strong">
        {item.imagenPrincipalUrl ? (
          <CloudinaryImage
            src={item.imagenPrincipalUrl}
            alt={item.nombre}
            variant="card"
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 33vw, 50vw"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
            <UserRound className="h-12 w-12" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="archive-responsive-body px-2 pb-2 pt-4">
        <h3 className="truncate font-display text-xl font-bold tracking-[-0.05em] text-ink">
          {item.nombre}
        </h3>
        <p className="mt-1 truncate text-sm text-ink-soft">
          {isPreviewOnly ? 'Vista previa' : item.titulo || 'Sin título'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={cn(
              'archive-chip',
              isPreviewOnly
                ? 'border-slate-300 bg-slate-100 text-slate-600'
                : 'border-brand/40 bg-brand/10 text-brand'
            )}
          >
            {isPreviewOnly ? 'Solo vista previa' : 'Acceso completo'}
          </span>
          {item.esCriatura ? (
            <span className="archive-chip">Criatura</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function CategorySelector({ options, selectedIds, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selectedSet = new Set(selectedIds)
  const normalizedQuery = normalizeLooseText(query)
  const visibleOptions = options.filter((option) =>
    normalizeLooseText(option.nombre).includes(normalizedQuery)
  )

  function toggleCategory(categoryId) {
    onChange(
      selectedSet.has(categoryId)
        ? selectedIds.filter((id) => id !== categoryId)
        : [...selectedIds, categoryId]
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="archive-input flex min-h-11 items-center justify-between rounded-xl text-left"
      >
        <span className="truncate">
          {selectedIds.length
            ? `${selectedIds.length} categorías seleccionadas`
            : 'Todas las categorías'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-ink-muted transition',
            open && 'rotate-180'
          )}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-stroke bg-white shadow-card">
          <div className="p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="archive-input h-10 rounded-xl pl-9"
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

function RangeField({ label, min, max, onMinChange, onMaxChange, suffix }) {
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
          placeholder={`Mín. ${suffix || ''}`.trim()}
        />
        <input
          value={max}
          onChange={(event) => onMaxChange(event.target.value)}
          className="archive-input h-11 rounded-xl"
          inputMode="decimal"
          placeholder={`Máx. ${suffix || ''}`.trim()}
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

function CharacterFiltersPanel({ tab, filters, setFilters, options }) {
  const [showFilters, setShowFilters] = useState(false)
  const showTierFilter = tab !== 'tierlist'
  const rangeCount = [
    filters.ageMin,
    filters.ageMax,
    filters.heightMin,
    filters.heightMax,
    filters.weightMin,
    filters.weightMax,
  ].filter((value) => String(value).trim()).length
  const classificationCount =
    filters.estadoCodigos.length + (showTierFilter ? filters.tierIds.length : 0)
  const campaignCount = Array.isArray(filters.campaignIds)
    ? filters.campaignIds.length
    : 0
  const matchCount = filters.matchMode === 'any' ? 1 : 0
  const activeFilterCount =
    filters.categoryIds.length + classificationCount + rangeCount + matchCount

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
              tab === 'bestiary'
                ? 'Buscar en bestiario'
                : tab === 'tierlist'
                  ? 'Buscar en TierList'
                  : 'Buscar en personajes'
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
            title="Categorias"
            activeCount={filters.categoryIds.length}
          >
            <CategorySelectorPanel
              options={options.categorias || []}
              selectedIds={filters.categoryIds}
              onChange={(categoryIds) =>
                setFilters((current) => ({ ...current, categoryIds }))
              }
            />
          </FilterSection>

          <FilterSection
            title={showTierFilter ? 'Tier y estado' : 'Estado'}
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
                title="Estado"
                options={(options.estados || []).map((state) => ({
                  value: state.codigo,
                  label: state.nombre,
                }))}
                selectedValues={filters.estadoCodigos}
                onChange={(estadoCodigos) =>
                  setFilters((current) => ({ ...current, estadoCodigos }))
                }
              />
            </div>
          </FilterSection>

          <FilterSection title="Rangos" activeCount={rangeCount}>
            <div className="grid gap-4 md:grid-cols-3">
              <RangeField
                label="Rango de edad"
                min={filters.ageMin}
                max={filters.ageMax}
                onMinChange={(ageMin) =>
                  setFilters((current) => ({ ...current, ageMin }))
                }
                onMaxChange={(ageMax) =>
                  setFilters((current) => ({ ...current, ageMax }))
                }
              />
              <RangeField
                label="Rango de altura"
                min={filters.heightMin}
                max={filters.heightMax}
                onMinChange={(heightMin) =>
                  setFilters((current) => ({ ...current, heightMin }))
                }
                onMaxChange={(heightMax) =>
                  setFilters((current) => ({ ...current, heightMax }))
                }
                suffix="m"
              />
              <RangeField
                label="Rango de peso"
                min={filters.weightMin}
                max={filters.weightMax}
                onMinChange={(weightMin) =>
                  setFilters((current) => ({ ...current, weightMin }))
                }
                onMaxChange={(weightMax) =>
                  setFilters((current) => ({ ...current, weightMax }))
                }
                suffix="kg"
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

function CharacterFilters({ tab, filters, setFilters, options }) {
  const [showFilters, setShowFilters] = useState(true)
  const showTierFilter = tab !== 'tierlist'
  const activeFilterCount =
    filters.categoryIds.length +
    filters.tierIds.length +
    filters.estadoCodigos.length +
    [
      filters.ageMin,
      filters.ageMax,
      filters.heightMin,
      filters.heightMax,
      filters.weightMin,
      filters.weightMax,
    ].filter((value) => String(value).trim()).length

  return (
    <div className="grid gap-4 rounded-3xl border border-stroke bg-surface p-4 shadow-card">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={filters.q}
            onChange={(event) =>
              setFilters((current) => ({ ...current, q: event.target.value }))
            }
            className="archive-input h-11 w-full rounded-xl pl-10"
            placeholder={`Buscar en ${tab === 'bestiary' ? 'bestiario' : tab === 'tierlist' ? 'TierList' : 'personajes'}`}
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
        </button>
      </div>

      {showFilters ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-2 font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                Categoría
              </p>
              <CategorySelector
                options={options.categorias || []}
                selectedIds={filters.categoryIds}
                onChange={(categoryIds) =>
                  setFilters((current) => ({ ...current, categoryIds }))
                }
              />
            </div>

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
              title="Estado"
              options={(options.estados || []).map((state) => ({
                value: state.codigo,
                label: state.nombre,
              }))}
              selectedValues={filters.estadoCodigos}
              onChange={(estadoCodigos) =>
                setFilters((current) => ({ ...current, estadoCodigos }))
              }
            />

            <RangeField
              label="Rango de edad"
              min={filters.ageMin}
              max={filters.ageMax}
              onMinChange={(ageMin) =>
                setFilters((current) => ({ ...current, ageMin }))
              }
              onMaxChange={(ageMax) =>
                setFilters((current) => ({ ...current, ageMax }))
              }
            />
            <RangeField
              label="Rango de altura"
              min={filters.heightMin}
              max={filters.heightMax}
              onMinChange={(heightMin) =>
                setFilters((current) => ({ ...current, heightMin }))
              }
              onMaxChange={(heightMax) =>
                setFilters((current) => ({ ...current, heightMax }))
              }
              suffix="m"
            />
            <RangeField
              label="Rango de peso"
              min={filters.weightMin}
              max={filters.weightMax}
              onMinChange={(weightMin) =>
                setFilters((current) => ({ ...current, weightMin }))
              }
              onMaxChange={(weightMax) =>
                setFilters((current) => ({ ...current, weightMax }))
              }
              suffix="kg"
            />
          </div>

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
        </>
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

function CharacterGrid({ items, expandedGrid }) {
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
        <CharacterCard key={item.id} item={item} />
      ))}
    </div>
  )
}

function TierListGrid({ items, tiers, expandedGrid }) {
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
                  {tierItems.length} personajes visibles
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
                <CharacterGrid items={tierItems} expandedGrid={expandedGrid} />
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

function CharacterArchiveTab({
  tab,
  filters,
  setFilters,
  expandedGrid,
  options,
}) {
  const tabConfig = TABS.find((item) => item.id === tab) || TABS[0]
  const autoLoadedTierKeyRef = useRef('')
  const filterKey = JSON.stringify({ tab, filters })
  const initialLimit = tab === 'tierlist' ? 100 : 30
  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['characters', 'archive', tab, filters, initialLimit],
    queryFn: () => fetchCharacters({ view: tab, filters, limit: initialLimit }),
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
      fetchCharacters({ view: tab, filters, limit, cursor }),
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
      <CharacterFiltersPanel
        tab={tab}
        filters={filters}
        setFilters={setFilters}
        options={options}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {isLoading
            ? 'Cargando personajes visibles...'
            : `${feed.total} personajes visibles en ${tabConfig.label}`}
        </p>
        {feed.error ? (
          <p className="text-sm font-semibold text-danger">{feed.error}</p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="theme-sheet-card border p-8 text-sm text-ink-soft shadow-card">
          Cargando personajes...
        </div>
      ) : null}

      {isError ? (
        <div className="theme-sheet-card border border-danger/40 p-8 text-sm font-semibold text-danger shadow-card">
          No se pudieron cargar los personajes.
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
          <TierListGrid
            items={items}
            tiers={options.tiers || []}
            expandedGrid={expandedGrid}
          />
        ) : (
          <CharacterGrid items={items} expandedGrid={expandedGrid} />
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

export function CharactersPage() {
  const outletContext = useOutletContext() || {}
  const hasCollapsedSidebar = Boolean(
    outletContext.isLeftCollapsed || outletContext.isRightCollapsed
  )
  const expandedGrid = Boolean(
    outletContext.isLeftCollapsed && outletContext.isRightCollapsed
  )
  const [activeTab, setActiveTab] = useState('characters')
  const [filtersByTab, setFiltersByTab] = useState(() =>
    Object.fromEntries(TABS.map((tab) => [tab.id, emptyFilters()]))
  )
  const optionsQuery = useQuery({
    queryKey: ['characters', 'archive-options'],
    queryFn: fetchCharacterArchiveOptions,
    staleTime: 5 * 60 * 1000,
  })
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', 'character-filter-options'],
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
      categorias: [],
      tiers: [],
      estados: [],
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
      <div className="mb-6 grid gap-3 md:grid-cols-3">
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
              to="/app/personajes/nuevo"
              className="theme-solid-button inline-flex items-center justify-center gap-2 px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.18em]"
            >
              <Plus className="h-4 w-4" />
              Crear personaje
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <CharacterArchiveTab
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
