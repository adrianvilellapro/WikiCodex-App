import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lock,
  Minus,
  Plus,
  Search,
  Trash2,
  Unlock,
  UserPlus,
  UserRound,
  WandSparkles,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { WikiText } from '../components/wiki/WikiText'
import { useAuth } from '../features/auth/auth-context'
import { cn } from '../lib/cn'
import { api } from '../services/http'
import { fetchCharacterDetail } from './character-detail/api'
import { fetchSpellOptions, fetchSpells } from './spells/api'

const STORAGE_VERSION = 'v1'
const EMPTY_CASTERS = []
const DEFAULT_SPELL_FILTERS = {
  q: '',
  level: '',
  className: '',
  school: '',
  sort: 'level_asc',
}
const DEFAULT_PICKER_FILTERS = {
  q: '',
  level: '',
  className: '',
  school: '',
}
const SPELL_LEVELS = Array.from({ length: 11 }, (_, index) => index)
const SLOT_LEVELS = Array.from({ length: 10 }, (_, index) => index + 1)

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getStorageKey(userId) {
  return `wikicodex:spell-manager:${userId || 'anon'}:${STORAGE_VERSION}`
}

function useDebouncedValue(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedValue(value), delay)

    return () => window.clearTimeout(handle)
  }, [delay, value])

  return debouncedValue
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? '').replace(',', '.'), 10)

  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback
}

function sanitizeIntegerInput(value) {
  return String(value || '').replace(/\D/gu, '')
}

function levelLabel(level) {
  return Number(level) === 0 ? 'Truco' : `Nivel ${level}`
}

function slotLabel(level) {
  return `Nv${level}`
}

function normalizeSpell(spell, source = 'character') {
  const spellId = spell?.hechizoId || spell?.id

  if (!spellId) {
    return null
  }

  return {
    id: spellId,
    hechizoId: spellId,
    nombre: spell.nombre || 'Hechizo sin nombre',
    nivel: Number(spell.nivel || 0),
    escuela: spell.escuela || '',
    tipoCasteo: spell.tipoCasteo || '',
    concentracion: Boolean(spell.concentracion),
    clases: Array.isArray(spell.clases) ? spell.clases : [],
    descripcion: spell.descripcion || '',
    source: spell.source || source,
    addedAt: spell.addedAt || new Date().toISOString(),
  }
}

function normalizeSpellList(spells = [], source = 'character') {
  const seen = new Set()

  return spells
    .map((spell) => normalizeSpell(spell, source))
    .filter(Boolean)
    .filter((spell) => {
      if (seen.has(spell.id)) {
        return false
      }

      seen.add(spell.id)
      return true
    })
    .sort(
      (left, right) =>
        Number(left.nivel || 0) - Number(right.nivel || 0) ||
        String(left.nombre || '').localeCompare(String(right.nombre || ''))
    )
}

function normalizeStoredSlots(slots = {}) {
  const normalized = {}

  for (const [level, value] of Object.entries(slots || {})) {
    const numericLevel = Number(level)

    if (
      !Number.isInteger(numericLevel) ||
      numericLevel < 1 ||
      numericLevel > 10
    ) {
      continue
    }

    const max =
      typeof value === 'object' && value !== null
        ? toInteger(value.max)
        : toInteger(value)
    const current =
      typeof value === 'object' && value !== null
        ? Math.min(toInteger(value.current, max), max)
        : max

    normalized[String(numericLevel)] = { max, current }
  }

  return normalized
}

function normalizeSpellSort(sort) {
  return sort === 'level_desc' ? 'level_desc' : 'level_asc'
}

function createSlotsFromCharacter(slotMap = {}, spells = []) {
  const levels = new Set()

  for (const level of Object.keys(slotMap || {})) {
    const numericLevel = Number(level)

    if (
      Number.isInteger(numericLevel) &&
      numericLevel >= 1 &&
      numericLevel <= 10
    ) {
      levels.add(numericLevel)
    }
  }

  for (const spell of spells) {
    const level = Number(spell.nivel || 0)

    if (level > 0 && level <= 10) {
      levels.add(level)
    }
  }

  return Object.fromEntries(
    [...levels]
      .sort((left, right) => left - right)
      .map((level) => {
        const max = toInteger(slotMap?.[level] ?? slotMap?.[String(level)] ?? 0)

        return [String(level), { max, current: max }]
      })
  )
}

