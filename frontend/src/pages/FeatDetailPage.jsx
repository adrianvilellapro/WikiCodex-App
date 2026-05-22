/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  Pencil,
  Plus,
  Save,
  ScrollText,
  Trash2,
  X,
} from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
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
  createFeat,
  deleteFeat,
  fetchFeatDetail,
  fetchFeatOptions,
  updateFeat,
} from './feats/api'

const DRAFT_PREFIX = 'wikicodex:feat-editor:draft'
const EMPTY_DRAFT = {
  nombre: '',
  idiomaCodigo: 'en',
  fuente: 'wikicodex',
  edicion: 'wikicodex',
  categoria: '',
  prerrequisitos: [],
  descripcion: '',
  resumen: '',
  beneficios: [],
  datosFuente: {},
  rasgoGuardable: {
    nombre: '',
    descripcion: '',
    tipoRasgoId: '',
  },
}

function getDraftKey(featId) {
  return `${DRAFT_PREFIX}:${featId || 'new'}`
}

function readStoredDraft(featId) {
  try {
    const raw = window.localStorage.getItem(getDraftKey(featId))
    return raw ? JSON.parse(raw)?.draft || null : null
  } catch {
    window.localStorage.removeItem(getDraftKey(featId))
    return null
  }
}

function persistDraft(featId, draft) {
  window.localStorage.setItem(
    getDraftKey(featId),
    JSON.stringify({ featId: featId || 'new', draft })
  )
}

function clearDraft(featId) {
  window.localStorage.removeItem(getDraftKey(featId))
}

function cloneDraft(value = {}) {
  return JSON.parse(
    JSON.stringify({
      ...EMPTY_DRAFT,
      ...value,
      prerrequisitos: Array.isArray(value.prerrequisitos)
        ? value.prerrequisitos
        : [],
      beneficios: Array.isArray(value.beneficios) ? value.beneficios : [],
      datosFuente:
        value.datosFuente && typeof value.datosFuente === 'object'
          ? value.datosFuente
          : {},
      rasgoGuardable:
        value.rasgoGuardable && typeof value.rasgoGuardable === 'object'
          ? value.rasgoGuardable
          : { nombre: '', descripcion: '', tipoRasgoId: '' },
    })
  )
}

const ABILITY_LABELS = {
  str: 'FUE',
  dex: 'DES',
  con: 'CON',
  int: 'INT',
  wis: 'SAB',
  cha: 'CAR',
}
const ABILITY_OPTIONS = Object.entries(ABILITY_LABELS)

function normalizePrerequisites(value) {
  return Array.isArray(value)
    ? value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? item
          : { texto: String(item || '') }
      )
    : []
}

function formatListValue(value) {
  if (!Array.isArray(value)) {
    return String(value || '')
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }

      if (item?.name) {
        return item.name
      }

      if (item?.displayEntry) {
        return item.displayEntry
      }

      return JSON.stringify(item)
    })
    .join(', ')
}

function formatAbilityPrereq(ability) {
  if (!Array.isArray(ability) || !ability.length) {
    return ''
  }

  return ability
    .map((entry) =>
      Object.entries(entry || {})
        .map(
          ([key, value]) =>
            `${ABILITY_LABELS[key] || key.toUpperCase()} ${value}`
        )
        .join(' o ')
    )
    .filter(Boolean)
    .join('; ')
}

