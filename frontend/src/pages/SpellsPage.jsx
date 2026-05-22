import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  Plus,
  Search,
  Star,
} from 'lucide-react'

import { CampaignCheckboxFilter } from '../components/ui/CampaignCheckboxFilter'
import { WikiText } from '../components/wiki/WikiText'
import { cn } from '../lib/cn'
import {
  bulkSaveSpells,
  fetchSpellOptions,
  fetchSpells,
  setSpellSaved,
} from './spells/api'
import { fetchCampaigns } from './campaign-detail/api'

function levelLabel(level) {
  return Number(level) === 0 ? 'Truco' : `Nivel ${level}`
}

function joinFilter(values) {
  return values?.length ? values.join('|') : undefined
}

function joinCampaignFilter(values) {
  if (!Array.isArray(values)) {
    return undefined
  }

  return values.length ? values.join('|') : '__none'
}

function joinCheckboxFilter(values) {
  if (!Array.isArray(values)) {
    return undefined
  }

  return values.length ? values.join('|') : '__none'
}

function filtersToBulkPayload(filters) {
  return {
    q: filters.q || undefined,
    niveles: joinFilter(filters.niveles),
    escuelas: joinFilter(filters.escuelas),
    classFilters: joinCheckboxFilter(filters.classFilters),
    tiposDano: joinFilter(filters.tiposDano),
    condiciones: joinFilter(filters.condiciones),
    miscelanea: joinFilter(filters.miscelanea),
    tiposCasteo: joinFilter(filters.tiposCasteo),
    pruebasSalvaciones: joinFilter(filters.pruebasSalvaciones),
    campaignIds: joinCampaignFilter(filters.campaignIds),
    matchMode: filters.matchMode,
  }
}

async function fetchAllVisibleSpells(filters) {
  let cursor = 0
  const items = []

  for (let guard = 0; guard < 40; guard += 1) {
    const page = await fetchSpells({
      limit: 250,
      cursor,
      q: filters.q || undefined,
      niveles: joinFilter(filters.niveles),
      escuelas: joinFilter(filters.escuelas),
      classFilters: joinCheckboxFilter(filters.classFilters),
      tiposDano: joinFilter(filters.tiposDano),
      condiciones: joinFilter(filters.condiciones),
      miscelanea: joinFilter(filters.miscelanea),
      tiposCasteo: joinFilter(filters.tiposCasteo),
      pruebasSalvaciones: joinFilter(filters.pruebasSalvaciones),
      campaignIds: joinCampaignFilter(filters.campaignIds),
      matchMode: filters.matchMode,
      guardados: filters.guardados || undefined,
    })

    items.push(...(page.items || []))

    if (!page.meta?.nextCursor) {
      return {
        items,
        meta: page.meta || {},
      }
    }

    cursor = Number(page.meta.nextCursor)
  }

  return {
    items,
    meta: {
      returned: items.length,
      totalVisible: items.length,
    },
  }
}

function OptionGroup({ title, options = [], selected = [], onToggle }) {
  const [sectionExpanded, setSectionExpanded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const visibleOptions = expanded ? options : options.slice(0, 10)

  if (!options.length) {
    return null
  }

  return (
    <div className="rounded-2xl border border-stroke bg-surface p-3">
      <button
        type="button"
        onClick={() => setSectionExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={sectionExpanded}
      >
        <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
          {title}
        </span>
        <span className="inline-flex items-center gap-2">
          {selected.length ? (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
              {selected.length}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-ink-muted transition',
              sectionExpanded && 'rotate-180'
            )}
          />
        </span>
      </button>
      {!sectionExpanded ? null : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleOptions.map((option) => {
              const active = selected.includes(String(option))

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onToggle(String(option))}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-bold transition',
                    active
                      ? 'border-brand bg-brand/15 text-brand'
                      : 'border-stroke bg-surface-strong text-ink-soft hover:border-brand/40 hover:text-brand'
                  )}
                >
                  {option}
                </button>
              )
            })}
          </div>
          {options.length > 10 ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="mt-3 font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted transition hover:text-brand"
            >
              {expanded ? 'Ver menos' : `Ver ${options.length - 10} más`}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

function CampaignOptionGroup({ campaigns = [], selectedIds = [], onChange }) {
  const [sectionExpanded, setSectionExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-stroke bg-surface p-3">
      <button
        type="button"
        onClick={() => setSectionExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={sectionExpanded}
      >
        <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
          Campañas
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-ink-muted transition',
            sectionExpanded && 'rotate-180'
          )}
        />
      </button>
      {sectionExpanded ? (
        <div className="mt-3">
          <CampaignCheckboxFilter
            campaigns={campaigns}
            selectedIds={selectedIds}
            onChange={onChange}
          />
        </div>
      ) : null}
    </div>
  )
}