function normalizeCaster(caster) {
  const spells = normalizeSpellList(caster?.spells || [], 'temporary')

  return {
    id: caster?.id || createId(),
    characterId: caster?.characterId || null,
    name: caster?.name || '',
    baseName: caster?.baseName || caster?.name || '',
    title: caster?.title || '',
    imageUrl: caster?.imageUrl || null,
    campaignName: caster?.campaignName || '',
    isManual: Boolean(caster?.isManual),
    maxUnlocked: Boolean(caster?.maxUnlocked),
    collapsed: Boolean(caster?.collapsed),
    spellsOpen: caster?.spellsOpen !== false,
    openLevels: caster?.openLevels || {},
    pickerOpen: Boolean(caster?.pickerOpen),
    addedAt: caster?.addedAt || new Date().toISOString(),
    slots: normalizeStoredSlots(caster?.slots || {}),
    spells,
    filters: {
      ...DEFAULT_SPELL_FILTERS,
      ...(caster?.filters || {}),
      sort: normalizeSpellSort(caster?.filters?.sort),
    },
    picker: {
      ...DEFAULT_PICKER_FILTERS,
      ...(caster?.picker || {}),
    },
  }
}

function createCasterFromCharacter(character) {
  const spells = normalizeSpellList(character.hechizos || [], 'character')
  const slots = createSlotsFromCharacter(character.hechizosSlots || {}, spells)

  return normalizeCaster({
    id: createId(),
    characterId: character.id,
    name: character.nombre,
    baseName: character.nombre,
    title: character.titulo || '',
    imageUrl: character.imagenPrincipalUrl || null,
    campaignName: character.campana?.nombre || '',
    isManual: false,
    slots,
    spells,
    addedAt: new Date().toISOString(),
  })
}

function createManualCaster() {
  return normalizeCaster({
    id: createId(),
    name: '',
    baseName: 'Lanzador manual',
    title: 'Entrada manual',
    isManual: true,
    slots: {},
    spells: [],
    pickerOpen: true,
    addedAt: new Date().toISOString(),
  })
}

function readStoredCasters(storageKey) {
  if (typeof window === 'undefined') {
    return EMPTY_CASTERS
  }

  try {
    const stored = window.localStorage.getItem(storageKey)

    if (!stored) {
      return EMPTY_CASTERS
    }

    const parsed = JSON.parse(stored)
    const source = Array.isArray(parsed?.casters) ? parsed.casters : parsed

    return Array.isArray(source) ? source.map(normalizeCaster) : EMPTY_CASTERS
  } catch {
    return EMPTY_CASTERS
  }
}

function writeStoredCasters(storageKey, casters) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify({ casters }))
}

async function searchVisibleCharacters(query) {
  const { data } = await api.get('/characters', {
    params: {
      view: 'characters',
      limit: 12,
      q: query,
      matchMode: 'all',
      sort: 'name_asc',
    },
  })

  return data.items || []
}

function spellMatchesFilters(spell, filters) {
  const query = normalizeText(filters.q)
  const school = normalizeText(filters.school)
  const className = normalizeText(filters.className)
  const level = filters.level

  const haystack = normalizeText(
    [
      spell.nombre,
      spell.escuela,
      spell.tipoCasteo,
      spell.descripcion,
      ...(spell.clases || []),
    ].join(' ')
  )

  if (query && !haystack.includes(query)) {
    return false
  }

  if (level !== '' && Number(spell.nivel || 0) !== Number(level)) {
    return false
  }

  if (school && normalizeText(spell.escuela) !== school) {
    return false
  }

  if (
    className &&
    !(spell.clases || []).some((item) => normalizeText(item) === className)
  ) {
    return false
  }

  return true
}

function groupSpells(spells, sort = 'level_asc') {
  const groups = new Map()

  for (const spell of spells) {
    const level = Number(spell.nivel || 0)

    if (!groups.has(level)) {
      groups.set(level, [])
    }

    groups.get(level).push(spell)
  }

  return [...groups.entries()].sort(([left], [right]) =>
    sort === 'level_desc' ? right - left : left - right
  )
}

function selectOptions(options, fallback = []) {
  return Array.isArray(options) && options.length ? options : fallback
}

function CharacterAvatar({ item, className = 'h-14 w-14', linkTo = null }) {
  const content = (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-xl border border-stroke bg-surface-strong',
        className
      )}
    >
      {item?.imagenPrincipalUrl || item?.imageUrl ? (
        <CloudinaryImage
          src={item.imagenPrincipalUrl || item.imageUrl}
          alt={item.nombre || item.name || 'Personaje'}
          variant="avatar"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink-muted">
          <UserRound className="h-5 w-5" />
        </div>
      )}
    </div>
  )

  if (!linkTo) {
    return content
  }

  return (
    <Link
      to={linkTo}
      target="_blank"
      rel="noreferrer"
      className="inline-flex transition hover:opacity-85"
      aria-label={`Abrir ficha de ${item?.nombre || item?.name || 'personaje'}`}
    >
      {content}
    </Link>
  )
}