function listInputToArray(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatPrerequisiteItem(item) {
  if (!item || typeof item !== 'object') {
    return ''
  }

  const parts = []

  if (item.texto) {
    parts.push(item.texto)
  }

  if (item.level) {
    parts.push(`Nivel ${item.level}`)
  }

  const abilityText = formatAbilityPrereq(item.ability)

  if (abilityText) {
    parts.push(`Caracteristica: ${abilityText}`)
  }

  if (item.feat) {
    parts.push(`Dote: ${formatListValue(item.feat)}`)
  }

  if (item.featCategory) {
    parts.push(`Categoria de dote: ${formatListValue(item.featCategory)}`)
  }

  if (item.race) {
    parts.push(`Raza: ${formatListValue(item.race)}`)
  }

  if (item.background) {
    parts.push(`Trasfondo: ${formatListValue(item.background)}`)
  }

  if (item.proficiency) {
    parts.push(`Competencia: ${formatListValue(item.proficiency)}`)
  }

  if (item.feature) {
    parts.push(`Rasgo: ${formatListValue(item.feature)}`)
  }

  if (item.campaign) {
    parts.push(`Campana: ${formatListValue(item.campaign)}`)
  }

  if (item.exclusiveFeatCategory) {
    parts.push(
      `Categoria exclusiva: ${formatListValue(item.exclusiveFeatCategory)}`
    )
  }

  if (item.spellcasting || item.spellcasting2020) {
    parts.push('Capacidad de lanzar conjuros')
  }

  if (item.spellcastingFeature) {
    parts.push('Rasgo de lanzamiento de conjuros')
  }

  if (item.otherSummary?.entry) {
    parts.push(formatListValue([item.otherSummary.entry]))
  }

  if (item.other) {
    parts.push(String(item.other))
  }

  const knownKeys = new Set([
    'texto',
    'level',
    'ability',
    'feat',
    'featCategory',
    'race',
    'background',
    'proficiency',
    'feature',
    'campaign',
    'exclusiveFeatCategory',
    'spellcasting',
    'spellcasting2020',
    'spellcastingFeature',
    'otherSummary',
    'other',
  ])
  const unknownKeys = Object.keys(item).filter((key) => !knownKeys.has(key))

  if (unknownKeys.length) {
    parts.push(
      unknownKeys
        .map((key) => `${key}: ${JSON.stringify(item[key])}`)
        .join('; ')
    )
  }

  return parts.filter(Boolean).join(' · ')
}

function prerequisitesToText(value) {
  return normalizePrerequisites(value)
    .map(formatPrerequisiteItem)
    .filter(Boolean)
    .join('\n')
}

function getSavableFeat(feat = {}) {
  const source =
    feat.rasgoGuardable ||
    (feat.datosFuente && feat.datosFuente.rasgoGuardable) ||
    {}

  return {
    nombre: source.nombre || '',
    descripcion: source.descripcion || '',
    tipoRasgoId: source.tipoRasgoId || '',
  }
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
    categoria: item.categoria || '',
    prerrequisitos: normalizePrerequisites(item.prerrequisitos),
    descripcion: item.descripcion || '',
    resumen: item.resumen || '',
    beneficios: item.beneficios || [],
    datosFuente: item.datosFuente || {},
    rasgoGuardable: getSavableFeat(item),
  })
}

