/* eslint-disable react-hooks/set-state-in-effect */
import { createElement, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronDown,
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
  Pencil,
  Plus,
  Save,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Users,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
import { cn } from '../lib/cn'
import { recordRecentActivity } from '../services/recent-activity'
import {
  createSavedTraitsBulk,
  removeSavedTraitsSource,
} from '../services/saved-traits'
import {
  CharacterSheetHeader,
  CreatorBadge,
  ScrollTopButton,
} from './character-detail/components'
import {
  createClass,
  deleteClass,
  fetchClassDetail,
  fetchClassOptions,
  fetchSubclassDetail,
  updateClass,
} from './classes/api'

const CLASS_TABS = [
  { id: 'informacion', label: 'Información' },
  { id: 'subclases', label: 'Subclases' },
]
const DRAFT_PREFIX = 'wikicodex:class-editor:draft'
const RELOAD_PREFIX = 'wikicodex:class-editor:reload'
const ICON_OPTIONS = [
  ['GraduationCap', 'Clase'],
  ['Cog', 'Artificer'],
  ['Droplets', 'Barbarian'],
  ['Music', 'Bard'],
  ['CirclePlus', 'Cleric'],
  ['Leaf', 'Druid'],
  ['Gavel', 'Fighter'],
  ['Orbit', 'Monk'],
  ['Shield', 'Paladin'],
  ['PawPrint', 'Ranger'],
  ['Eye', 'Rogue'],
  ['Zap', 'Sorcerer'],
  ['Sun', 'Warlock'],
  ['WandSparkles', 'Wizard'],
  ['Sparkles', 'Mystic'],
  ['Users', 'Sidekick'],
  ['BookOpen', 'Manual'],
]
const ICON_MAP = {
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
const EMPTY_DRAFT = {
  nombre: '',
  idiomaCodigo: 'es',
  fuente: 'wikicodex',
  edicion: 'wikicodex',
  categoriaCatalogo: 'wikicodex',
  resumen: '',
  descripcion: '',
  icono: 'GraduationCap',
  dadoGolpeCaras: '',
  salvaciones: [],
  competencias: {},
  equipoInicial: [],
  tabla: [],
  rasgos: [],
  datosFuente: {},
  campanaIds: [],
  subclases: [],
}

function getDraftKey(classId) {
  return `${DRAFT_PREFIX}:${classId || 'new'}`
}

function getReloadKey(classId) {
  return `${RELOAD_PREFIX}:${classId || 'new'}`
}

function readStoredDraft(classId) {
  try {
    const raw = window.localStorage.getItem(getDraftKey(classId))
    return raw ? JSON.parse(raw)?.draft || null : null
  } catch {
    window.localStorage.removeItem(getDraftKey(classId))
    return null
  }
}

function persistDraft(classId, draft) {
  window.localStorage.setItem(
    getDraftKey(classId),
    JSON.stringify({ classId: classId || 'new', draft })
  )
}

function clearDraft(classId) {
  window.localStorage.removeItem(getDraftKey(classId))
  window.localStorage.removeItem(getReloadKey(classId))
}

function markReload(classId) {
  window.localStorage.setItem(getReloadKey(classId), '1')
}

function consumeReload(classId) {
  const key = getReloadKey(classId)
  const value = window.localStorage.getItem(key) === '1'
  window.localStorage.removeItem(key)
  return value
}

function cloneDraft(value = {}) {
  return JSON.parse(
    JSON.stringify({
      ...EMPTY_DRAFT,
      ...value,
      salvaciones: Array.isArray(value.salvaciones) ? value.salvaciones : [],
      equipoInicial: Array.isArray(value.equipoInicial)
        ? value.equipoInicial
        : [],
      tabla: Array.isArray(value.tabla) ? value.tabla : [],
      rasgos: Array.isArray(value.rasgos) ? value.rasgos : [],
      campanaIds: Array.isArray(value.campanaIds) ? value.campanaIds : [],
      subclases: Array.isArray(value.subclases) ? value.subclases : [],
      competencias:
        value.competencias && typeof value.competencias === 'object'
          ? value.competencias
          : {},
      datosFuente:
        value.datosFuente && typeof value.datosFuente === 'object'
          ? value.datosFuente
          : {},
    })
  )
}

function toDraft(item) {
  if (!item) {
    return cloneDraft()
  }

  return cloneDraft({
    nombre: item.nombre || '',
    idiomaCodigo: item.idiomaCodigo || 'en',
    fuente: item.fuente || 'wikicodex',
    edicion: item.edicion || 'wikicodex',
    categoriaCatalogo: item.categoriaCatalogo || item.edicion || 'wikicodex',
    resumen: item.resumen || '',
    descripcion: item.descripcion || '',
    icono: item.icono || 'GraduationCap',
    dadoGolpeCaras: item.dadoGolpeCaras || '',
    salvaciones: item.salvaciones || [],
    competencias: item.competencias || {},
    equipoInicial: item.equipoInicial || [],
    tabla: item.tabla || [],
    rasgos: item.rasgos || [],
    datosFuente: item.datosFuente || {},
    campanaIds: (item.campanas || []).map((campaign) => campaign.id),
    subclases: item.subclases || [],
  })
}

function sanitizeFeatureForPayload(feature = {}) {
  const next = { ...feature }
  const savable =
    feature.rasgoGuardable &&
    typeof feature.rasgoGuardable === 'object' &&
    !Array.isArray(feature.rasgoGuardable)
      ? {
          nombre: String(feature.rasgoGuardable.nombre || '').trim(),
          descripcion: String(feature.rasgoGuardable.descripcion || '').trim(),
          tipoRasgoId: feature.rasgoGuardable.tipoRasgoId || '',
        }
      : null

  if (savable?.nombre && savable.descripcion && savable.tipoRasgoId) {
    next.rasgoGuardable = savable
  } else {
    delete next.rasgoGuardable
  }

  return next
}

function sanitizeSubclassForPayload(subclass = {}) {
  return {
    ...(subclass.id ? { id: subclass.id } : {}),
    nombre: String(subclass.nombre || '').trim(),
    slug: subclass.slug || null,
    fuente: subclass.fuente || null,
    descripcion: subclass.descripcion || null,
    resumen: subclass.resumen || null,
    rasgos: Array.isArray(subclass.rasgos)
      ? subclass.rasgos.map(sanitizeFeatureForPayload)
      : [],
    datosFuente:
      subclass.datosFuente && typeof subclass.datosFuente === 'object'
        ? subclass.datosFuente
        : {},
  }
}

function buildPayload(draft) {
  return {
    nombre: draft.nombre.trim(),
    idiomaCodigo: draft.idiomaCodigo || 'en',
    fuente: draft.fuente?.trim() || 'wikicodex',
    edicion: draft.edicion?.trim() || 'wikicodex',
    categoriaCatalogo: draft.categoriaCatalogo || draft.edicion || 'wikicodex',
    resumen: draft.resumen?.trim() || null,
    descripcion: draft.descripcion?.trim() || null,
    icono: draft.icono || 'GraduationCap',
    dadoGolpeCaras: draft.dadoGolpeCaras ? Number(draft.dadoGolpeCaras) : null,
    salvaciones: draft.salvaciones || [],
    competencias: draft.competencias || {},
    equipoInicial: draft.equipoInicial || [],
    tabla: draft.tabla || [],
    rasgos: (draft.rasgos || []).map(sanitizeFeatureForPayload),
    datosFuente: draft.datosFuente || {},
    campanaIds: draft.campanaIds || [],
    subclases: (draft.subclases || [])
      .map(sanitizeSubclassForPayload)
      .filter((subclass) => subclass.nombre),
  }
}

function getClassIcon(iconName) {
  return ICON_MAP[iconName] || GraduationCap
}

function groupFeatures(features = []) {
  const groups = new Map()

  for (const feature of features) {
    const key = Number(feature.nivel || 0)

    if (!groups.has(key)) {
      groups.set(key, [])
    }

    groups.get(key).push(feature)
  }

  return [...groups.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([level, entries]) => ({
      level,
      entries: entries.sort((left, right) =>
        String(left.nombre || '').localeCompare(String(right.nombre || ''))
      ),
    }))
}

function featureAnchor(feature, index = 0) {
  return `rasgo-${Number(feature.nivel || 0)}-${String(feature.nombre || index)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`
}

function getSavableFeature(feature = {}) {
  const configured =
    feature.rasgoGuardable &&
    typeof feature.rasgoGuardable === 'object' &&
    !Array.isArray(feature.rasgoGuardable)
      ? feature.rasgoGuardable
      : {}

  return {
    nombre: configured.nombre || '',
    descripcion: configured.descripcion || '',
    tipoRasgoId: configured.tipoRasgoId || '',
  }
}

function buildFeatureTraitPayload(feature, sourceContext, index = 0) {
  const savable = getSavableFeature(feature)

  if (
    !savable.nombre?.trim() ||
    !savable.descripcion?.trim() ||
    !savable.tipoRasgoId
  ) {
    return null
  }

  return {
    tipoRasgoId: savable.tipoRasgoId,
    nombre: savable.nombre.trim(),
    descripcion: savable.descripcion.trim(),
    origenTipo: sourceContext.sourceType,
    origenEntidadId: sourceContext.entityId,
    origenEntidadNombre: sourceContext.entityName,
    origenGrupoId: sourceContext.groupId,
    origenRasgoClave:
      feature.id ||
      feature.slug ||
      featureAnchor(feature, index) ||
      `${sourceContext.groupId}:${index}`,
    origenRasgoNombre: feature.nombre || savable.nombre,
    origenDatos: {
      nivel: Number(feature.nivel || 0),
      claseId: sourceContext.classId || null,
      subclaseId: sourceContext.subclassId || null,
    },
  }
}

function cleanTableText(value) {
  return String(value || '')
    .replace(/\{@([^}]+)\}/g, (_match, content) => {
      const parts = String(content || '').split('|')
      const first = parts[0] || ''
      const fallback = first.replace(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_:-]+\s+/, '')

      return parts[2]?.includes('=') ? fallback : parts[2] || fallback || first
    })
    .replace(/\{=([^}]+)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatCell(value) {
  if (value === null || value === undefined || value === '' || value === 0) {
    return '—'
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return cleanTableText(value)
  }

  if (value.type === 'bonus') {
    return `${value.value >= 0 ? '+' : ''}${value.value}`
  }

  if (value.roll) {
    return String(value.roll.exact || value.roll.min || '—')
  }

  if (value.toRoll || value.displayText) {
    return cleanTableText(value.displayText || value.toRoll)
  }

  return String(value.value || value.name || '—')
}

function proficiencyBonus(level) {
  return `+${Math.ceil(Number(level || 1) / 4) + 1}`
}

function buildProgressionGroups(item) {
  const groups = Array.isArray(item?.tabla) ? item.tabla : []

  return groups
    .map((group, groupIndex) => ({
      key: `${groupIndex}-${group.titulo || 'grupo'}`,
      title: cleanTableText(group.titulo || 'Recursos'),
      columns: (group.etiquetas || []).map((label, labelIndex) => ({
        key: `${groupIndex}-${labelIndex}-${label}`,
        label: cleanTableText(label),
        getValue: (level) =>
          formatCell((group.filas?.[level - 1] || [])[labelIndex]),
      })),
    }))
    .filter((group) => group.columns.length)
}

function ClassProgressionTable({ item }) {
  const groups = buildProgressionGroups(item)
  const columns = groups.flatMap((group) => group.columns)
  const featuresByLevel = useMemo(() => {
    const map = new Map()

    for (const feature of item?.rasgos || []) {
      const level = Number(feature.nivel || 0)

      if (!map.has(level)) {
        map.set(level, [])
      }

      map.get(level).push(feature)
    }

    return map
  }, [item])

  return (
    <div className="overflow-hidden rounded-xl border border-stroke bg-[#1f1f1f] text-slate-100 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <caption className="px-3 py-2 text-left font-headline text-lg font-semibold text-white">
            {item?.nombre || 'Clase'}
          </caption>
          <thead>
            <tr className="border-y border-white/15 text-[11px] text-sky-300">
              <th className="px-2 py-2" rowSpan={columns.length ? 2 : 1}>
                Nivel
              </th>
              <th className="px-2 py-2" rowSpan={columns.length ? 2 : 1}>
                Bonif. comp.
              </th>
              <th
                className="min-w-56 px-2 py-2"
                rowSpan={columns.length ? 2 : 1}
              >
                Rasgos
              </th>
              {groups.map((group) => (
                <th
                  key={group.key}
                  className="border-l border-white/10 px-2 py-2 text-center"
                  colSpan={group.columns.length}
                >
                  {group.title}
                </th>
              ))}
            </tr>
            {columns.length ? (
              <tr className="border-b border-white/15 text-[11px] text-sky-300">
                {groups.flatMap((group) =>
                  group.columns.map((column) => (
                    <th key={column.key} className="px-2 py-2">
                      {column.label}
                    </th>
                  ))
                )}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {Array.from({ length: 20 }, (_item, index) => {
              const level = index + 1
              const features = featuresByLevel.get(level) || []

              return (
                <tr
                  key={level}
                  className={cn(
                    'border-b border-white/5',
                    level % 2 ? 'bg-white/5' : 'bg-transparent'
                  )}
                >
                  <td className="whitespace-nowrap px-2 py-1.5">{level}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    {proficiencyBonus(level)}
                  </td>
                  <td className="px-2 py-1.5">
                    {features.length ? (
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {features.map((feature, featureIndex) => (
                          <a
                            key={`${feature.nombre}-${featureIndex}`}
                            href={`#${featureAnchor(feature, featureIndex)}`}
                            className="font-semibold text-sky-300 underline decoration-sky-300/25 underline-offset-4 hover:text-sky-200"
                          >
                            {feature.nombre}
                          </a>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="whitespace-nowrap px-2 py-1.5"
                    >
                      {column.getValue(level)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CollapsibleTextSection({ title = 'Descripción', text, emptyText }) {
  const [open, setOpen] = useState(true)

  return (
    <section className="overflow-hidden rounded-2xl border border-stroke bg-surface-strong/45 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-brand/5"
      >
        <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-ink-muted transition-transform',
            open ? 'rotate-180' : ''
          )}
        />
      </button>
      {open ? (
        <div className="theme-sheet-copy border-t border-stroke/60 px-6 py-5 text-sm leading-8 text-ink-soft">
          <WikiText text={text || emptyText || 'Sin descripción.'} />
        </div>
      ) : null}
    </section>
  )
}

function FeatureList({
  features,
  emptyText = 'No hay rasgos registrados.',
  sourceContext,
  onSaveFeature,
  savePending = false,
}) {
  const groups = groupFeatures(features)

  if (!groups.length) {
    return (
      <p className="rounded-2xl border border-dashed border-stroke bg-white px-5 py-4 text-sm text-ink-soft">
        {emptyText}
      </p>
    )
  }

  return (
    <div className="grid gap-5">
      {groups.map((group) => (
        <section key={group.level} className="grid gap-3">
          <h2 className="border-b border-stroke pb-2 font-headline text-xl font-black text-ink">
            {group.level ? `Nivel ${group.level}` : 'General'}
          </h2>
          <div className="grid gap-3">
            {group.entries.map((feature, index) => {
              const savableFeature = getSavableFeature(feature)

              return (
                <article
                  id={featureAnchor(feature, index)}
                  key={`${feature.nombre}-${feature.nivel}-${index}`}
                  className="theme-sheet-soft scroll-mt-24 overflow-hidden rounded-xl border border-stroke"
                >
                  <header className="border-b border-stroke bg-surface-strong/70 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-headline text-base font-black text-ink">
                        {feature.nombre}
                      </h3>
                    </div>
                  </header>
                  {feature.descripcion ? (
                    <div className="theme-sheet-copy px-4 py-4 text-sm leading-7 text-ink-soft">
                      <WikiText text={feature.descripcion} />
                    </div>
                  ) : null}
                  <details className="group border-t border-stroke/60 bg-surface-strong/30">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left marker:hidden transition hover:bg-brand/5">
                      <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                        Rasgo guardable
                      </span>
                      <ChevronDown className="h-4 w-4 text-ink-muted transition group-open:rotate-180" />
                    </summary>
                    <div className="grid gap-3 px-4 pb-4">
                      {savableFeature.descripcion ? (
                        <div className="theme-sheet-card rounded-lg border px-3 py-3">
                          <p className="text-sm font-bold text-ink">
                            {savableFeature.nombre}
                          </p>
                          <div className="theme-sheet-copy mt-2 text-xs leading-6 text-ink-soft">
                            <WikiText text={savableFeature.descripcion} />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs leading-5 text-ink-muted">
                          Este rasgo todavia no tiene version guardable.
                        </p>
                      )}
                      {sourceContext && onSaveFeature ? (
                        <button
                          type="button"
                          onClick={() => onSaveFeature(feature, index)}
                          disabled={
                            savePending ||
                            !savableFeature.nombre?.trim() ||
                            !savableFeature.descripcion?.trim() ||
                            !savableFeature.tipoRasgoId
                          }
                          className="w-fit rounded-md border border-brand/30 bg-brand/10 px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-brand transition hover:border-brand hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Guardar en boveda
                        </button>
                      ) : null}
                    </div>
                  </details>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function FeatureEditor({ label, features, onChange, traitTypes = [] }) {
  function updateFeature(index, patch) {
    onChange(
      features.map((feature, featureIndex) =>
        featureIndex === index ? { ...feature, ...patch } : feature
      )
    )
  }

  function addFeature() {
    onChange([...(features || []), { nombre: '', nivel: 1, descripcion: '' }])
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
          {label}
        </h2>
        <button
          type="button"
          onClick={addFeature}
          className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir rasgo
        </button>
      </div>

      {(features || []).length ? (
        <div className="grid gap-3">
          {features.map((feature, index) => (
            <article
              key={feature.id || index}
              className="rounded-2xl border border-stroke bg-white p-4 shadow-sm"
            >
              <div className="grid gap-3 lg:grid-cols-[7rem_minmax(0,1fr)_auto]">
                <label className="block">
                  <span className="sr-only">Nivel</span>
                  <input
                    type="number"
                    min="0"
                    value={feature.nivel || 0}
                    onChange={(event) =>
                      updateFeature(index, {
                        nivel: Number(event.target.value) || 0,
                      })
                    }
                    className="archive-input rounded-xl"
                    placeholder="Nivel"
                  />
                </label>
                <input
                  value={feature.nombre || ''}
                  onChange={(event) =>
                    updateFeature(index, { nombre: event.target.value })
                  }
                  className="archive-input rounded-xl font-semibold"
                  placeholder="Nombre del rasgo"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      features.filter((_item, itemIndex) => itemIndex !== index)
                    )
                  }
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <WikiTextArea
                value={feature.descripcion || ''}
                onChange={(event) =>
                  updateFeature(index, { descripcion: event.target.value })
                }
                rows={5}
                className="mt-3 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-brand"
                placeholder="Descripción del rasgo"
              />
              <details className="mt-3 rounded-xl border border-stroke/70 bg-surface-strong/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 marker:hidden">
                  <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                    Rasgo guardable
                  </span>
                  <ChevronDown className="h-4 w-4 text-ink-muted" />
                </summary>
                <div className="grid gap-3 border-t border-stroke/60 px-3 py-3">
                  <select
                    value={feature.rasgoGuardable?.tipoRasgoId || ''}
                    onChange={(event) =>
                      updateFeature(index, {
                        rasgoGuardable: {
                          ...(feature.rasgoGuardable || {}),
                          tipoRasgoId: event.target.value,
                        },
                      })
                    }
                    className="archive-input rounded-xl"
                  >
                    <option value="">Tipo de rasgo guardable</option>
                    {traitTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    value={feature.rasgoGuardable?.nombre || ''}
                    onChange={(event) =>
                      updateFeature(index, {
                        rasgoGuardable: {
                          ...(feature.rasgoGuardable || {}),
                          nombre: event.target.value,
                        },
                      })
                    }
                    className="archive-input rounded-xl"
                    placeholder="Nombre reutilizable"
                  />
                  <WikiTextArea
                    value={feature.rasgoGuardable?.descripcion || ''}
                    onChange={(event) =>
                      updateFeature(index, {
                        rasgoGuardable: {
                          ...(feature.rasgoGuardable || {}),
                          descripcion: event.target.value,
                        },
                      })
                    }
                    rows={4}
                    className="w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-brand"
                    placeholder="Version reducida para guardar en fichas"
                  />
                </div>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stroke bg-white px-4 py-4 text-sm text-ink-soft">
          Todavía no hay rasgos.
        </p>
      )}
    </section>
  )
}

function SubclassSummaryTable({ subclass }) {
  const groups = groupFeatures(subclass?.rasgos || [])

  if (!groups.length) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stroke bg-[#1f1f1f] text-slate-100 shadow-sm">
      <table className="min-w-full text-left text-xs">
        <caption className="px-3 py-2 text-left font-headline text-lg font-semibold text-white">
          {subclass.nombre}
        </caption>
        <thead>
          <tr className="border-y border-white/15 text-[11px] text-sky-300">
            <th className="w-24 px-3 py-2">Nivel</th>
            <th className="px-3 py-2">Rasgos obtenidos</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr
              key={group.level}
              className="border-b border-white/5 odd:bg-white/5"
            >
              <td className="px-3 py-2">{group.level || 'General'}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  {group.entries.map((feature, index) => (
                    <a
                      key={`${feature.nombre}-${index}`}
                      href={`#${featureAnchor(feature, index)}`}
                      className="font-semibold text-sky-300 underline decoration-sky-300/25 underline-offset-4 hover:text-sky-200"
                    >
                      {feature.nombre}
                    </a>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SystemCreatorBadge() {
  return (
    <div className="rounded-2xl border border-stroke bg-white p-4 shadow-sm">
      <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
        Creado por
      </p>
      <p className="mt-2 text-sm font-black text-ink">Sistema</p>
    </div>
  )
}

export function ClassDetailPage({ createMode = false, startEditing = false }) {
  const { classId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const storageId = createMode ? 'new' : classId
  const shouldResumeAfterReload = useMemo(
    () => consumeReload(storageId),
    [storageId]
  )
  const [activeTab, setActiveTab] = useState('informacion')
  const [draft, setDraft] = useState(null)
  const [isEditing, setIsEditing] = useState(createMode || startEditing)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedTraitMessage, setSavedTraitMessage] = useState('')

  const classQuery = useQuery({
    queryKey: ['class-detail', classId],
    queryFn: () => fetchClassDetail(classId),
    enabled: Boolean(!createMode && classId),
    staleTime: 60 * 1000,
  })
  const optionsQuery = useQuery({
    queryKey: ['class-options'],
    queryFn: fetchClassOptions,
    staleTime: 60 * 1000,
  })

  const item = createMode ? null : classQuery.data
  const viewItem = isEditing ? draft : item
  const Icon = getClassIcon(viewItem?.icono)
  const canEdit = createMode || item?.puedeEditar
  const classFeatureSource = item
    ? {
        sourceType: 'clase',
        entityId: item.id,
        entityName: item.nombre,
        groupId: `clase:${item.id}:base`,
        classId: item.id,
      }
    : null

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 500)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    function handleBeforeUnload() {
      if (isEditing) {
        markReload(storageId)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isEditing, storageId])

  useEffect(() => {
    if (createMode) {
      const stored = readStoredDraft(storageId)
      setDraft(stored ? cloneDraft(stored) : cloneDraft())
      setIsEditing(true)
      return
    }

    if (!item) {
      return
    }

    const stored = readStoredDraft(storageId)

    if (stored && (shouldResumeAfterReload || startEditing)) {
      setDraft(cloneDraft(stored))
      setIsEditing(true)
      return
    }

    setDraft(toDraft(item))
    setIsEditing(startEditing)
  }, [createMode, item, shouldResumeAfterReload, startEditing, storageId])

  useEffect(() => {
    if (!item?.id || createMode) {
      return
    }

    recordRecentActivity({
      entityType: 'class',
      entityId: item.id,
      nombre: item.nombre,
      subtitulo: 'Clase',
      urlDestino: `/app/clases/${item.id}`,
    })
  }, [createMode, item?.id, item?.nombre])

  function updateDraft(patch) {
    setDraft((current) => {
      const next = cloneDraft({ ...(current || EMPTY_DRAFT), ...patch })
      persistDraft(storageId, next)
      return next
    })
  }

  function updateSubclass(index, patch) {
    updateDraft({
      subclases: draft.subclases.map((subclass, subclassIndex) =>
        subclassIndex === index ? { ...subclass, ...patch } : subclass
      ),
    })
  }

  function addSubclass() {
    updateDraft({
      subclases: [
        ...(draft.subclases || []),
        {
          nombre: '',
          fuente: draft.fuente || 'wikicodex',
          descripcion: '',
          resumen: '',
          rasgos: [],
          datosFuente: {},
        },
      ],
    })
    setActiveTab('subclases')
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      createMode
        ? createClass(buildPayload(draft))
        : updateClass(classId, buildPayload(draft)),
    onSuccess: (saved) => {
      clearDraft(storageId)
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['class-detail', saved.id] })
      setSaveError('')

      if (createMode) {
        navigate(`/app/clases/${saved.id}`, { replace: true })
      } else {
        setDraft(toDraft(saved))
        setIsEditing(false)
      }
    },
    onError: (error) => setSaveError(error.message),
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteClass(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      navigate('/app/clases/listado', { replace: true })
    },
  })

  const saveTraitsMutation = useMutation({
    mutationFn: (traits) => createSavedTraitsBulk(traits),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      setSavedTraitMessage(
        result.created
          ? `Rasgos guardados: ${result.created}.`
          : 'Ya tenias guardados esos rasgos.'
      )
    },
    onError: (error) => setSavedTraitMessage(error.message),
  })
  const removeTraitsMutation = useMutation({
    mutationFn: (payload) => removeSavedTraitsSource(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      setSavedTraitMessage(
        result.removed
          ? `Rasgos quitados de la boveda: ${result.removed}.`
          : 'No habia rasgos guardados de esta fuente.'
      )
    },
    onError: (error) => setSavedTraitMessage(error.message),
  })

  function saveFeatureTrait(feature, index = 0, sourceContext) {
    if (!sourceContext) {
      return
    }

    setSavedTraitMessage('')
    const payload = buildFeatureTraitPayload(feature, sourceContext, index)

    if (payload) {
      saveTraitsMutation.mutate([payload])
    }
  }

  function saveAllFeatureTraits(features, sourceContext) {
    if (!sourceContext) {
      return
    }

    setSavedTraitMessage('')
    const payloads = (features || [])
      .map((feature, index) =>
        buildFeatureTraitPayload(feature, sourceContext, index)
      )
      .filter(Boolean)

    if (!payloads.length) {
      setSavedTraitMessage('No hay rasgos guardables en esta fuente.')
      return
    }

    saveTraitsMutation.mutate(payloads)
  }

  function removeFeatureTraits(sourceContext) {
    if (!sourceContext) {
      return
    }

    setSavedTraitMessage('')
    removeTraitsMutation.mutate({
      origenTipo: sourceContext.sourceType,
      origenEntidadId: sourceContext.entityId,
      origenGrupoId: sourceContext.groupId,
    })
  }

  function handleBack() {
    if (location.state?.returnTo?.pathname === '/app/clases/listado') {
      navigate(
        {
          pathname: location.state.returnTo.pathname,
          search: location.state.returnTo.search || '',
        },
        { replace: true }
      )
      return
    }

    navigate('/app/clases/listado')
  }

  function startEdit() {
    setDraft(toDraft(item))
    persistDraft(storageId, toDraft(item))
    setIsEditing(true)
  }

  function cancelEdit() {
    clearDraft(storageId)

    if (createMode) {
      navigate('/app/clases/listado')
      return
    }

    setDraft(toDraft(item))
    setIsEditing(false)
  }

  if ((classQuery.isLoading && !createMode) || !viewItem) {
    return (
      <section className="rounded-3xl border border-stroke bg-white p-8 text-center text-sm font-semibold text-ink-soft shadow-card">
        Cargando clase...
      </section>
    )
  }

  return (
    <section className="grid gap-6">
      <article className="theme-sheet-shell overflow-hidden shadow-card">
        <CharacterSheetHeader
          tabs={CLASS_TABS}
          activeTab={activeTab}
          characterName={viewItem.nombre || 'Nueva clase'}
          onTabChange={({ tab }) => setActiveTab(tab)}
          onBack={handleBack}
        />

        <div className="p-5 sm:p-7 lg:p-9">
          <div className="theme-sheet-rule grid gap-6 border-b pb-8 lg:grid-cols-[12rem_minmax(0,1fr)_auto] lg:items-start">
            <div className="theme-brand-gradient flex h-44 w-full items-center justify-center rounded-2xl border border-brand/30 bg-ink text-brand lg:h-48">
              {createElement(Icon, { className: 'h-20 w-20' })}
            </div>

            <div className="min-w-0">
              {isEditing ? (
                <div className="grid gap-4">
                  <input
                    value={draft.nombre}
                    onChange={(event) =>
                      updateDraft({ nombre: event.target.value })
                    }
                    className="w-full rounded-xl border border-stroke bg-white px-4 py-3 font-display text-3xl font-black tracking-[-0.04em] text-ink outline-none transition focus:border-brand"
                    placeholder="Nombre de la clase"
                  />
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <select
                      value={draft.idiomaCodigo}
                      onChange={(event) =>
                        updateDraft({ idiomaCodigo: event.target.value })
                      }
                      className="archive-input rounded-xl"
                    >
                      <option value="en">Inglés</option>
                      <option value="es">Español</option>
                    </select>
                    <select
                      value={draft.fuente}
                      onChange={(event) =>
                        updateDraft({ fuente: event.target.value })
                      }
                      className="archive-input rounded-xl"
                    >
                      {(
                        optionsQuery.data?.fuentes || [
                          { codigo: 'wikicodex', nombre: 'wikicodex' },
                        ]
                      ).map((source) => (
                        <option key={source.codigo} value={source.codigo}>
                          {source.nombre}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.edicion}
                      onChange={(event) =>
                        updateDraft({
                          edicion: event.target.value,
                          categoriaCatalogo: event.target.value,
                        })
                      }
                      className="archive-input rounded-xl"
                    >
                      <option value="classic">Clásico</option>
                      <option value="one">D&D One</option>
                      <option value="misc">Miscelánea</option>
                      <option value="wikicodex">WikiCodex</option>
                    </select>
                    <select
                      value={draft.icono}
                      onChange={(event) =>
                        updateDraft({ icono: event.target.value })
                      }
                      className="archive-input rounded-xl"
                    >
                      {ICON_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <span className="archive-chip">
                      {viewItem.idiomaCodigo === 'es' ? 'Español' : 'Inglés'}
                    </span>
                    {viewItem.fuente ? (
                      <span className="archive-chip">{viewItem.fuente}</span>
                    ) : null}
                    {viewItem.edicion ? (
                      <span className="archive-chip">{viewItem.edicion}</span>
                    ) : null}
                    <span className="archive-chip">Pública</span>
                  </div>
                  <h1 className="mt-3 break-words font-display text-4xl font-black tracking-[-0.05em] text-ink [overflow-wrap:anywhere] sm:text-5xl">
                    {viewItem.nombre}
                  </h1>
                  {viewItem.resumen ? (
                    <div className="theme-sheet-copy mt-4 max-w-4xl text-sm italic leading-7 text-ink-soft">
                      <WikiText text={viewItem.resumen} />
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {canEdit && !isEditing ? (
                <button
                  type="button"
                  onClick={startEdit}
                  className="theme-solid-button inline-flex items-center gap-2 rounded-md px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
              ) : null}
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveMutation.mutate()}
                    disabled={!draft.nombre.trim() || saveMutation.isPending}
                    className="theme-solid-button inline-flex items-center gap-2 rounded-md px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {createMode ? 'Crear' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
                  >
                    <X className="h-4 w-4" />
                    {createMode ? 'Descartar' : 'Cancelar'}
                  </button>
                </>
              ) : null}
              {item?.puedeBorrar && !isEditing ? (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-red-700 transition hover:border-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                  Borrar
                </button>
              ) : null}
            </div>
          </div>

          {saveError ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          ) : null}

          {activeTab === 'informacion' ? (
            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="grid gap-6">
                {isEditing ? (
                  <>
                    <label className="block">
                      <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
                        Resumen
                      </span>
                      <textarea
                        value={draft.resumen}
                        onChange={(event) =>
                          updateDraft({ resumen: event.target.value })
                        }
                        rows={3}
                        className="mt-2 w-full rounded-xl border border-stroke bg-white px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-brand"
                      />
                    </label>
                    <label className="block">
                      <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
                        Descripción
                      </span>
                      <WikiTextArea
                        value={draft.descripcion}
                        onChange={(event) =>
                          updateDraft({ descripcion: event.target.value })
                        }
                        rows={12}
                        className="mt-2 w-full rounded-xl border border-stroke bg-white px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-brand"
                      />
                    </label>
                    <FeatureEditor
                      label="Rasgos de clase"
                      features={draft.rasgos || []}
                      onChange={(rasgos) => updateDraft({ rasgos })}
                      traitTypes={optionsQuery.data?.tiposRasgo || []}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-white px-4 py-3 shadow-sm">
                      <div>
                        <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                          Boveda de rasgos
                        </p>
                        {savedTraitMessage ? (
                          <p className="mt-1 text-xs font-semibold text-ink-soft">
                            {savedTraitMessage}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            saveAllFeatureTraits(
                              viewItem.rasgos || [],
                              classFeatureSource
                            )
                          }
                          disabled={saveTraitsMutation.isPending}
                          className="rounded-md border border-brand/30 bg-brand/10 px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-brand transition hover:border-brand hover:bg-brand/15 disabled:opacity-45"
                        >
                          Guardar clase
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            removeFeatureTraits(classFeatureSource)
                          }
                          disabled={removeTraitsMutation.isPending}
                          className="rounded-md border border-stroke bg-white px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-red-200 hover:text-red-700 disabled:opacity-45"
                        >
                          Quitar clase
                        </button>
                      </div>
                    </div>
                    <ClassProgressionTable item={viewItem} />
                    <div className="hidden">
                      <WikiText
                        text={
                          viewItem.descripcion ||
                          viewItem.resumen ||
                          'Esta clase todavía no tiene descripción.'
                        }
                      />
                    </div>
                    <CollapsibleTextSection
                      text={viewItem.descripcion || viewItem.resumen}
                      emptyText="Esta clase todavía no tiene descripción."
                    />
                    <FeatureList
                      features={viewItem.rasgos || []}
                      sourceContext={classFeatureSource}
                      onSaveFeature={(feature, index) =>
                        saveFeatureTrait(feature, index, classFeatureSource)
                      }
                      savePending={saveTraitsMutation.isPending}
                    />
                  </>
                )}
              </div>

              <aside className="grid gap-4 self-start">
                <div className="rounded-2xl border border-stroke bg-white p-4 shadow-sm">
                  <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
                    Datos rápidos
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-ink-soft">
                    {isEditing ? (
                      <label className="block">
                        <span className="text-xs font-bold uppercase text-ink-muted">
                          Dado de golpe
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={draft.dadoGolpeCaras}
                          onChange={(event) =>
                            updateDraft({ dadoGolpeCaras: event.target.value })
                          }
                          className="archive-input mt-1 rounded-xl"
                        />
                      </label>
                    ) : (
                      <p>
                        <span className="font-semibold text-ink">Dado:</span> d
                        {viewItem.dadoGolpeCaras || '-'}
                      </p>
                    )}
                    <p>
                      <span className="font-semibold text-ink">Subclases:</span>{' '}
                      {viewItem.subclases?.length || 0}
                    </p>
                    <p>
                      <span className="font-semibold text-ink">Rasgos:</span>{' '}
                      {viewItem.rasgos?.length || 0}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-stroke bg-white p-4 shadow-sm">
                  <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
                    Campañas
                  </p>
                  {isEditing ? (
                    <div className="mt-3 grid gap-2">
                      {(optionsQuery.data?.campanasGestionables || [])
                        .length ? (
                        optionsQuery.data.campanasGestionables.map(
                          (campaign) => {
                            const active = draft.campanaIds.includes(
                              campaign.id
                            )

                            return (
                              <button
                                key={campaign.id}
                                type="button"
                                onClick={() =>
                                  updateDraft({
                                    campanaIds: active
                                      ? draft.campanaIds.filter(
                                          (id) => id !== campaign.id
                                        )
                                      : [...draft.campanaIds, campaign.id],
                                  })
                                }
                                className={cn(
                                  'rounded-xl border px-3 py-2 text-left text-sm font-semibold transition',
                                  active
                                    ? 'border-brand bg-brand/10 text-brand'
                                    : 'border-stroke bg-white text-ink-soft hover:border-brand'
                                )}
                              >
                                {campaign.nombre}
                              </button>
                            )
                          }
                        )
                      ) : (
                        <p className="text-sm text-ink-soft">
                          No tienes campañas gestionables.
                        </p>
                      )}
                    </div>
                  ) : viewItem.campanas?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {viewItem.campanas.map((campaign) => (
                        <span key={campaign.id} className="archive-chip">
                          {campaign.nombre}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-ink-soft">
                      Sin campañas asociadas.
                    </p>
                  )}
                </div>

                {!isEditing && viewItem.creadorSistema ? (
                  <SystemCreatorBadge />
                ) : null}
                {!isEditing && viewItem.creadoPor ? (
                  <CreatorBadge creator={viewItem.creadoPor} />
                ) : null}
              </aside>
            </div>
          ) : null}

          {activeTab === 'subclases' ? (
            <div className="mt-8 grid gap-5">
              {isEditing ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addSubclass}
                    className="theme-solid-button inline-flex items-center gap-2 rounded-md px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                  >
                    <Plus className="h-4 w-4" />
                    Añadir subclase
                  </button>
                </div>
              ) : null}

              {isEditing ? (
                <div className="grid gap-4">
                  {draft.subclases.map((subclass, index) => (
                    <article
                      key={subclass.id || index}
                      className="rounded-2xl border border-stroke bg-white p-4 shadow-sm"
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_auto]">
                        <input
                          value={subclass.nombre}
                          onChange={(event) =>
                            updateSubclass(index, {
                              nombre: event.target.value,
                            })
                          }
                          className="archive-input rounded-xl font-semibold"
                          placeholder="Nombre de subclase"
                        />
                        <input
                          value={subclass.fuente || ''}
                          onChange={(event) =>
                            updateSubclass(index, {
                              fuente: event.target.value,
                            })
                          }
                          className="archive-input rounded-xl"
                          placeholder="Fuente"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft({
                              subclases: draft.subclases.filter(
                                (_item, itemIndex) => itemIndex !== index
                              ),
                            })
                          }
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        value={subclass.resumen || ''}
                        onChange={(event) =>
                          updateSubclass(index, { resumen: event.target.value })
                        }
                        rows={2}
                        className="mt-3 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-brand"
                        placeholder="Resumen breve"
                      />
                      <WikiTextArea
                        value={subclass.descripcion || ''}
                        onChange={(event) =>
                          updateSubclass(index, {
                            descripcion: event.target.value,
                          })
                        }
                        rows={5}
                        className="mt-3 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-brand"
                        placeholder="Descripción"
                      />
                      <div className="mt-4">
                        <FeatureEditor
                          label="Rasgos de subclase"
                          features={subclass.rasgos || []}
                          onChange={(rasgos) =>
                            updateSubclass(index, { rasgos })
                          }
                          traitTypes={optionsQuery.data?.tiposRasgo || []}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ) : viewItem.subclases?.length ? (
                <div className="grid gap-3">
                  {viewItem.subclases.map((subclass) => (
                    <Link
                      key={subclass.id}
                      to={`/app/clases/${viewItem.id}/subclases/${subclass.id}`}
                      className="theme-sheet-soft rounded-2xl border border-stroke px-5 py-4 transition hover:border-brand hover:bg-brand/10"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-headline text-xl font-black text-ink">
                          {subclass.nombre}
                        </h2>
                        {subclass.fuente ? (
                          <span className="archive-chip">
                            {subclass.fuente}
                          </span>
                        ) : null}
                      </div>
                      {subclass.resumen ? (
                        <div className="theme-sheet-copy mt-2 line-clamp-2 text-sm leading-6 text-ink-soft">
                          <WikiText text={subclass.resumen} />
                        </div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-stroke bg-white px-5 py-4 text-sm text-ink-soft">
                  Esta clase todavía no tiene subclases.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </article>

      {deleteOpen ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-3xl border border-stroke bg-white p-6 shadow-card">
            <h2 className="font-display text-2xl font-black text-ink">
              Borrar clase
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Esta acción eliminará la clase si no está enlazada a personajes.
            </p>
            {deleteMutation.error ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteMutation.error.message}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="rounded-md border border-stroke bg-white px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-700 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white disabled:opacity-50"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ScrollTopButton
        show={showScrollTop}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </section>
  )
}

export function SubclassDetailPage() {
  const { classId, subclassId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [savedTraitMessage, setSavedTraitMessage] = useState('')
  const subclassQuery = useQuery({
    queryKey: ['subclass-detail', classId, subclassId],
    queryFn: () => fetchSubclassDetail(classId, subclassId),
    staleTime: 60 * 1000,
  })

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 500)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const subclass = subclassQuery.data

    if (!subclass?.id) {
      return
    }

    recordRecentActivity({
      entityType: 'subclass',
      entityId: subclass.id,
      nombre: subclass.nombre,
      subtitulo: subclass.clase?.nombre
        ? `Subclase de ${subclass.clase.nombre}`
        : 'Subclase',
      urlDestino: `/app/clases/${classId}/subclases/${subclass.id}`,
    })
  }, [classId, subclassQuery.data])

  const saveTraitsMutation = useMutation({
    mutationFn: (traits) => createSavedTraitsBulk(traits),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      setSavedTraitMessage(
        result.created
          ? `Rasgos guardados: ${result.created}.`
          : 'Ya tenias guardados esos rasgos.'
      )
    },
    onError: (error) => setSavedTraitMessage(error.message),
  })
  const removeTraitsMutation = useMutation({
    mutationFn: (payload) => removeSavedTraitsSource(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      setSavedTraitMessage(
        result.removed
          ? `Rasgos quitados de la boveda: ${result.removed}.`
          : 'No habia rasgos guardados de esta fuente.'
      )
    },
    onError: (error) => setSavedTraitMessage(error.message),
  })

  if (subclassQuery.isLoading || !subclassQuery.data) {
    return (
      <section className="rounded-3xl border border-stroke bg-white p-8 text-center text-sm font-semibold text-ink-soft shadow-card">
        Cargando subclase...
      </section>
    )
  }

  const subclass = subclassQuery.data
  const parentClass = subclass.clase
  const Icon = getClassIcon(parentClass?.icono)
  const subclassFeatureSource = {
    sourceType: 'subclase',
    entityId: subclass.id,
    entityName: subclass.nombre,
    groupId: `subclase:${subclass.id}:rasgos`,
    classId,
    subclassId: subclass.id,
  }

  function saveSubclassFeature(feature, index = 0) {
    setSavedTraitMessage('')
    const payload = buildFeatureTraitPayload(
      feature,
      subclassFeatureSource,
      index
    )

    if (payload) {
      saveTraitsMutation.mutate([payload])
    }
  }

  function saveAllSubclassFeatures() {
    setSavedTraitMessage('')
    const payloads = (subclass.rasgos || [])
      .map((feature, index) =>
        buildFeatureTraitPayload(feature, subclassFeatureSource, index)
      )
      .filter(Boolean)

    if (!payloads.length) {
      setSavedTraitMessage('No hay rasgos guardables en esta subclase.')
      return
    }

    saveTraitsMutation.mutate(payloads)
  }

  function removeSubclassFeatures() {
    setSavedTraitMessage('')
    removeTraitsMutation.mutate({
      origenTipo: 'subclase',
      origenEntidadId: subclass.id,
      origenGrupoId: subclassFeatureSource.groupId,
    })
  }

  return (
    <section className="grid gap-6">
      <article className="theme-sheet-shell overflow-hidden shadow-card">
        <CharacterSheetHeader
          tabs={[{ id: 'informacion', label: 'Información' }]}
          activeTab="informacion"
          characterName={subclass.nombre}
          onTabChange={() => {}}
          onBack={() => navigate('/app/clases/listado')}
        />

        <div className="p-5 sm:p-7 lg:p-9">
          <div className="theme-sheet-rule grid gap-6 border-b pb-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start">
            <Link
              to={`/app/clases/${classId}`}
              className="theme-brand-gradient flex h-44 w-full items-center justify-center rounded-2xl border border-brand/30 bg-ink text-brand transition hover:scale-[1.01] lg:h-48"
            >
              {createElement(Icon, { className: 'h-20 w-20' })}
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <span className="archive-chip">Subclase</span>
                {subclass.fuente ? (
                  <span className="archive-chip">{subclass.fuente}</span>
                ) : null}
                {parentClass?.nombre ? (
                  <Link
                    to={`/app/clases/${classId}`}
                    className="archive-chip transition hover:text-brand"
                  >
                    {parentClass.nombre}
                  </Link>
                ) : null}
              </div>
              <h1 className="mt-3 break-words font-display text-4xl font-black tracking-[-0.05em] text-ink [overflow-wrap:anywhere] sm:text-5xl">
                {subclass.nombre}
              </h1>
              {subclass.resumen ? (
                <div className="theme-sheet-copy mt-4 max-w-4xl text-sm italic leading-7 text-ink-soft">
                  <WikiText text={subclass.resumen} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-white px-4 py-3 shadow-sm">
              <div>
                <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                  Boveda de rasgos
                </p>
                {savedTraitMessage ? (
                  <p className="mt-1 text-xs font-semibold text-ink-soft">
                    {savedTraitMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={saveAllSubclassFeatures}
                  disabled={saveTraitsMutation.isPending}
                  className="rounded-md border border-brand/30 bg-brand/10 px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-brand transition hover:border-brand hover:bg-brand/15 disabled:opacity-45"
                >
                  Guardar subclase
                </button>
                <button
                  type="button"
                  onClick={removeSubclassFeatures}
                  disabled={removeTraitsMutation.isPending}
                  className="rounded-md border border-stroke bg-white px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-red-200 hover:text-red-700 disabled:opacity-45"
                >
                  Quitar subclase
                </button>
              </div>
            </div>
            <SubclassSummaryTable subclass={subclass} />
            <div className="hidden">
              <WikiText
                text={
                  subclass.descripcion ||
                  subclass.resumen ||
                  'Esta subclase todavía no tiene descripción.'
                }
              />
            </div>
            <CollapsibleTextSection
              text={subclass.descripcion || subclass.resumen}
              emptyText="Esta subclase todavía no tiene descripción."
            />
            <FeatureList
              features={subclass.rasgos || []}
              emptyText="Esta subclase todavía no tiene rasgos."
              sourceContext={subclassFeatureSource}
              onSaveFeature={saveSubclassFeature}
              savePending={saveTraitsMutation.isPending}
            />
          </div>
        </div>
      </article>

      <ScrollTopButton
        show={showScrollTop}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </section>
  )
}