function CharacterSearchPanel({
  isOpen,
  onToggle,
  query,
  onQueryChange,
  results,
  isLoading,
  error,
  addingCharacterId,
  addedCounts = new Map(),
  onAddCharacter,
}) {
  return (
    <article className="panel grid gap-4 border border-brand/20 p-4 sm:p-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
            Incorporar personajes
          </span>
          <span className="mt-1 block font-display text-2xl font-bold text-ink">
            Buscador de personajes
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-ink-muted transition',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen ? (
        <>
          <div className="relative h-12">
            <span className="pointer-events-none absolute left-0 top-0 flex h-12 w-12 items-center justify-center text-ink-muted">
              <Search className="h-4 w-4" />
            </span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="archive-input h-12 w-full rounded-xl pl-12"
              placeholder="Buscar personaje con visión completa"
              type="search"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}

          {query.trim().length >= 2 ? (
            <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
              {isLoading ? (
                <div className="rounded-xl bg-surface-strong px-4 py-5 text-sm text-ink-soft">
                  Buscando personajes visibles...
                </div>
              ) : results.length ? (
                results.map((item) => {
                  const isPreviewOnly = item.modoVista === 'preview'
                  const addedCount = addedCounts.get(item.id) || 0

                  return (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-xl border border-stroke bg-white p-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <CharacterAvatar
                        item={item}
                        linkTo={`/app/personajes/${item.id}`}
                      />
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="min-w-0 truncate font-semibold text-ink">
                            {item.nombre}
                          </p>
                          {isPreviewOnly ? (
                            <span className="archive-chip">Solo preview</span>
                          ) : (
                            <span className="archive-chip">
                              Visión completa
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-ink-soft">
                          {item.titulo || 'Sin título'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddCharacter(item)}
                        disabled={
                          isPreviewOnly || addingCharacterId === item.id
                        }
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Plus className="h-4 w-4" />
                        {addingCharacterId === item.id ? 'Cargando' : 'Añadir'}
                        {addedCount ? (
                          <span className="rounded-md bg-black/10 px-1.5 py-0.5 text-[9px] leading-none">
                            x{addedCount}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-xl border border-dashed border-stroke bg-surface-strong px-4 py-5 text-sm text-ink-soft">
                  No hay personajes con visión completa para esa búsqueda.
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  )
}

function ManualCasterPanel({ onAddManualCaster }) {
  return (
    <article className="panel grid gap-4 p-4 sm:p-5">
      <div>
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-ink-muted">
          Entrada libre
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink">
          Lanzador manual
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Crea una ficha temporal sin personaje real para criaturas, aliados o
          lanzadores improvisados.
        </p>
      </div>
      <button
        type="button"
        onClick={onAddManualCaster}
        className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
      >
        <UserPlus className="h-4 w-4" />
        Añadir manual
      </button>
    </article>
  )
}

function SlotControl({
  level,
  slot,
  maxUnlocked,
  onCurrentChange,
  onMaxChange,
  onRemove,
}) {
  const max = Math.max(0, toInteger(slot.max))
  const current = Math.min(Math.max(0, toInteger(slot.current)), max)
  const barSegments = max > 0 ? Array.from({ length: max }) : []

  return (
    <div className="grid w-full gap-2 rounded-xl border border-stroke bg-surface p-2 shadow-sm">
      <div className="grid grid-cols-[3.2rem_minmax(0,1fr)_minmax(0,1.25fr)_auto] items-stretch gap-2">
        <div className="grid place-items-center rounded-lg bg-brand/10 text-center">
          <span className="font-display text-2xl font-black leading-none text-brand">
            {slotLabel(level)}
          </span>
        </div>

        <label className="grid min-w-0 content-center rounded-lg border border-stroke bg-white px-2 py-1.5 text-center">
          <span className="font-label text-[8px] font-black uppercase tracking-[0.12em] text-ink-muted">
            Max
          </span>
          {maxUnlocked ? (
            <input
              type="text"
              inputMode="numeric"
              min="0"
              step="1"
              value={slot.max}
              onChange={(event) =>
                onMaxChange(sanitizeIntegerInput(event.target.value))
              }
              className="mx-auto h-7 w-full min-w-0 rounded-md border border-stroke bg-surface px-1 text-center font-display text-2xl font-black leading-none text-ink outline-none focus:border-brand"
            />
          ) : (
            <span className="grid h-7 place-items-center text-center font-display text-2xl font-black leading-none text-ink">
              {max}
            </span>
          )}
        </label>

        <div className="grid min-w-0 content-center rounded-lg border border-stroke bg-white px-2 py-1.5">
          <span className="text-center font-label text-[8px] font-black uppercase tracking-[0.12em] text-ink-muted">
            Actual
          </span>
          <div className="mt-1 grid h-9 grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] overflow-hidden rounded-lg border border-stroke bg-surface">
            <button
              type="button"
              onClick={() => onCurrentChange(slot.current - 1)}
              className="inline-flex h-full w-full items-center justify-center text-ink-muted transition hover:bg-surface-strong hover:text-brand"
              aria-label={`Restar ${slotLabel(level)}`}
            >
              <Minus className="h-5 w-5" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              min="0"
              step="1"
              value={slot.current}
              onChange={(event) =>
                onCurrentChange(sanitizeIntegerInput(event.target.value))
              }
              className="h-full min-w-0 border-x border-stroke bg-transparent px-1 py-0 text-center font-display text-2xl font-black leading-[2.25rem] text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => onCurrentChange(slot.current + 1)}
              className="inline-flex h-full w-full items-center justify-center text-ink-muted transition hover:bg-surface-strong hover:text-brand"
              aria-label={`Sumar ${slotLabel(level)}`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {maxUnlocked ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-full min-h-14 w-8 items-center justify-center rounded-lg border border-stroke bg-white text-ink-muted transition hover:border-danger hover:text-danger"
            aria-label={`Quitar ${slotLabel(level)}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="w-0" />
        )}
      </div>

      <div
        className="grid h-2 gap-0.5 overflow-hidden rounded-full bg-white p-0.5"
        style={{
          gridTemplateColumns: `repeat(${Math.max(max, 1)}, minmax(0, 1fr))`,
        }}
      >
        {barSegments.length ? (
          barSegments.map((_, index) => (
            <span
              key={index}
              className={cn(
                'h-full rounded-full transition-colors',
                index < current ? 'bg-brand' : 'bg-stroke'
              )}
            />
          ))
        ) : (
          <span className="h-full rounded-full bg-stroke" />
        )}
      </div>
    </div>
  )
}

function SpellMiniCard({ spell, onRemove }) {
  return (
    <article className="group relative grid gap-3 rounded-xl border border-stroke bg-white p-3 shadow-card transition hover:border-brand/40">
      <Link
        to={`/app/poderes/hechizos/${spell.id}`}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 z-10 rounded-xl"
        aria-label={`Abrir hechizo ${spell.nombre}`}
      />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="pointer-events-none relative z-20 min-w-0">
          <span className="inline-flex max-w-full items-center gap-2 font-display text-lg font-bold text-ink transition group-hover:text-brand">
            <span className="truncate">{spell.nombre}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </span>
          <p className="mt-1 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
            {levelLabel(spell.nivel)}
            {spell.escuela ? ` · ${spell.escuela}` : ''}
            {spell.concentracion ? ' · Concentración' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(spell.id)}
          className="relative z-30 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stroke bg-white text-ink-muted transition hover:border-danger hover:text-danger"
          aria-label={`Quitar hechizo ${spell.nombre}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="pointer-events-none relative z-20 line-clamp-2 text-sm leading-6 text-ink-soft">
        <WikiText
          text={spell.descripcion}
          disableLinks
          emptyText="Sin descripción registrada."
        />
      </p>
      <div className="pointer-events-none relative z-20 flex flex-wrap gap-1.5">
        {spell.source === 'temporary' ? (
          <span className="rounded-full bg-brand/10 px-2 py-1 font-label text-[9px] font-black uppercase tracking-[0.12em] text-brand">
            Temporal
          </span>
        ) : null}
        {(spell.clases || []).slice(0, 4).map((className) => (
          <span
            key={className}
            className="rounded-full bg-surface-strong px-2 py-1 text-[11px] font-bold text-ink-soft"
          >
            {className}
          </span>
        ))}
      </div>
    </article>
  )
}

function SpellPicker({
  caster,
  options,
  selectedSpellIds,
  onPickerChange,
  onAddSpell,
}) {
  const debouncedPicker = useDebouncedValue(caster.picker)
  const query = useQuery({
    queryKey: ['spell-manager', 'spell-picker', caster.id, debouncedPicker],
    queryFn: () =>
      fetchSpells({
        limit: 25,
        q: debouncedPicker.q || undefined,
        nivel: debouncedPicker.level !== '' ? debouncedPicker.level : undefined,
        escuela: debouncedPicker.school || undefined,
        clase: debouncedPicker.className || undefined,
        matchMode: 'all',
      }),
    enabled: caster.pickerOpen,
    staleTime: 60 * 1000,
  })
  const spells = query.data?.items || []

  return (
    <div className="grid gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-3 sm:p-4">
      <button
        type="button"
        onClick={() => onPickerChange({ pickerOpen: !caster.pickerOpen })}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
            Biblioteca temporal
          </span>
          <span className="mt-1 block text-sm font-semibold text-ink">
            Añadir hechizo desde la lista general
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-ink-muted transition',
            caster.pickerOpen && 'rotate-180'
          )}
        />
      </button>

      {caster.pickerOpen ? (
        <>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,0.7fr)_minmax(0,0.7fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={caster.picker.q}
                onChange={(event) =>
                  onPickerChange({
                    picker: { ...caster.picker, q: event.target.value },
                  })
                }
                className="archive-input h-11 rounded-xl pl-10"
                placeholder="Buscar hechizo visible"
                type="search"
              />
            </div>
            <select
              value={caster.picker.level}
              onChange={(event) =>
                onPickerChange({
                  picker: { ...caster.picker, level: event.target.value },
                })
              }
              className="archive-input h-11 rounded-xl"
            >
              <option value="">Nivel</option>
              {SPELL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level === 0 ? 'Truco' : `N${level}`}
                </option>
              ))}
            </select>
            <select
              value={caster.picker.school}
              onChange={(event) =>
                onPickerChange({
                  picker: { ...caster.picker, school: event.target.value },
                })
              }
              className="archive-input h-11 rounded-xl"
            >
              <option value="">Escuela</option>
              {selectOptions(options?.escuelas).map((school) => (
                <option key={school} value={school}>
                  {school}
                </option>
              ))}
            </select>
            <select
              value={caster.picker.className}
              onChange={(event) =>
                onPickerChange({
                  picker: { ...caster.picker, className: event.target.value },
                })
              }
              className="archive-input h-11 rounded-xl"
            >
              <option value="">Clase</option>
              {selectOptions(options?.clases).map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </div>

          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
            {query.isFetching ? (
              <div className="rounded-xl bg-white px-4 py-5 text-sm text-ink-soft">
                Buscando hechizos visibles...
              </div>
            ) : spells.length ? (
              spells.map((spell) => {
                const alreadySelected = selectedSpellIds.has(spell.id)

                return (
                  <button
                    key={spell.id}
                    type="button"
                    onClick={() => onAddSpell(spell)}
                    disabled={alreadySelected}
                    className="grid gap-2 rounded-xl border border-stroke bg-white px-3 py-3 text-left transition hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">
                        {spell.nombre}
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-soft">
                        {levelLabel(spell.nivel)}
                        {spell.escuela ? ` · ${spell.escuela}` : ''}
                      </span>
                    </span>
                    <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-brand">
                      {alreadySelected ? 'Añadido' : 'Añadir'}
                    </span>
                  </button>
                )
              })
            ) : (
              <div className="rounded-xl border border-dashed border-stroke bg-white px-4 py-5 text-sm text-ink-soft">
                No hay hechizos visibles con esos filtros.
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function CasterCard({ caster, options, onUpdate, onRemove }) {
  const slotLevels = Object.keys(caster.slots)
    .map(Number)
    .filter((level) => Number.isInteger(level))
    .sort((left, right) => left - right)
  const slotColumnBreak = Math.ceil(slotLevels.length / 3)
  const slotColumns = [
    slotLevels.slice(0, slotColumnBreak),
    slotLevels.slice(slotColumnBreak, slotColumnBreak * 2),
    slotLevels.slice(slotColumnBreak * 2),
  ].filter((column) => column.length)
  const nextSlotLevel = SLOT_LEVELS.find(
    (level) => !Object.hasOwn(caster.slots, String(level))
  )
  const filteredSpells = useMemo(
    () =>
      caster.spells.filter((spell) =>
        spellMatchesFilters(spell, caster.filters)
      ),
    [caster.filters, caster.spells]
  )
  const groupedSpells = useMemo(
    () => groupSpells(filteredSpells, caster.filters.sort),
    [caster.filters.sort, filteredSpells]
  )
  const selectedSpellIds = useMemo(
    () => new Set(caster.spells.map((spell) => spell.id)),
    [caster.spells]
  )
  const classOptions = useMemo(() => {
    const classes = new Set(options?.clases || [])

    for (const spell of caster.spells) {
      for (const className of spell.clases || []) {
        classes.add(className)
      }
    }

    return [...classes].sort((left, right) =>
      String(left).localeCompare(String(right))
    )
  }, [caster.spells, options?.clases])
  const schoolOptions = useMemo(() => {
    const schools = new Set(options?.escuelas || [])

    for (const spell of caster.spells) {
      if (spell.escuela) {
        schools.add(spell.escuela)
      }
    }

    return [...schools].sort((left, right) =>
      String(left).localeCompare(String(right))
    )
  }, [caster.spells, options?.escuelas])

  function patchCaster(patch) {
    onUpdate(caster.id, (current) => normalizeCaster({ ...current, ...patch }))
  }

  function setSlot(level, updater) {
    const key = String(level)
    const currentSlot = caster.slots[key] || { max: 0, current: 0 }
    const nextSlot = updater(currentSlot)

    patchCaster({
      slots: {
        ...caster.slots,
        [key]: {
          max: Math.max(0, toInteger(nextSlot.max)),
          current: Math.min(
            Math.max(0, toInteger(nextSlot.current)),
            Math.max(0, toInteger(nextSlot.max))
          ),
        },
      },
    })
  }

  function removeSlot(level) {
    const nextSlots = { ...caster.slots }
    delete nextSlots[String(level)]
    patchCaster({ slots: nextSlots })
  }

  function addSpell(spell) {
    const normalized = normalizeSpell(
      {
        ...spell,
        source: 'temporary',
        addedAt: new Date().toISOString(),
      },
      'temporary'
    )

    if (!normalized || selectedSpellIds.has(normalized.id)) {
      return
    }

    const nextSlots = { ...caster.slots }

    if (normalized.nivel > 0 && !nextSlots[String(normalized.nivel)]) {
      nextSlots[String(normalized.nivel)] = { max: 0, current: 0 }
    }

    patchCaster({
      slots: nextSlots,
      spells: normalizeSpellList([...caster.spells, normalized], 'temporary'),
    })
  }

  function removeSpell(spellId) {
    patchCaster({
      spells: caster.spells.filter((spell) => spell.id !== spellId),
    })
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-stroke bg-white shadow-card">
      <div className="grid gap-4 border-b border-stroke bg-surface/70 p-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <CharacterAvatar
          item={caster}
          className="h-16 w-16"
          linkTo={
            caster.characterId ? `/app/personajes/${caster.characterId}` : null
          }
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="archive-chip">
              {caster.isManual ? 'Manual' : 'Personaje'}
            </span>
            {caster.campaignName ? (
              <span className="archive-chip">{caster.campaignName}</span>
            ) : null}
            <span className="archive-chip">
              {caster.spells.length} hechizos
            </span>
          </div>
          <input
            value={caster.name}
            onChange={(event) => patchCaster({ name: event.target.value })}
            className="mt-2 w-full rounded-xl border border-transparent bg-white px-3 py-2 font-display text-2xl font-bold text-ink outline-none transition focus:border-brand"
            placeholder={
              caster.isManual ? 'Nombre del lanzador' : 'Renombrar instancia'
            }
          />
          <p className="mt-1 truncate text-sm text-ink-soft">
            {caster.title || caster.baseName || 'Instancia temporal'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {caster.characterId ? (
            <Link
              to={`/app/personajes/${caster.characterId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-3 font-label text-[10px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand"
            >
              <ExternalLink className="h-4 w-4" />
              Ficha
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => patchCaster({ collapsed: !caster.collapsed })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-3 font-label text-[10px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand"
          >
            {caster.collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
            {caster.collapsed ? 'Abrir' : 'Plegar'}
          </button>
          <button
            type="button"
            onClick={() => onRemove(caster.id)}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-danger/30 bg-danger/10 px-3 text-danger transition hover:bg-danger hover:text-white"
            aria-label={`Quitar ${caster.name || caster.baseName}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {caster.collapsed ? null : (
        <div className="grid gap-5 p-4 sm:p-5">
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  Slots de conjuro
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold text-ink">
                  Recursos temporales
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    patchCaster({ maxUnlocked: !caster.maxUnlocked })
                  }
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.14em] transition',
                    caster.maxUnlocked
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-stroke bg-white text-ink-soft hover:border-brand hover:text-brand'
                  )}
                >
                  {caster.maxUnlocked ? (
                    <Unlock className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {caster.maxUnlocked ? 'Máximos libres' : 'Máximos bloqueados'}
                </button>
                {nextSlotLevel ? (
                  <button
                    type="button"
                    onClick={() =>
                      patchCaster({
                        slots: {
                          ...caster.slots,
                          [String(nextSlotLevel)]: { max: 0, current: 0 },
                        },
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand"
                  >
                    <Plus className="h-4 w-4" />
                    Añadir {slotLabel(nextSlotLevel)}
                  </button>
                ) : null}
              </div>
            </div>

            {slotLevels.length ? (
              <div className="grid gap-2 lg:grid-cols-3">
                {slotColumns.map((column, columnIndex) => (
                  <div
                    key={`slot-column-${columnIndex}`}
                    className="grid content-start gap-2"
                  >
                    {column.map((level) => (
                      <SlotControl
                        key={level}
                        level={level}
                        slot={caster.slots[String(level)]}
                        maxUnlocked={caster.maxUnlocked}
                        onCurrentChange={(value) =>
                          setSlot(level, (slot) => ({
                            ...slot,
                            current: Math.min(toInteger(value), slot.max),
                          }))
                        }
                        onMaxChange={(value) =>
                          setSlot(level, (slot) => {
                            const max = toInteger(value)

                            return {
                              max,
                              current: Math.min(slot.current, max),
                            }
                          })
                        }
                        onRemove={() => removeSlot(level)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stroke bg-surface px-4 py-5 text-sm leading-6 text-ink-soft">
                Este lanzador todavía no tiene slots. Añade niveles manualmente
                o incorpora hechizos para preparar la ficha temporal.
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <button
              type="button"
              onClick={() => patchCaster({ spellsOpen: !caster.spellsOpen })}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stroke bg-surface px-4 py-3 text-left"
            >
              <span>
                <span className="block font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  Hechizos
                </span>
                <span className="mt-1 block font-display text-2xl font-bold text-ink">
                  Lista del lanzador
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-ink-muted transition',
                  caster.spellsOpen && 'rotate-180'
                )}
              />
            </button>

            {caster.spellsOpen ? (
              <>
                <div className="grid gap-2 rounded-2xl border border-stroke bg-surface p-3 md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,0.75fr)_minmax(0,0.75fr)_10rem]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      value={caster.filters.q}
                      onChange={(event) =>
                        patchCaster({
                          filters: {
                            ...caster.filters,
                            q: event.target.value,
                          },
                        })
                      }
                      className="archive-input h-11 rounded-xl pl-10"
                      placeholder="Buscar en sus hechizos"
                      type="search"
                    />
                  </div>
                  <select
                    value={caster.filters.level}
                    onChange={(event) =>
                      patchCaster({
                        filters: {
                          ...caster.filters,
                          level: event.target.value,
                        },
                      })
                    }
                    className="archive-input h-11 rounded-xl"
                  >
                    <option value="">Nivel</option>
                    {SPELL_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level === 0 ? 'Truco' : `N${level}`}
                      </option>
                    ))}
                  </select>
                  <select
                    value={caster.filters.school}
                    onChange={(event) =>
                      patchCaster({
                        filters: {
                          ...caster.filters,
                          school: event.target.value,
                        },
                      })
                    }
                    className="archive-input h-11 rounded-xl"
                  >
                    <option value="">Escuela</option>
                    {schoolOptions.map((school) => (
                      <option key={school} value={school}>
                        {school}
                      </option>
                    ))}
                  </select>
                  <select
                    value={caster.filters.className}
                    onChange={(event) =>
                      patchCaster({
                        filters: {
                          ...caster.filters,
                          className: event.target.value,
                        },
                      })
                    }
                    className="archive-input h-11 rounded-xl"
                  >
                    <option value="">Clase</option>
                    {classOptions.map((className) => (
                      <option key={className} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                  <select
                    value={caster.filters.sort}
                    onChange={(event) =>
                      patchCaster({
                        filters: {
                          ...caster.filters,
                          sort: event.target.value,
                        },
                      })
                    }
                    className="archive-input h-11 rounded-xl"
                  >
                    <option value="level_asc">Niveles asc.</option>
                    <option value="level_desc">Niveles desc.</option>
                  </select>
                </div>

                {groupedSpells.length ? (
                  <div className="grid gap-4">
                    {groupedSpells.map(([level, spells]) => (
                      <div
                        key={level}
                        className="overflow-hidden rounded-2xl border border-stroke bg-surface/60"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            patchCaster({
                              openLevels: {
                                ...caster.openLevels,
                                [level]: caster.openLevels?.[level] === false,
                              },
                            })
                          }
                          className="flex w-full items-center justify-between gap-3 border-b border-stroke bg-white px-4 py-3 text-left"
                        >
                          <h4 className="font-display text-xl font-bold text-ink">
                            {levelLabel(level)}
                          </h4>
                          <span className="inline-flex items-center gap-2">
                            <span className="archive-chip">
                              {spells.length} hechizos
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 text-ink-muted transition',
                                caster.openLevels?.[level] !== false &&
                                  'rotate-180'
                              )}
                            />
                          </span>
                        </button>
                        {caster.openLevels?.[level] === false ? null : (
                          <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                            {spells.map((spell) => (
                              <SpellMiniCard
                                key={spell.id}
                                spell={spell}
                                onRemove={removeSpell}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-stroke bg-surface px-4 py-5 text-sm text-ink-soft">
                    No hay hechizos que coincidan con los filtros de este
                    lanzador.
                  </div>
                )}
              </>
            ) : null}
          </section>

          <SpellPicker
            caster={caster}
            options={options}
            selectedSpellIds={selectedSpellIds}
            onPickerChange={patchCaster}
            onAddSpell={addSpell}
          />
        </div>
      )}
    </article>
  )
}

export function SpellManagerPage() {
  const { user } = useAuth()
  const storageKey = getStorageKey(user?.id)
  const skipNextWriteRef = useRef(false)
  const [casters, setCasters] = useState(() => readStoredCasters(storageKey))
  const [searchOpen, setSearchOpen] = useState(true)
  const [characterQuery, setCharacterQuery] = useState('')
  const [addingCharacterId, setAddingCharacterId] = useState(null)
  const [characterError, setCharacterError] = useState('')
  const debouncedCharacterQuery = useDebouncedValue(characterQuery)

  useEffect(() => {
    skipNextWriteRef.current = true
    setCasters(readStoredCasters(storageKey))
  }, [storageKey])

  useEffect(() => {
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false
      return
    }

    writeStoredCasters(storageKey, casters)
  }, [casters, storageKey])

  const characterSearch = useQuery({
    queryKey: ['spell-manager', 'characters', debouncedCharacterQuery],
    queryFn: () => searchVisibleCharacters(debouncedCharacterQuery),
    enabled: debouncedCharacterQuery.trim().length >= 2,
    staleTime: 60 * 1000,
  })
  const optionsQuery = useQuery({
    queryKey: ['spell-options'],
    queryFn: fetchSpellOptions,
    staleTime: 10 * 60 * 1000,
  })
  const summary = useMemo(() => {
    let totalSpells = 0
    let spentSlots = 0
    let totalSlots = 0

    for (const caster of casters) {
      totalSpells += caster.spells.length

      for (const slot of Object.values(caster.slots || {})) {
        totalSlots += Number(slot.max || 0)
        spentSlots += Math.max(
          0,
          Number(slot.max || 0) - Number(slot.current || 0)
        )
      }
    }

    return {
      totalSpells,
      spentSlots,
      totalSlots,
    }
  }, [casters])
  const casterInstanceCounts = useMemo(() => {
    const counts = new Map()

    for (const caster of casters) {
      if (!caster.characterId) {
        continue
      }

      counts.set(caster.characterId, (counts.get(caster.characterId) || 0) + 1)
    }

    return counts
  }, [casters])

  function updateCaster(casterId, updater) {
    setCasters((current) =>
      current.map((caster) =>
        caster.id === casterId
          ? normalizeCaster(
              typeof updater === 'function' ? updater(caster) : updater
            )
          : caster
      )
    )
  }

  function removeCaster(casterId) {
    setCasters((current) => current.filter((caster) => caster.id !== casterId))
  }

  async function addCharacter(item) {
    if (item.modoVista === 'preview') {
      setCharacterError(
        'Ese personaje solo está en vista previa. El gestor de hechizos necesita visión completa.'
      )
      return
    }

    setAddingCharacterId(item.id)
    setCharacterError('')

    try {
      const character = await fetchCharacterDetail(item.id)

      if (character.modoVista === 'preview') {
        setCharacterError(
          'Ese personaje solo está en vista previa. El gestor de hechizos necesita visión completa.'
        )
        return
      }

      setCasters((current) => [
        createCasterFromCharacter(character),
        ...current,
      ])
    } catch {
      setCharacterError('No se pudo cargar la ficha completa del personaje.')
    } finally {
      setAddingCharacterId(null)
    }
  }

  function addManualCaster() {
    setCasters((current) => [createManualCaster(), ...current])
  }

  function setAllCollapsed(collapsed) {
    setCasters((current) =>
      current.map((caster) => normalizeCaster({ ...caster, collapsed }))
    )
  }

  function finishSession() {
    setCasters([])

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey)
    }
  }

  return (
    <section className="grid gap-6">
      <div className="overflow-hidden rounded-3xl border border-stroke bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              Herramientas de Juego
            </p>
            <h1 className="mt-2 flex flex-wrap items-center gap-3 font-display text-4xl font-bold tracking-[-0.06em] text-ink max-sm:text-3xl">
              <WandSparkles className="h-8 w-8 text-brand" />
              Gestor de Hechizos
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft">
              Mesa temporal para controlar slots y listas de hechizos durante
              una partida sin modificar las fichas originales.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center max-sm:w-full">
            <div className="rounded-2xl border border-stroke bg-surface px-3 py-3">
              <p className="font-display text-2xl font-bold text-ink">
                {casters.length}
              </p>
              <p className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
                Lanzadores
              </p>
            </div>
            <div className="rounded-2xl border border-stroke bg-surface px-3 py-3">
              <p className="font-display text-2xl font-bold text-ink">
                {summary.totalSpells}
              </p>
              <p className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
                Hechizos
              </p>
            </div>
            <div className="rounded-2xl border border-stroke bg-surface px-3 py-3">
              <p className="font-display text-2xl font-bold text-ink">
                {summary.spentSlots}/{summary.totalSlots}
              </p>
              <p className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
                Gastados
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={finishSession}
            disabled={!casters.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" />
            Finalizar
          </button>
        </div>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <CharacterSearchPanel
            isOpen={searchOpen}
            onToggle={() => setSearchOpen((current) => !current)}
            query={characterQuery}
            onQueryChange={(value) => {
              setCharacterQuery(value)
              setCharacterError('')
            }}
            results={characterSearch.data || []}
            isLoading={characterSearch.isFetching}
            error={characterError}
            addingCharacterId={addingCharacterId}
            addedCounts={casterInstanceCounts}
            onAddCharacter={addCharacter}
          />
          <ManualCasterPanel onAddManualCaster={addManualCaster} />
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-ink-muted">
                Mesa actual
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-soft">
                Los cambios se guardan localmente por usuario y no alteran
                personajes ni hechizos reales.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAllCollapsed(true)}
                disabled={!casters.length}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-45"
              >
                <ChevronUp className="h-4 w-4" />
                Plegar todos
              </button>
              <button
                type="button"
                onClick={() => setAllCollapsed(false)}
                disabled={!casters.length}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-45"
              >
                <ChevronDown className="h-4 w-4" />
                Desplegar todos
              </button>
            </div>
          </div>

          {casters.length ? (
            casters.map((caster) => (
              <CasterCard
                key={caster.id}
                caster={caster}
                options={optionsQuery.data || {}}
                onUpdate={updateCaster}
                onRemove={removeCaster}
              />
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-stroke bg-white px-6 py-12 text-center shadow-card">
              <BookOpen className="mx-auto h-10 w-10 text-brand" />
              <h2 className="mt-4 font-display text-3xl font-bold text-ink">
                No hay lanzadores en la mesa
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-ink-soft">
                Añade personajes con visión completa o crea una entrada manual
                para empezar a controlar slots y hechizos temporales.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