function buildPayload(draft) {
  const rasgoGuardable = {
    nombre: draft.rasgoGuardable?.nombre?.trim() || '',
    descripcion: draft.rasgoGuardable?.descripcion?.trim() || '',
    tipoRasgoId: draft.rasgoGuardable?.tipoRasgoId || '',
  }
  const datosFuente = { ...(draft.datosFuente || {}) }

  if (
    rasgoGuardable.nombre &&
    rasgoGuardable.descripcion &&
    rasgoGuardable.tipoRasgoId
  ) {
    datosFuente.rasgoGuardable = rasgoGuardable
  } else {
    delete datosFuente.rasgoGuardable
  }

  return {
    nombre: draft.nombre.trim(),
    idiomaCodigo: draft.idiomaCodigo || 'en',
    fuente: draft.fuente?.trim() || 'wikicodex',
    edicion: draft.edicion?.trim() || 'wikicodex',
    categoria: draft.categoria?.trim() || null,
    prerrequisitos: normalizePrerequisites(draft.prerrequisitos),
    descripcion: draft.descripcion?.trim() || null,
    resumen: draft.resumen?.trim() || null,
    beneficios: draft.beneficios || [],
    datosFuente,
  }
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

function PrerequisiteBlock({ value }) {
  const text = prerequisitesToText(value)

  if (!text) {
    return null
  }

  return (
    <div className="rounded-2xl border border-stroke bg-white p-4 shadow-sm">
      <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
        Prerrequisitos
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">
        {text}
      </p>
    </div>
  )
}

function PrerequisiteEditor({ value, onChange }) {
  const items = normalizePrerequisites(value)

  function updateItem(index, patch) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    )
  }

  function updateAbility(index, abilityKey, score) {
    const item = items[index] || {}
    const ability = Array.isArray(item.ability) ? item.ability : []
    const current = ability[0] || {}
    const cleanScore = Number(score) || 0

    onChange(
      items.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              ability:
                abilityKey && cleanScore ? [{ [abilityKey]: cleanScore }] : [],
            }
          : entry
      )
    )

    return current
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
          Prerrequisitos
        </span>
        <button
          type="button"
          onClick={() =>
            onChange([...items, { level: '', ability: [], texto: '' }])
          }
          className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <Plus className="h-3.5 w-3.5" />
          Anadir requisito
        </button>
      </div>

      {items.length ? (
        <div className="grid gap-3">
          {items.map((item, index) => {
            const abilityEntry = Array.isArray(item.ability)
              ? item.ability[0] || {}
              : {}
            const abilityKey = Object.keys(abilityEntry)[0] || ''
            const abilityScore = abilityKey ? abilityEntry[abilityKey] : ''
            const preview = formatPrerequisiteItem(item)

            return (
              <article
                key={`prerequisite-${index}`}
                className="rounded-xl border border-stroke bg-white p-3 shadow-sm"
              >
                <div className="grid gap-3 md:grid-cols-[7rem_minmax(0,1fr)_8rem_auto]">
                  <input
                    type="number"
                    min="0"
                    value={item.level || ''}
                    onChange={(event) =>
                      updateItem(index, {
                        level: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                    className="archive-input rounded-xl"
                    placeholder="Nivel"
                  />
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                    <select
                      value={abilityKey}
                      onChange={(event) =>
                        updateAbility(index, event.target.value, abilityScore)
                      }
                      className="archive-input rounded-xl"
                    >
                      <option value="">Caracteristica</option>
                      {ABILITY_OPTIONS.map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={abilityScore || ''}
                      onChange={(event) =>
                        updateAbility(index, abilityKey, event.target.value)
                      }
                      className="archive-input rounded-xl"
                      placeholder="Valor"
                    />
                  </div>
                  <input
                    value={item.texto || ''}
                    onChange={(event) =>
                      updateItem(index, { texto: event.target.value })
                    }
                    className="archive-input rounded-xl"
                    placeholder="Texto"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        items.filter((_entry, itemIndex) => itemIndex !== index)
                      )
                    }
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-red-700"
                    aria-label="Quitar requisito"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    ['feat', 'Dotes necesarias'],
                    ['race', 'Razas'],
                    ['background', 'Trasfondos'],
                    ['proficiency', 'Competencias'],
                    ['feature', 'Rasgos necesarios'],
                    ['campaign', 'Campanas'],
                  ].map(([field, label]) => (
                    <input
                      key={field}
                      value={formatListValue(item[field])}
                      onChange={(event) =>
                        updateItem(index, {
                          [field]: listInputToArray(event.target.value),
                        })
                      }
                      className="archive-input rounded-xl"
                      placeholder={`${label} (separado por comas)`}
                    />
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs font-bold text-ink-soft">
                  <input
                    type="checkbox"
                    checked={Boolean(
                      item.spellcasting ||
                      item.spellcasting2020 ||
                      item.spellcastingFeature
                    )}
                    onChange={(event) =>
                      updateItem(index, {
                        spellcasting: event.target.checked || undefined,
                        spellcasting2020: undefined,
                        spellcastingFeature: undefined,
                      })
                    }
                    className="rounded border-stroke text-brand focus:ring-brand"
                  />
                  Requiere lanzar conjuros
                </label>
                {preview ? (
                  <p className="mt-2 text-xs font-semibold text-ink-muted">
                    {preview}
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stroke bg-white px-4 py-4 text-sm text-ink-soft">
          Sin prerrequisitos.
        </p>
      )}
    </div>
  )
}

function SavableFeatPanel({
  feat,
  onSave,
  onRemove,
  pending = false,
  removePending = false,
}) {
  const savable = getSavableFeat(feat)

  return (
    <details className="theme-sheet-card group rounded-2xl border shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden transition hover:bg-brand/5">
        <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
          Rasgo guardable
        </span>
        <ChevronDown className="h-4 w-4 text-ink-muted transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t border-stroke/60 px-4 py-4">
        {savable.descripcion ? (
          <div className="theme-sheet-soft theme-sheet-copy rounded-xl border border-stroke/70 px-3 py-3 text-sm leading-6 text-ink-soft">
            <p className="font-bold text-ink">{savable.nombre}</p>
            <WikiText text={savable.descripcion} />
          </div>
        ) : (
          <p className="text-sm text-ink-soft">
            Esta dote todavia no tiene version guardable.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={
              pending ||
              !savable.nombre?.trim() ||
              !savable.descripcion?.trim() ||
              !savable.tipoRasgoId
            }
            className="rounded-md border border-brand/30 bg-brand/10 px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-brand transition hover:border-brand hover:bg-brand/15 disabled:opacity-45"
          >
            Guardar dote
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={removePending}
            className="theme-sheet-soft rounded-md border border-stroke px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-red-200 hover:text-red-700 disabled:opacity-45"
          >
            Quitar dote
          </button>
        </div>
      </div>
    </details>
  )
}

export function FeatDetailPage({ createMode = false, startEditing = false }) {
  const { featId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const storageId = createMode ? 'new' : featId
  const [draft, setDraft] = useState(null)
  const [isEditing, setIsEditing] = useState(createMode || startEditing)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedTraitMessage, setSavedTraitMessage] = useState('')

  const featQuery = useQuery({
    queryKey: ['feat-detail', featId],
    queryFn: () => fetchFeatDetail(featId),
    enabled: Boolean(!createMode && featId),
    staleTime: 60 * 1000,
  })
  const optionsQuery = useQuery({
    queryKey: ['feat-options'],
    queryFn: fetchFeatOptions,
    staleTime: 60 * 1000,
  })

  const item = createMode ? null : featQuery.data
  const viewItem = isEditing ? draft : item
  const canEdit = createMode || item?.puedeEditar
  const featSource = item
    ? {
        origenTipo: 'dote',
        origenEntidadId: item.id,
        origenEntidadNombre: item.nombre,
        origenGrupoId: `dote:${item.id}`,
        origenRasgoClave: `dote:${item.id}`,
        origenRasgoNombre: item.nombre,
      }
    : null
  const sourceOptions = useMemo(
    () =>
      optionsQuery.data?.fuentes || [
        { codigo: 'wikicodex', nombre: 'wikicodex' },
      ],
    [optionsQuery.data?.fuentes]
  )

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 500)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
    setDraft(stored && startEditing ? cloneDraft(stored) : toDraft(item))
    setIsEditing(startEditing)
  }, [createMode, item, startEditing, storageId])

  useEffect(() => {
    if (!item?.id || createMode) {
      return
    }

    recordRecentActivity({
      entityType: 'feat',
      entityId: item.id,
      nombre: item.nombre,
      subtitulo: 'Dote',
      urlDestino: `/app/clases/dotes/${item.id}`,
    })
  }, [createMode, item?.id, item?.nombre])

  function updateDraft(patch) {
    setDraft((current) => {
      const next = cloneDraft({ ...(current || EMPTY_DRAFT), ...patch })
      persistDraft(storageId, next)
      return next
    })
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      createMode
        ? createFeat(buildPayload(draft))
        : updateFeat(featId, buildPayload(draft)),
    onSuccess: (saved) => {
      clearDraft(storageId)
      queryClient.invalidateQueries({ queryKey: ['feats'] })
      queryClient.invalidateQueries({ queryKey: ['feat-detail', saved.id] })
      setSaveError('')

      if (createMode) {
        navigate(`/app/clases/dotes/${saved.id}`, { replace: true })
      } else {
        setDraft(toDraft(saved))
        setIsEditing(false)
      }
    },
    onError: (error) => setSaveError(error.message),
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteFeat(featId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feats'] })
      navigate('/app/clases/dotes', { replace: true })
    },
  })

  const saveTraitMutation = useMutation({
    mutationFn: (traits) => createSavedTraitsBulk(traits),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      setSavedTraitMessage(
        result.created
          ? 'Dote guardada en tu boveda.'
          : 'Ya tenias guardada esta dote.'
      )
    },
    onError: (error) => setSavedTraitMessage(error.message),
  })
  const removeTraitMutation = useMutation({
    mutationFn: (payload) => removeSavedTraitsSource(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      setSavedTraitMessage(
        result.removed
          ? 'Dote quitada de tu boveda.'
          : 'No tenias guardada esta dote.'
      )
    },
    onError: (error) => setSavedTraitMessage(error.message),
  })

  function saveFeatTrait() {
    if (!item || !featSource) {
      return
    }

    const savable = getSavableFeat(item)

    if (
      !savable.nombre?.trim() ||
      !savable.descripcion?.trim() ||
      !savable.tipoRasgoId
    ) {
      setSavedTraitMessage('Esta dote no tiene rasgo guardable.')
      return
    }

    setSavedTraitMessage('')
    saveTraitMutation.mutate([
      {
        tipoRasgoId: savable.tipoRasgoId,
        nombre: savable.nombre.trim(),
        descripcion: savable.descripcion.trim(),
        ...featSource,
        origenDatos: {
          fuente: item.fuente,
          categoria: item.categoria,
        },
      },
    ])
  }

  function removeFeatTrait() {
    if (!featSource) {
      return
    }

    setSavedTraitMessage('')
    removeTraitMutation.mutate({
      origenTipo: 'dote',
      origenEntidadId: featSource.origenEntidadId,
      origenGrupoId: featSource.origenGrupoId,
    })
  }

  function handleBack() {
    if (location.state?.returnTo?.pathname) {
      navigate(
        {
          pathname: location.state.returnTo.pathname,
          search: location.state.returnTo.search || '',
        },
        { replace: true }
      )
      return
    }

    navigate('/app/clases/dotes')
  }

  function startEdit() {
    setDraft(toDraft(item))
    persistDraft(storageId, toDraft(item))
    setIsEditing(true)
  }

  function cancelEdit() {
    clearDraft(storageId)

    if (createMode) {
      navigate('/app/clases/dotes')
      return
    }

    setDraft(toDraft(item))
    setIsEditing(false)
  }

  if ((featQuery.isLoading && !createMode) || !viewItem) {
    return (
      <section className="rounded-3xl border border-stroke bg-white p-8 text-center text-sm font-semibold text-ink-soft shadow-card">
        Cargando dote...
      </section>
    )
  }

  return (
    <section className="grid gap-6">
      <article className="theme-sheet-shell overflow-hidden shadow-card">
        <CharacterSheetHeader
          tabs={[{ id: 'informacion', label: 'Información' }]}
          activeTab="informacion"
          characterName={viewItem.nombre || 'Nueva dote'}
          onTabChange={() => {}}
          onBack={handleBack}
        />

        <div className="p-5 sm:p-7 lg:p-9">
          <div className="theme-sheet-rule grid gap-6 border-b pb-8 lg:grid-cols-[9rem_minmax(0,1fr)_auto] lg:items-start">
            <div className="theme-brand-gradient flex h-36 w-full items-center justify-center rounded-2xl border border-brand/30 bg-ink text-brand">
              <ScrollText className="h-16 w-16" />
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
                    placeholder="Nombre de la dote"
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
                      {sourceOptions.map((source) => (
                        <option key={source.codigo} value={source.codigo}>
                          {source.nombre}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.edicion}
                      onChange={(event) =>
                        updateDraft({ edicion: event.target.value })
                      }
                      className="archive-input rounded-xl"
                    >
                      <option value="classic">Clásico</option>
                      <option value="one">D&D One</option>
                      <option value="wikicodex">WikiCodex</option>
                    </select>
                    <input
                      value={draft.categoria}
                      onChange={(event) =>
                        updateDraft({ categoria: event.target.value })
                      }
                      className="archive-input rounded-xl"
                      placeholder="Categoría"
                    />
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
                    {viewItem.categoria ? (
                      <span className="archive-chip">{viewItem.categoria}</span>
                    ) : null}
                  </div>
                  <h1 className="mt-3 break-words font-display text-4xl font-black tracking-[-0.05em] text-ink [overflow-wrap:anywhere] sm:text-5xl">
                    {viewItem.nombre}
                  </h1>
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
                  <PrerequisiteEditor
                    value={draft.prerrequisitos}
                    onChange={(prerrequisitos) =>
                      updateDraft({ prerrequisitos })
                    }
                  />
                  <label className="block">
                    <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
                      Descripción
                    </span>
                    <WikiTextArea
                      value={draft.descripcion}
                      onChange={(event) =>
                        updateDraft({ descripcion: event.target.value })
                      }
                      rows={16}
                      className="mt-2 w-full rounded-xl border border-stroke bg-white px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-brand"
                    />
                  </label>
                  <details className="group rounded-2xl border border-stroke bg-white shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
                      <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                        Rasgo guardable
                      </span>
                      <ChevronDown className="h-4 w-4 text-ink-muted transition group-open:rotate-180" />
                    </summary>
                    <div className="grid gap-3 border-t border-stroke/60 px-4 py-4">
                      <select
                        value={draft.rasgoGuardable?.tipoRasgoId || ''}
                        onChange={(event) =>
                          updateDraft({
                            rasgoGuardable: {
                              ...(draft.rasgoGuardable || {}),
                              tipoRasgoId: event.target.value,
                            },
                          })
                        }
                        className="archive-input rounded-xl"
                      >
                        <option value="">Tipo de rasgo guardable</option>
                        {(optionsQuery.data?.tiposRasgo || []).map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.nombre}
                          </option>
                        ))}
                      </select>
                      <input
                        value={draft.rasgoGuardable?.nombre || ''}
                        onChange={(event) =>
                          updateDraft({
                            rasgoGuardable: {
                              ...(draft.rasgoGuardable || {}),
                              nombre: event.target.value,
                            },
                          })
                        }
                        className="archive-input rounded-xl"
                        placeholder="Nombre reutilizable"
                      />
                      <WikiTextArea
                        value={draft.rasgoGuardable?.descripcion || ''}
                        onChange={(event) =>
                          updateDraft({
                            rasgoGuardable: {
                              ...(draft.rasgoGuardable || {}),
                              descripcion: event.target.value,
                            },
                          })
                        }
                        rows={5}
                        className="w-full rounded-xl border border-stroke bg-white px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-brand"
                        placeholder="Version reducida para guardar en fichas"
                      />
                    </div>
                  </details>
                </>
              ) : (
                <div className="theme-sheet-copy rounded-2xl border border-stroke bg-white px-6 py-5 text-sm leading-8 text-ink-soft shadow-sm">
                  <WikiText
                    text={
                      viewItem.descripcion ||
                      viewItem.resumen ||
                      'Esta dote todavía no tiene descripción.'
                    }
                  />
                </div>
              )}
            </div>

            <aside className="grid gap-4 self-start">
              {!isEditing ? (
                <PrerequisiteBlock value={viewItem.prerrequisitos} />
              ) : null}
              {!isEditing ? (
                <>
                  {savedTraitMessage ? (
                    <p className="rounded-xl border border-stroke bg-white px-4 py-3 text-xs font-semibold text-ink-soft shadow-sm">
                      {savedTraitMessage}
                    </p>
                  ) : null}
                  <SavableFeatPanel
                    feat={viewItem}
                    onSave={saveFeatTrait}
                    onRemove={removeFeatTrait}
                    pending={saveTraitMutation.isPending}
                    removePending={removeTraitMutation.isPending}
                  />
                </>
              ) : null}
              {!isEditing && viewItem.creadorSistema ? (
                <SystemCreatorBadge />
              ) : null}
              {!isEditing && viewItem.creadoPor ? (
                <CreatorBadge creator={viewItem.creadoPor} />
              ) : null}
            </aside>
          </div>
        </div>
      </article>

      {deleteOpen ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-3xl border border-stroke bg-white p-6 shadow-card">
            <h2 className="font-display text-2xl font-black text-ink">
              Borrar dote
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Esta acción eliminará la dote del catálogo.
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
