import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Filter,
  Plus,
  RotateCcw,
  Search,
  ScrollText,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { WikiText } from '../components/wiki/WikiText'
import { cn } from '../lib/cn'
import { fetchFeatOptions, fetchFeats } from './feats/api'

const SORT_OPTIONS = [
  ['name_asc', 'Nombre A-Z'],
  ['name_desc', 'Nombre Z-A'],
  ['created_desc', 'Subida reciente'],
  ['updated_desc', 'Actualización reciente'],
]

function emptyFilters() {
  return {
    q: '',
    idioma: 'es',
    fuentes: [],
    ediciones: ['classic', 'one', 'wikicodex'],
    sort: 'name_asc',
  }
}

function FeatRow({ item, index }) {
  const location = useLocation()
  const returnTo = {
    pathname: location.pathname,
    search: location.search,
    scrollY: window.scrollY,
  }

  return (
    <Link
      to={`/app/clases/dotes/${item.id}`}
      state={{ returnTo }}
      className={cn(
        'group grid gap-3 border border-stroke px-5 py-4 shadow-sm transition hover:border-brand sm:grid-cols-[minmax(0,1fr)_12rem]',
        index % 2 ? 'bg-brand/10 hover:bg-brand/15' : 'bg-white'
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="archive-chip">
            {item.idiomaCodigo === 'es' ? 'ES' : 'EN'}
          </span>
          {item.fuente ? (
            <span className="archive-chip">{item.fuente}</span>
          ) : null}
          {item.categoria ? (
            <span className="archive-chip">{item.categoria}</span>
          ) : null}
        </div>
        <h2 className="mt-2 break-words font-display text-2xl font-black tracking-[-0.04em] text-ink [overflow-wrap:anywhere] group-hover:text-brand">
          {item.nombre}
        </h2>
        <div className="theme-sheet-copy mt-2 line-clamp-2 text-sm leading-6 text-ink-soft">
          <WikiText
            text={item.resumen || item.descripcion || 'Dote sin resumen.'}
          />
        </div>
      </div>
      <div className="flex items-center justify-start gap-3 text-sm font-semibold text-ink-soft sm:justify-end">
        <ScrollText className="h-4 w-4 text-brand" />
        <span>{item.beneficios?.length || 0} bloques</span>
      </div>
    </Link>
  )
}

export function FeatsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(() => emptyFilters())
  const featsQuery = useQuery({
    queryKey: ['feats', filters],
    queryFn: () => fetchFeats({ filters, limit: 500 }),
    staleTime: 45 * 1000,
  })
  const optionsQuery = useQuery({
    queryKey: ['feat-options'],
    queryFn: fetchFeatOptions,
    staleTime: 60 * 1000,
  })
  const items = useMemo(
    () => featsQuery.data?.items || [],
    [featsQuery.data?.items]
  )
  const sourceOptions = optionsQuery.data?.fuentes || []
  const editionOptions = optionsQuery.data?.ediciones || []

  function updateFilter(patch) {
    setFilters((current) => ({ ...current, ...patch }))
  }

  function toggleFilterValue(key, value) {
    setFilters((current) => {
      const values = new Set(current[key] || [])

      if (values.has(value)) {
        values.delete(value)
      } else {
        values.add(value)
      }

      return { ...current, [key]: Array.from(values) }
    })
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex max-w-3xl gap-4">
            <button
              type="button"
              onClick={() => navigate('/app/clases')}
              className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stroke bg-surface-strong text-ink-soft transition hover:border-brand hover:text-brand"
              aria-label="Volver a Clases y Dotes"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="font-label text-[10px] font-black uppercase tracking-[0.24em] text-brand">
                Opciones de avance
              </p>
              <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
                Dotes
              </h1>
              <p className="mt-3 text-sm leading-7 text-ink-soft">
                Biblioteca de dotes públicas con buscador flexible y ficha de
                detalle.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/clases/dotes/nuevo')}
            className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
          >
            <Plus className="h-4 w-4" />
            Crear Dote
          </button>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={filters.q}
              onChange={(event) => updateFilter({ q: event.target.value })}
              className="archive-input h-12 rounded-xl pl-11"
              style={{ paddingLeft: '3rem' }}
              placeholder="Buscar dotes"
            />
          </div>
          <div className="inline-flex rounded-xl border border-stroke bg-surface-strong p-1">
            {[
              ['es', 'Español'],
              ['en', 'Inglés'],
            ].map(([language, label]) => (
              <button
                key={language}
                type="button"
                onClick={() => updateFilter({ idioma: language })}
                className={cn(
                  'rounded-lg px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.14em] transition',
                  filters.idioma === language
                    ? 'bg-brand text-black'
                    : 'text-ink-soft hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-stroke bg-surface-strong/70 p-4 shadow-card lg:grid-cols-[minmax(0,1fr)_18rem_12rem_auto]">
        <label className="block">
          <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
            Orden
          </span>
          <select
            value={filters.sort}
            onChange={(event) => updateFilter({ sort: event.target.value })}
            className="archive-input mt-2 h-11 rounded-xl"
          >
            {SORT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-2">
          <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
            Fuentes
          </span>
          <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-xl border border-stroke bg-white p-2">
            {sourceOptions.map((source) => (
              <label
                key={source.codigo}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stroke bg-surface-strong px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft"
              >
                <input
                  type="checkbox"
                  checked={(filters.fuentes || []).includes(source.codigo)}
                  onChange={() => toggleFilterValue('fuentes', source.codigo)}
                  className="h-3.5 w-3.5 accent-brand"
                />
                {source.nombre}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
            Ediciones
          </span>
          <div className="grid gap-2 rounded-xl border border-stroke bg-white p-2">
            {editionOptions.map((edition) => (
              <label
                key={edition.codigo}
                className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-soft"
              >
                <input
                  type="checkbox"
                  checked={(filters.ediciones || []).includes(edition.codigo)}
                  onChange={() =>
                    toggleFilterValue('ediciones', edition.codigo)
                  }
                  className="h-4 w-4 accent-brand"
                />
                {edition.nombre}
              </label>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-stroke bg-white px-4 py-3">
          <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
            Resultado
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            {items.length} dote{items.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFilters(emptyFilters())}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <RotateCcw className="h-4 w-4" />
          Limpiar
        </button>
      </div>

      {featsQuery.isLoading ? (
        <div className="rounded-3xl border border-stroke bg-white p-8 text-center text-sm font-semibold text-ink-soft shadow-card">
          Cargando dotes...
        </div>
      ) : items.length ? (
        <div className="overflow-hidden rounded-3xl border border-stroke shadow-card">
          {items.map((item, index) => (
            <FeatRow key={item.id} item={item} index={index} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-stroke bg-white p-10 text-center shadow-card">
          <Filter className="mx-auto h-8 w-8 text-brand" />
          <h2 className="mt-4 font-display text-2xl font-black text-ink">
            No hay dotes para esta vista
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Cambia el idioma, limpia filtros o crea una nueva dote.
          </p>
        </div>
      )}
    </section>
  )
}
