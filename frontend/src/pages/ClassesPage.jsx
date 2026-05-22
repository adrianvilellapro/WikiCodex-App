import { createElement, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  CirclePlus,
  Cog,
  Droplets,
  Eye,
  Filter,
  Gavel,
  GraduationCap,
  Leaf,
  Music,
  Orbit,
  PawPrint,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Sun,
  Users,
  WandSparkles,
  Zap,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { CampaignCheckboxFilter } from '../components/ui/CampaignCheckboxFilter'
import { WikiText } from '../components/wiki/WikiText'
import { cn } from '../lib/cn'
import { fetchClassOptions, fetchClasses } from './classes/api'

const CLASS_ICON_MAP = {
  BookOpen,
  CirclePlus,
  Cog,
  Droplets,
  Eye,
  Gavel,
  GraduationCap,
  Leaf,
  Music,
  Orbit,
  PawPrint,
  Shield,
  Sparkles,
  Sun,
  Users,
  WandSparkles,
  Zap,
}

const SORT_OPTIONS = [
  ['name_asc', 'Nombre A-Z'],
  ['name_desc', 'Nombre Z-A'],
  ['created_desc', 'Subida reciente'],
  ['updated_desc', 'Actualización reciente'],
]

const CONTENT_FILTERS = [
  ['classic', 'Clásico'],
  ['one', 'D&D One'],
  ['misc', 'Miscelánea'],
  ['wikicodex', 'WikiCodex'],
]

const BRAND_HUB_GRADIENT =
  'radial-gradient(circle at top right, rgb(255 255 255 / 0.22), transparent 34%), linear-gradient(145deg, rgb(var(--theme-brand-deep)) 0%, rgb(var(--color-brand-strong)) 52%, rgb(var(--color-accent)) 100%)'

function emptyFilters() {
  return {
    q: '',
    idioma: 'es',
    campaignIds: null,
    sort: 'name_asc',
    ediciones: ['classic', 'one', 'misc', 'wikicodex'],
  }
}

function getClassIcon(name) {
  return CLASS_ICON_MAP[name] || GraduationCap
}

function editionLabel(item) {
  if (item.edicion === 'one') {
    return 'D&D One'
  }

  if (item.edicion === 'wikicodex' || item.fuente === 'wikicodex') {
    return 'WikiCodex'
  }

  if (item.categoriaCatalogo === 'misc' || item.edicion === 'misc') {
    return 'Miscelánea'
  }

  return 'Clásico'
}

function ClassDirectoryRow({ item, index }) {
  const location = useLocation()
  const Icon = getClassIcon(item.icono)
  const returnTo = {
    pathname: location.pathname,
    search: location.search,
    scrollY: window.scrollY,
  }

  return (
    <article
      className={cn(
        'group grid gap-4 border border-stroke px-4 py-5 shadow-sm transition sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:px-6 lg:px-8',
        index % 2
          ? 'bg-brand/10 hover:bg-brand/15'
          : 'bg-white hover:bg-surface-strong'
      )}
    >
      <Link
        to={`/app/clases/${item.id}`}
        state={{ returnTo }}
        className="flex min-h-24 items-center justify-center rounded-xl text-ink transition group-hover:text-brand sm:min-h-36"
        aria-label={`Abrir ${item.nombre}`}
      >
        {createElement(Icon, {
          className: 'h-16 w-16 sm:h-24 sm:w-24',
          strokeWidth: 1.8,
        })}
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="archive-chip">
            {item.idiomaCodigo === 'es' ? 'ES' : 'EN'}
          </span>
          <span className="archive-chip">{editionLabel(item)}</span>
          {item.fuente ? (
            <span className="archive-chip">{item.fuente}</span>
          ) : null}
        </div>

        <Link
          to={`/app/clases/${item.id}`}
          state={{ returnTo }}
          className="mt-2 inline-flex max-w-full items-baseline gap-2 text-ink transition hover:text-brand"
        >
          <span className="min-w-0 break-words font-display text-3xl font-black tracking-[-0.04em] [overflow-wrap:anywhere] sm:text-4xl">
            {item.nombre}
          </span>
        </Link>

        <div className="theme-sheet-copy mt-3 line-clamp-3 max-w-4xl text-sm italic leading-6 text-ink-soft">
          <WikiText
            text={
              item.resumen ||
              item.descripcion ||
              'Clase sin resumen registrado.'
            }
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section>
            <h2 className="text-sm font-semibold text-ink">Subclases</h2>
            {item.subclases?.length ? (
              <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                {item.subclases.map((subclass) => (
                  <Link
                    key={subclass.id}
                    to={`/app/clases/${item.id}/subclases/${subclass.id}`}
                    state={{ returnTo }}
                    className="text-sm font-semibold text-brand underline decoration-brand/25 underline-offset-4 transition hover:text-brand-strong hover:decoration-brand"
                  >
                    {subclass.nombre}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">
                No hay subclases registradas.
              </p>
            )}
          </section>

          <section className="grid content-start gap-2 text-sm text-ink-soft">
            <p>
              <span className="font-semibold text-ink">Dado:</span> d
              {item.dadoGolpeCaras || '-'}
            </p>
            <p>
              <span className="font-semibold text-ink">Rasgos base:</span>{' '}
              {item.rasgos?.length || 0}
            </p>
            <p>
              <span className="font-semibold text-ink">Subclases:</span>{' '}
              {item.subclases?.length || 0}
            </p>
          </section>
        </div>
      </div>
    </article>
  )
}

function RulesHubCard({ to, icon, eyebrow, title, description, highlights }) {
  return (
    <Link
      to={to}
      className="group relative flex min-h-[24rem] overflow-hidden rounded-[2rem] border border-stroke bg-ink p-7 text-white shadow-card transition hover:-translate-y-1 hover:border-brand/50 max-sm:min-h-[18rem] max-sm:rounded-2xl max-sm:p-5"
    >
      <div
        className="absolute inset-0"
        style={{ background: BRAND_HUB_GRADIENT }}
      />
      <div className="absolute bottom-0 left-0 h-40 w-full bg-gradient-to-t from-black/45 to-transparent" />
      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur">
            {icon}
          </div>
          <p className="mt-6 font-label text-[10px] font-black uppercase tracking-[0.24em] text-white/75">
            {eyebrow}
          </p>
          <h2 className="mt-3 max-w-xl font-display text-5xl font-bold tracking-[-0.07em] max-sm:text-3xl max-sm:tracking-[-0.05em]">
            {title}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/78 max-sm:mt-4 max-sm:text-sm max-sm:leading-6">
            {description}
          </p>
        </div>

        <div className="mt-10 grid gap-3 max-sm:mt-6 max-sm:gap-2">
          {highlights.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/15 bg-white/12 px-4 py-3 text-sm font-semibold text-white/85 backdrop-blur"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}

export function ClassesPage() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
          Reglamento
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-ink">
          Clases y Dotes
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
          Consulta progresiones de clase, subclases y dotes del catálogo.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <RulesHubCard
          to="/app/clases/listado"
          icon={<GraduationCap className="h-6 w-6" />}
          eyebrow="Progresión"
          title="Clases"
          description="Listado de clases con tabla por nivel, rasgos base y subclases separadas en ficha propia."
          highlights={[
            'Clásico, D&D One, miscelánea y WikiCodex',
            'Subclases clicables',
            'Vista en inglés o español cuando exista',
          ]}
        />
        <RulesHubCard
          to="/app/clases/dotes"
          icon={<BookOpen className="h-6 w-6" />}
          eyebrow="Opciones de avance"
          title="Dotes"
          description="Biblioteca de dotes importadas de 5etools, con buscador, detalle y creación manual."
          highlights={[
            'Carga optimizada por API',
            'Buscador flexible',
            'Creación y edición con permisos',
          ]}
        />
      </div>
    </section>
  )
}

export function ClassListPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(() => emptyFilters())
  const optionsQuery = useQuery({
    queryKey: ['class-options'],
    queryFn: fetchClassOptions,
    staleTime: 60 * 1000,
  })
  const classesQuery = useQuery({
    queryKey: ['classes', filters],
    queryFn: () => fetchClasses({ filters, limit: 500 }),
    staleTime: 45 * 1000,
  })
  const items = useMemo(
    () => classesQuery.data?.items || [],
    [classesQuery.data?.items]
  )
  const campaigns = optionsQuery.data?.campanasGestionables || []
  const totalSubclasses = useMemo(
    () =>
      items.reduce(
        (count, item) => count + Number(item.subclases?.length || 0),
        0
      ),
    [items]
  )

  function updateFilter(patch) {
    setFilters((current) => ({ ...current, ...patch }))
  }

  function toggleEdition(value) {
    setFilters((current) => {
      const selected = new Set(current.ediciones)

      if (selected.has(value)) {
        selected.delete(value)
      } else {
        selected.add(value)
      }

      return { ...current, ediciones: [...selected] }
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
                Archivo de reglas
              </p>
              <h1 className="mt-2 font-display text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
                Clases
              </h1>
              <p className="mt-3 text-sm leading-7 text-ink-soft">
                Consulta clases públicas y entra directamente a sus subclases.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/clases/nuevo')}
            className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
          >
            <Plus className="h-4 w-4" />
            Crear Clase
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
              placeholder="Buscar clases o subclases"
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

      <div className="grid gap-4 rounded-3xl border border-stroke bg-surface-strong/70 p-4 shadow-card xl:grid-cols-[1fr_13rem_16rem_18rem_auto]">
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

        <div>
          <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
            Contenido
          </span>
          <div className="mt-2 grid gap-1 rounded-xl border border-stroke bg-white p-2">
            {CONTENT_FILTERS.map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm font-semibold text-ink-soft"
              >
                <input
                  type="checkbox"
                  checked={filters.ediciones.includes(value)}
                  onChange={() => toggleEdition(value)}
                  className="h-4 w-4 accent-[rgb(var(--color-brand))]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
            Campaña
          </span>
          <div className="mt-2">
            <CampaignCheckboxFilter
              campaigns={campaigns}
              selectedIds={filters.campaignIds}
              onChange={(campaignIds) => updateFilter({ campaignIds })}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-stroke bg-white px-4 py-3">
          <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
            Resultado
          </p>
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            {items.length} clase{items.length === 1 ? '' : 's'} ·{' '}
            {totalSubclasses} subclases
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

      {classesQuery.isLoading ? (
        <div className="rounded-3xl border border-stroke bg-white p-8 text-center text-sm font-semibold text-ink-soft shadow-card">
          Cargando clases...
        </div>
      ) : items.length ? (
        <div className="overflow-hidden rounded-3xl border border-stroke shadow-card">
          {items.map((item, index) => (
            <ClassDirectoryRow key={item.id} item={item} index={index} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-stroke bg-white p-10 text-center shadow-card">
          <Filter className="mx-auto h-8 w-8 text-brand" />
          <h2 className="mt-4 font-display text-2xl font-black text-ink">
            No hay clases para esta vista
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Cambia el idioma, limpia los filtros o crea una nueva clase en esa
            versión.
          </p>
        </div>
      )}
    </section>
  )
}