function CheckboxOptionGroup({
  title,
  options = [],
  selectedValues = null,
  onChange,
  limit = 10,
}) {
  const [sectionExpanded, setSectionExpanded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const normalizedOptions = options.map(String)
  const visibleOptions = expanded
    ? normalizedOptions
    : normalizedOptions.slice(0, limit)
  const normalizedSelected = Array.isArray(selectedValues)
    ? selectedValues.map(String)
    : null
  const selectedSet = new Set(normalizedSelected ?? normalizedOptions)

  if (!normalizedOptions.length) {
    return null
  }

  function toggleOption(option) {
    const currentSelected = normalizedSelected ?? normalizedOptions
    const nextSelected = selectedSet.has(option)
      ? currentSelected.filter((item) => item !== option)
      : [...currentSelected, option]
    const uniqueSelected = normalizedOptions.filter((item) =>
      nextSelected.includes(item)
    )

    onChange(
      uniqueSelected.length === normalizedOptions.length ? null : uniqueSelected
    )
  }

  return (
    <div className="rounded-2xl border border-stroke bg-surface p-3">
      <button
        type="button"
        onClick={() => setSectionExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={sectionExpanded}
      >
        <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-ink-muted transition',
            sectionExpanded && 'rotate-180'
          )}
        />
      </button>
      {!sectionExpanded ? null : (
        <>
          <div className="mt-3 grid gap-2">
            {visibleOptions.map((option) => {
              const checked = selectedSet.has(option)

              return (
                <label
                  key={option}
                  className={cn(
                    'flex min-w-0 max-w-full cursor-pointer items-start gap-3 overflow-hidden rounded-xl border px-3 py-2 text-sm font-semibold transition',
                    checked
                      ? 'border-brand/50 bg-brand/10 text-brand'
                      : 'border-stroke bg-white text-ink-soft hover:border-brand/40 hover:text-ink'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(option)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-stroke text-brand focus:ring-brand"
                  />
                  <span className="min-w-0 flex-1 break-words leading-5 [overflow-wrap:anywhere]">
                    {option}
                  </span>
                </label>
              )
            })}
          </div>
          {normalizedOptions.length > limit ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="mt-3 inline-flex items-center gap-2 font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted transition hover:text-brand"
            >
              {expanded
                ? 'Ver menos'
                : `Ver ${normalizedOptions.length - limit} más`}
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition',
                  expanded && 'rotate-180'
                )}
              />
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

function SpellCard({ spell, onToggleSaved }) {
  const spellUrl = `/app/poderes/hechizos/${spell.id}`

  return (
    <article className="archive-responsive-card group relative grid gap-3 rounded-2xl border border-stroke bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:border-brand/40 sm:p-4">
      <Link
        to={spellUrl}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`Abrir hechizo ${spell.nombre}`}
      />
      <div className="archive-responsive-body flex items-start justify-between gap-3">
        <div className="pointer-events-none relative z-10 min-w-0">
          <p className="spell-card-title break-words font-display text-lg font-bold tracking-normal text-ink transition [overflow-wrap:anywhere] group-hover:text-brand sm:tracking-[-0.04em]">
            {spell.nombre}
          </p>
          <p className="spell-card-meta mt-1 break-words font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted [overflow-wrap:anywhere] sm:tracking-[0.18em]">
            {levelLabel(spell.nivel)}
            {spell.escuela ? ` · ${spell.escuela}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleSaved(spell)
          }}
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition',
            'relative z-20',
            spell.estaGuardado
              ? 'border-brand/40 bg-brand/10 text-brand'
              : 'border-stroke text-ink-muted hover:border-brand/40 hover:text-brand'
          )}
          aria-label={
            spell.estaGuardado ? 'Quitar guardado' : 'Guardar hechizo'
          }
        >
          <Star
            className="h-4 w-4"
            style={{
              fill: spell.estaGuardado ? 'currentColor' : 'transparent',
            }}
          />
        </button>
      </div>
      <p className="spell-card-description pointer-events-none relative z-10 line-clamp-2 break-words text-sm leading-6 text-ink-soft [overflow-wrap:anywhere] sm:line-clamp-3">
        <WikiText
          text={spell.descripcion}
          disableLinks
          emptyText="Sin descripción registrada."
        />
      </p>
      <div className="pointer-events-none relative z-10 flex flex-wrap gap-2">
        {(spell.clases || []).slice(0, 5).map((className) => (
          <span
            key={className}
            className="spell-card-chip max-w-full break-words rounded-full bg-brand/10 px-2 py-1 font-label text-[9px] font-black uppercase tracking-[0.12em] text-brand [overflow-wrap:anywhere]"
          >
            {className}
          </span>
        ))}
      </div>
    </article>
  )
}

export function SpellsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    q: '',
    niveles: [],
    escuelas: [],
    classFilters: null,
    tiposDano: [],
    condiciones: [],
    miscelanea: [],
    tiposCasteo: [],
    pruebasSalvaciones: [],
    campaignIds: null,
    matchMode: 'all',
    guardados: false,
  })
  const [openLevels, setOpenLevels] = useState({})
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const optionsQuery = useQuery({
    queryKey: ['spell-options'],
    queryFn: fetchSpellOptions,
    staleTime: 10 * 60 * 1000,
  })
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', 'spell-form-options'],
    queryFn: fetchCampaigns,
    staleTime: 5 * 60 * 1000,
  })
  const spellsQuery = useQuery({
    queryKey: ['spells', 'all-visible', filters],
    queryFn: () => fetchAllVisibleSpells(filters),
  })
  const spells = useMemo(
    () => spellsQuery.data?.items || [],
    [spellsQuery.data?.items]
  )
  const groupedSpells = useMemo(() => {
    const groups = new Map()

    for (let index = 0; index <= 10; index += 1) {
      groups.set(index, [])
    }

    for (const spell of spells) {
      groups.get(Number(spell.nivel || 0))?.push(spell)
    }

    return [...groups.entries()].filter(([, items]) => items.length)
  }, [spells])

  const saveMutation = useMutation({
    mutationFn: (spell) => setSpellSaved(spell.id, !spell.estaGuardado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spells'] })
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
    },
  })
  const bulkSaveMutation = useMutation({
    mutationFn: (guardado) =>
      bulkSaveSpells(filtersToBulkPayload(filters), guardado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spells'] })
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
    },
  })
  const options = optionsQuery.data || {}
  const toggleFilter = (key, value) => {
    setFilters((current) => {
      const values = current[key] || []
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      }
    })
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate('/app/poderes')}
              className="theme-back-button mb-3 inline-flex items-center gap-2 rounded-xl border border-stroke bg-surface px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand/50 hover:text-brand"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver a poderes
            </button>
            <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              Poderes · Hechizos
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-ink">
              Biblioteca de hechizos
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
              Todos los hechizos visibles se cargan por tandas optimizadas y se
              organizan por nivel. Puedes guardar hechizos y crear entradas
              públicas o privadas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/poderes/hechizos/nuevo')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95"
          >
            <Plus className="h-4 w-4" />
            Crear hechizo
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-stroke bg-surface p-4 shadow-card">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={filters.q}
            onChange={(event) =>
              setFilters((current) => ({ ...current, q: event.target.value }))
            }
            className="archive-input h-11 w-full rounded-xl pl-10"
            placeholder="Buscar hechizos"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            className="inline-flex items-center gap-2 rounded-xl border border-stroke bg-white px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand/50 hover:text-brand"
          >
            Filtros avanzados
            <ChevronDown
              className={cn(
                'h-4 w-4 transition',
                showAdvancedFilters ? 'rotate-180' : ''
              )}
            />
          </button>
        </div>
        {showAdvancedFilters ? (
          <>
            <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
              <OptionGroup
                title="Nivel"
                options={(options.niveles || []).map(levelLabel)}
                selected={filters.niveles.map(levelLabel)}
                onToggle={(label) => {
                  const level =
                    label === 'Truco' ? '0' : label.replace('Nivel ', '')
                  toggleFilter('niveles', level)
                }}
              />
              <OptionGroup
                title="Escuela"
                options={options.escuelas || []}
                selected={filters.escuelas}
                onToggle={(value) => toggleFilter('escuelas', value)}
              />
              <CheckboxOptionGroup
                title="Clases"
                options={options.clases || []}
                selectedValues={filters.classFilters}
                onChange={(classFilters) =>
                  setFilters((current) => ({ ...current, classFilters }))
                }
              />
              <OptionGroup
                title="Tipo de daño"
                options={options.tiposDano || []}
                selected={filters.tiposDano}
                onToggle={(value) => toggleFilter('tiposDano', value)}
              />
              <OptionGroup
                title="Efectos causados"
                options={options.condiciones || []}
                selected={filters.condiciones}
                onToggle={(value) => toggleFilter('condiciones', value)}
              />
              <OptionGroup
                title="Tiempo de casteo"
                options={options.tiposCasteo || []}
                selected={filters.tiposCasteo}
                onToggle={(value) => toggleFilter('tiposCasteo', value)}
              />
              <OptionGroup
                title="Pruebas y salvaciones"
                options={options.pruebasSalvaciones || []}
                selected={filters.pruebasSalvaciones}
                onToggle={(value) => toggleFilter('pruebasSalvaciones', value)}
              />
              <OptionGroup
                title="Miscelánea"
                options={options.miscelanea || []}
                selected={filters.miscelanea}
                onToggle={(value) => toggleFilter('miscelanea', value)}
              />
              <CampaignOptionGroup
                campaigns={campaignsQuery.data || []}
                selectedIds={filters.campaignIds}
                onChange={(campaignIds) =>
                  setFilters((current) => ({ ...current, campaignIds }))
                }
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
                <button
                  type="button"
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      guardados: !current.guardados,
                    }))
                  }
                  className={cn(
                    'rounded-xl px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]',
                    filters.guardados
                      ? 'bg-brand text-black'
                      : 'bg-white text-ink-soft'
                  )}
                >
                  Guardados
                </button>
                <button
                  type="button"
                  onClick={() => bulkSaveMutation.mutate(true)}
                  disabled={bulkSaveMutation.isPending || spellsQuery.isLoading}
                  className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand transition hover:bg-brand hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Guardar filtrados
                </button>
                <button
                  type="button"
                  onClick={() => bulkSaveMutation.mutate(false)}
                  disabled={bulkSaveMutation.isPending || spellsQuery.isLoading}
                  className="rounded-xl border border-stroke bg-surface-strong px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Quitar filtrados
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    q: '',
                    niveles: [],
                    escuelas: [],
                    classFilters: null,
                    tiposDano: [],
                    condiciones: [],
                    miscelanea: [],
                    tiposCasteo: [],
                    pruebasSalvaciones: [],
                    campaignIds: null,
                    matchMode: 'all',
                    guardados: false,
                  })
                }
                className="rounded-xl border border-stroke bg-white px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft"
              >
                Limpiar filtros
              </button>
            </div>
          </>
        ) : null}
      </div>

      <p className="text-sm text-ink-soft">
        {spellsQuery.isLoading
          ? 'Cargando hechizos por tandas...'
          : `${spells.length} hechizos visibles`}
      </p>

      <div className="grid gap-5">
        {groupedSpells.map(([level, items]) => (
          <section
            key={level}
            className="overflow-hidden rounded-3xl border border-stroke bg-white shadow-card"
          >
            <button
              type="button"
              onClick={() =>
                setOpenLevels((current) => ({
                  ...current,
                  [level]: !(current[level] ?? true),
                }))
              }
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-black">
                  <BookOpen className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-display text-2xl font-bold tracking-[-0.05em] text-ink">
                    {levelLabel(level)}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {items.length} hechizos
                  </span>
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-ink-muted transition',
                  (openLevels[level] ?? true) ? 'rotate-180' : ''
                )}
              />
            </button>
            {(openLevels[level] ?? true) ? (
              <div className="archive-responsive-grid spells-mobile-list grid gap-4 border-t border-stroke bg-surface/60 p-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((spell) => (
                  <SpellCard
                    key={spell.id}
                    spell={spell}
                    onToggleSaved={(item) => saveMutation.mutate(item)}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </section>
  )
}
