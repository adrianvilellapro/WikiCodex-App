import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronDown,
  Pencil,
  Save,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
import { cn } from '../lib/cn'
import { recordRecentActivity } from '../services/recent-activity'
import { fetchCampaigns } from './campaign-detail/api'
import {
  createSpell,
  deleteSpell,
  fetchSpellDetail,
  fetchSpellOptions,
  setSpellSaved,
  updateSpell,
} from './spells/api'

function levelLabel(level) {
  return Number(level) === 0 ? 'Truco' : `Nivel ${level}`
}

function normalizeCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function clampHugeIntegerInput(value) {
  const onlyDigits = String(value || '').replace(/\D/gu, '')

  if (!onlyDigits) {
    return ''
  }

  return String(Math.min(Number(onlyDigits), 9_999_999_999))
}

function TextChoiceField({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  maxLength = 120,
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <label className="grid gap-1">
      <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </span>
      <div className="relative">
        <input
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            'archive-input w-full rounded-xl',
            options.length ? 'pr-11' : ''
          )}
          placeholder={placeholder || label}
          maxLength={maxLength}
        />
        {options.length ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-stroke bg-surface-strong text-ink-soft transition hover:border-brand hover:text-brand"
            aria-label={expanded ? 'Ocultar opciones' : 'Ver opciones'}
          >
            <ChevronDown
              className={cn('h-4 w-4 transition', expanded ? 'rotate-180' : '')}
            />
          </button>
        ) : null}
      </div>
      {options.length ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="justify-self-start rounded-lg border border-stroke bg-surface-strong px-3 py-1.5 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          {expanded ? 'Ocultar opciones' : 'Ver opciones'}
        </button>
      ) : null}
      {options.length && expanded ? (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-stroke/70 bg-surface p-2">
          {options.slice(0, 24).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className="rounded-full border border-stroke bg-surface-strong px-2.5 py-1 text-[11px] font-bold text-ink-soft transition hover:border-brand hover:text-brand"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  )
}

function TagChoiceField({
  label,
  values = [],
  onChange,
  options = [],
  placeholder,
  maxLength = 120,
}) {
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState(false)

  function addValue(value) {
    const nextValues = normalizeCsv(value)

    if (!nextValues.length) {
      return
    }

    onChange([...new Set([...values, ...nextValues])])
    setDraft('')
  }

  return (
    <div className="grid gap-2">
      <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </span>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addValue(draft)
              }
            }}
            className={cn(
              'archive-input w-full rounded-xl',
              options.length ? 'pr-11' : ''
            )}
            placeholder={placeholder || 'Escribe y pulsa añadir'}
            maxLength={maxLength}
          />
          {options.length ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-stroke bg-surface-strong text-ink-soft transition hover:border-brand hover:text-brand"
              aria-label={expanded ? 'Ocultar opciones' : 'Ver opciones'}
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition',
                  expanded ? 'rotate-180' : ''
                )}
              />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => addValue(draft)}
          className="rounded-xl bg-brand px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-black"
        >
          Añadir
        </button>
      </div>
      {options.length ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="justify-self-start rounded-lg border border-stroke bg-surface-strong px-3 py-1.5 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          {expanded ? 'Ocultar opciones' : 'Ver opciones'}
        </button>
      ) : null}
      {options.length && expanded ? (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-stroke/70 bg-surface p-2">
          {options.slice(0, 24).map((option) => {
            const active = values.includes(option)

            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onChange(
                    active
                      ? values.filter((item) => item !== option)
                      : [...values, option]
                  )
                }
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-bold transition',
                  active
                    ? 'border-brand bg-brand/15 text-brand'
                    : 'border-stroke bg-surface-strong text-ink-soft hover:border-brand hover:text-brand'
                )}
              >
                {option}
              </button>
            )
          })}
        </div>
      ) : null}
      {values.length ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold text-brand"
              title="Quitar"
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SpellEditSection({ title, children }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="overflow-hidden rounded-2xl border border-stroke bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-brand transition',
            expanded ? 'rotate-180' : ''
          )}
        />
      </button>
      {expanded ? (
        <div className="grid gap-4 border-t border-stroke p-4">{children}</div>
      ) : null}
    </section>
  )
}

function TagList({ title, items }) {
  if (!items?.length) {
    return null
  }

  return (
    <div>
      <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function InfoTile({ title, value }) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return (
    <div className="rounded-xl bg-surface p-4">
      <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
        {title}
      </p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  )
}

function ComponentBadge({ active, label, detail }) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3',
        active
          ? 'border-brand/40 bg-brand/10 text-brand'
          : 'border-stroke bg-surface text-ink-muted'
      )}
    >
      <p className="font-label text-[9px] font-black uppercase tracking-[0.18em]">
        {label}
      </p>
      {detail ? <p className="mt-1 text-xs font-semibold">{detail}</p> : null}
    </div>
  )
}

function createEmptySpellDraft() {
  return {
    nombre: '',
    nivel: 0,
    escuela: '',
    alcancePies: '',
    componentes: {
      verbal: true,
      somatico: false,
      material: '',
      consumeMaterial: false,
    },
    duracion: '',
    duracionPersonalizada: '',
    clases: [],
    tipoCasteo: '',
    concentracion: false,
    tipoAtaque: '',
    tiposDano: [],
    condiciones: [],
    miscelanea: [],
    tipoSalvacion: '',
    pruebaHabilidad: '',
    rango: '',
    estiloArea: '',
    criaturasAfectadas: [],
    descripcion: '',
    fuente: '',
    esPublico: true,
    campanas: [],
  }
}

function buildSpellPayload(draft) {
  return {
    nombre: draft.nombre,
    nivel: Number(draft.nivel || 0),
    escuela: draft.escuela || null,
    alcancePies: draft.alcancePies ? Number(draft.alcancePies) : null,
    componentes: draft.componentes || {},
    duracion: draft.duracion || null,
    duracionPersonalizada: draft.duracionPersonalizada || null,
    clases: draft.clases || [],
    tipoCasteo: draft.tipoCasteo || null,
    concentracion: Boolean(draft.concentracion),
    tipoAtaque: draft.tipoAtaque || null,
    tiposDano: draft.tiposDano || [],
    condiciones: draft.condiciones || [],
    miscelanea: draft.miscelanea || [],
    tipoSalvacion: draft.tipoSalvacion || null,
    pruebaHabilidad: draft.pruebaHabilidad || null,
    rango: draft.rango || null,
    estiloArea: draft.estiloArea || null,
    criaturasAfectadas: draft.criaturasAfectadas || [],
    descripcion: draft.descripcion || null,
    fuente: draft.fuente || null,
    esPublico: draft.esPublico !== false,
    campanaIds: (draft.campanas || []).map((campaign) => campaign.id),
  }
}

export function SpellDetailPage({ createMode = false }) {
  const { spellId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const draftKey = `wikicodex:spell-editor:${createMode ? 'new' : spellId}`
  const reloadKey = `wikicodex:spell-editor-reload:${createMode ? 'new' : spellId}`
  const isReloadingRef = useRef(false)
  const [isEditing, setIsEditing] = useState(createMode)
  const [draft, setDraft] = useState(null)
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleteText, setDeleteText] = useState('')
  const spellQuery = useQuery({
    queryKey: ['spell-detail', spellId],
    queryFn: () => fetchSpellDetail(spellId),
    enabled: Boolean(spellId) && !createMode,
  })
  const optionsQuery = useQuery({
    queryKey: ['spell-options'],
    queryFn: fetchSpellOptions,
    staleTime: 5 * 60 * 1000,
  })
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', 'spell-editor'],
    queryFn: () => fetchCampaigns({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })
  const saveMutation = useMutation({
    mutationFn: () => setSpellSaved(spellId, !spellQuery.data?.estaGuardado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spell-detail', spellId] })
      queryClient.invalidateQueries({ queryKey: ['spells'] })
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
    },
  })
  const updateMutation = useMutation({
    mutationFn: () =>
      createMode
        ? createSpell(buildSpellPayload(draft))
        : updateSpell(spellId, buildSpellPayload(draft)),
    onSuccess: (item) => {
      window.localStorage.removeItem(draftKey)
      window.localStorage.removeItem(reloadKey)
      setIsEditing(false)
      queryClient.invalidateQueries({
        queryKey: ['spell-detail', item?.id || spellId],
      })
      queryClient.invalidateQueries({ queryKey: ['spells'] })
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      queryClient.invalidateQueries({ queryKey: ['object-editor'] })

      if (createMode && item?.id) {
        navigate(`/app/poderes/hechizos/${item.id}`, {
          replace: true,
          state: null,
        })
      }
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteSpell(spellId),
    onSuccess: () => {
      window.localStorage.removeItem(draftKey)
      window.localStorage.removeItem(reloadKey)
      queryClient.invalidateQueries({ queryKey: ['spells'] })
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      queryClient.invalidateQueries({ queryKey: ['object-editor'] })
      navigate('/app/poderes/hechizos')
    },
  })

  useEffect(() => {
    if (createMode) {
      if (draft) {
        return undefined
      }

      const stored = window.localStorage.getItem(draftKey)

      if (stored) {
        try {
          const restoredDraft = JSON.parse(stored)
          const timeout = window.setTimeout(() => {
            setDraft(restoredDraft)
            setIsEditing(true)
          }, 0)
          return () => window.clearTimeout(timeout)
        } catch {
          window.localStorage.removeItem(draftKey)
        }
      }

      const timeout = window.setTimeout(() => {
        setDraft(createEmptySpellDraft())
        setIsEditing(true)
      }, 0)
      return () => window.clearTimeout(timeout)
    }

    if (!spellQuery.data || draft) {
      return
    }

    const stored = window.localStorage.getItem(draftKey)
    const shouldRestoreAfterReload = window.localStorage.getItem(reloadKey)
    window.localStorage.removeItem(reloadKey)

    if (stored && shouldRestoreAfterReload) {
      try {
        const restoredDraft = JSON.parse(stored)
        const timeout = window.setTimeout(() => {
          setDraft(restoredDraft)
          setIsEditing(true)
        }, 0)
        return () => window.clearTimeout(timeout)
      } catch {
        window.localStorage.removeItem(draftKey)
      }
    } else if (stored) {
      window.localStorage.removeItem(draftKey)
    }

    const timeout = window.setTimeout(() => setDraft(spellQuery.data), 0)
    return () => window.clearTimeout(timeout)
  }, [createMode, draft, draftKey, reloadKey, spellQuery.data])

  useEffect(() => {
    if (isEditing && draft) {
      window.localStorage.setItem(draftKey, JSON.stringify(draft))
    }
  }, [draft, draftKey, isEditing])

  useEffect(() => {
    if (!isEditing || !draft) {
      return undefined
    }

    function handleBeforeUnload() {
      isReloadingRef.current = true
      window.localStorage.setItem(draftKey, JSON.stringify(draft))
      window.localStorage.setItem(reloadKey, '1')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)

      if (!isReloadingRef.current) {
        window.localStorage.removeItem(draftKey)
        window.localStorage.removeItem(reloadKey)
      }
    }
  }, [draft, draftKey, isEditing, reloadKey])

  const spell = createMode ? null : spellQuery.data

  useEffect(() => {
    if (createMode) {
      return
    }

    if (!spell?.id) {
      return
    }

    recordRecentActivity({
      entityType: 'spell',
      entityId: spell.id,
      nombre: spell.nombre,
      subtitulo: `${levelLabel(spell.nivel)}${spell.escuela ? ` - ${spell.escuela}` : ''}`,
      imagenUrl: null,
      urlDestino: `/app/poderes/hechizos/${spell.id}`,
    })
  }, [createMode, spell])

  if ((!createMode && spellQuery.isLoading) || (createMode && !draft)) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-card">
        {createMode ? 'Preparando hechizo...' : 'Cargando hechizo...'}
      </div>
    )
  }

  if (!createMode && !spellQuery.data) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-card">
        No se pudo cargar el hechizo.
      </div>
    )
  }
  const viewSpell = isEditing && draft ? draft : spell
  const components = viewSpell.componentes || {}
  const options = optionsQuery.data || {}
  const campaigns = campaignsQuery.data || []
  const updateDraftField = (field, value) =>
    setDraft((current) => ({ ...(current || spell), [field]: value }))
  const updateComponentField = (field, value) =>
    setDraft((current) => ({
      ...(current || spell),
      componentes: {
        ...((current || spell).componentes || {}),
        [field]: value,
      },
    }))
  function handleBack() {
    if (createMode) {
      window.localStorage.removeItem(draftKey)
      window.localStorage.removeItem(reloadKey)
      navigate('/app/poderes/hechizos')
      return
    }

    const returnTo = location.state?.returnTo

    if (returnTo?.pathname) {
      navigate(returnTo.pathname, {
        state: {
          restoreScrollY: returnTo.scrollY || 0,
        },
      })
      return
    }

    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/app/poderes/hechizos')
  }

  const toggleCampaign = (campaignId) =>
    setDraft((current) => {
      const base = current || spell
      const active = (base.campanas || []).some(
        (campaign) => campaign.id === campaignId
      )

      return {
        ...base,
        campanas: active
          ? (base.campanas || []).filter(
              (campaign) => campaign.id !== campaignId
            )
          : [
              ...(base.campanas || []),
              campaigns.find((campaign) => campaign.id === campaignId),
            ].filter(Boolean),
      }
    })

  return (
    <section className="grid gap-6">
      <article className="theme-sheet-shell overflow-hidden shadow-card">
        <div className="theme-header-surface border-b-2 border-brand px-4 py-4">
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={handleBack}
              className="theme-header-button absolute left-0 inline-flex h-11 w-11 items-center justify-center rounded-full border transition"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-center font-headline text-2xl font-black uppercase tracking-[0.28em] text-brand">
              {viewSpell.nombre || 'Nuevo hechizo'}
            </h1>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[58rem] px-5 py-8">
          <div className="theme-sheet-frame border border-slate-200 px-6 py-7 md:px-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  {levelLabel(viewSpell.nivel)} ·{' '}
                  {viewSpell.escuela || 'Sin escuela'}
                </p>
                <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.06em] text-ink">
                  {viewSpell.nombre || 'Nuevo hechizo'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {!createMode ? (
                  <button
                    type="button"
                    onClick={() => saveMutation.mutate()}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] transition',
                      spell.estaGuardado
                        ? 'border-brand/40 bg-brand/10 text-brand'
                        : 'border-stroke text-ink-soft hover:border-brand/40 hover:text-brand'
                    )}
                  >
                    <Star
                      className="h-4 w-4"
                      style={{
                        fill: spell.estaGuardado
                          ? 'currentColor'
                          : 'transparent',
                      }}
                    />
                    {spell.estaGuardado ? 'Guardado' : 'Guardar'}
                  </button>
                ) : null}
              </div>
            </div>

            {isEditing ? (
              <div className="mt-6 grid gap-4">
                <SpellEditSection title="Base">
                  <TextChoiceField
                    label="Nombre"
                    value={viewSpell.nombre}
                    onChange={(value) => updateDraftField('nombre', value)}
                    placeholder="Nombre del hechizo"
                    maxLength={150}
                  />
                  <WikiTextArea
                    value={viewSpell.descripcion || ''}
                    onChange={(event) =>
                      updateDraftField('descripcion', event.target.value)
                    }
                    rows={7}
                    className="archive-input rounded-xl"
                    placeholder="Descripción del hechizo"
                    maxLength={50000}
                  />
                </SpellEditSection>

                <SpellEditSection title="Datos funcionales">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-1">
                      <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted">
                        Alcance en pies
                      </span>
                      <input
                        value={viewSpell.alcancePies || ''}
                        onChange={(event) =>
                          updateDraftField(
                            'alcancePies',
                            clampHugeIntegerInput(event.target.value)
                          )
                        }
                        className="archive-input rounded-xl"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="0"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted">
                        Nivel
                      </span>
                      <select
                        value={viewSpell.nivel || 0}
                        onChange={(event) =>
                          updateDraftField('nivel', Number(event.target.value))
                        }
                        className="archive-input rounded-xl"
                      >
                        {Array.from({ length: 11 }, (_, index) => (
                          <option key={index} value={index}>
                            {levelLabel(index)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextChoiceField
                      label="Casteo"
                      value={viewSpell.tipoCasteo}
                      options={options.tiposCasteo || []}
                      onChange={(value) =>
                        updateDraftField('tipoCasteo', value)
                      }
                    />
                    <TextChoiceField
                      label="Duración"
                      value={viewSpell.duracion}
                      options={options.duraciones || []}
                      onChange={(value) => updateDraftField('duracion', value)}
                    />
                    <TextChoiceField
                      label="Duración personalizada"
                      value={viewSpell.duracionPersonalizada}
                      onChange={(value) =>
                        updateDraftField('duracionPersonalizada', value)
                      }
                      maxLength={200}
                    />
                  </div>
                  <div className="grid gap-3 rounded-2xl border border-stroke bg-surface-strong p-4">
                    <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                      Componentes
                    </p>
                    <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                      {[
                        ['verbal', 'Verbal'],
                        ['somatico', 'Somático'],
                        ['consumeMaterial', 'Material se consume'],
                        ['concentracion', 'Concentración'],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="inline-flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={
                              key === 'concentracion'
                                ? Boolean(viewSpell.concentracion)
                                : Boolean(components[key])
                            }
                            onChange={(event) =>
                              key === 'concentracion'
                                ? updateDraftField(
                                    'concentracion',
                                    event.target.checked
                                  )
                                : updateComponentField(
                                    key,
                                    event.target.checked
                                  )
                            }
                            className="h-4 w-4 accent-[var(--color-brand)]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <input
                      value={components.material || ''}
                      onChange={(event) =>
                        updateComponentField('material', event.target.value)
                      }
                      className="archive-input rounded-xl"
                      placeholder="Componente material"
                      maxLength={1000}
                    />
                  </div>
                </SpellEditSection>

                <SpellEditSection title="Datos informacionales">
                  <div className="grid gap-4 md:grid-cols-2">
                    <TagChoiceField
                      label="Clases"
                      values={viewSpell.clases || []}
                      options={options.clases || []}
                      onChange={(values) => updateDraftField('clases', values)}
                    />
                    <TextChoiceField
                      label="Escuela"
                      value={viewSpell.escuela}
                      options={options.escuelas || []}
                      onChange={(value) => updateDraftField('escuela', value)}
                      maxLength={100}
                    />
                    <TextChoiceField
                      label="Salvación"
                      value={viewSpell.tipoSalvacion}
                      options={options.salvaciones || []}
                      onChange={(value) =>
                        updateDraftField('tipoSalvacion', value)
                      }
                    />
                    <TextChoiceField
                      label="Prueba de habilidad"
                      value={viewSpell.pruebaHabilidad}
                      options={options.pruebasHabilidad || []}
                      onChange={(value) =>
                        updateDraftField('pruebaHabilidad', value)
                      }
                    />
                    <TagChoiceField
                      label="Tipos de daño"
                      values={viewSpell.tiposDano || []}
                      options={options.tiposDano || []}
                      onChange={(values) =>
                        updateDraftField('tiposDano', values)
                      }
                    />
                    <TagChoiceField
                      label="Condiciones"
                      values={viewSpell.condiciones || []}
                      options={options.condiciones || []}
                      onChange={(values) =>
                        updateDraftField('condiciones', values)
                      }
                    />
                  </div>
                </SpellEditSection>

                <SpellEditSection title="Forma del hechizo">
                  <div className="grid gap-3 md:grid-cols-3">
                    <TextChoiceField
                      label="Tipo de ataque"
                      value={viewSpell.tipoAtaque}
                      options={options.tiposAtaque || []}
                      onChange={(value) =>
                        updateDraftField('tipoAtaque', value)
                      }
                    />
                    <TextChoiceField
                      label="Rango"
                      value={viewSpell.rango}
                      options={options.rangos || []}
                      onChange={(value) => updateDraftField('rango', value)}
                    />
                    <TextChoiceField
                      label="Estilo de área"
                      value={viewSpell.estiloArea}
                      options={options.estilosArea || []}
                      onChange={(value) =>
                        updateDraftField('estiloArea', value)
                      }
                    />
                  </div>
                </SpellEditSection>

                <SpellEditSection title="Datos extra">
                  <div className="grid gap-4 md:grid-cols-2">
                    <TagChoiceField
                      label="Criaturas afectadas"
                      values={viewSpell.criaturasAfectadas || []}
                      options={options.criaturas || []}
                      onChange={(values) =>
                        updateDraftField('criaturasAfectadas', values)
                      }
                    />
                    <TagChoiceField
                      label="Miscelánea"
                      values={viewSpell.miscelanea || []}
                      options={options.miscelanea || []}
                      onChange={(values) =>
                        updateDraftField('miscelanea', values)
                      }
                    />
                    <TextChoiceField
                      label="Fuente"
                      value={viewSpell.fuente}
                      onChange={(value) => updateDraftField('fuente', value)}
                      placeholder="Manual, homebrew, campaña..."
                      maxLength={200}
                    />
                  </div>
                </SpellEditSection>

                <SpellEditSection title="Privacidad y campañas">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={viewSpell.esPublico === false}
                      onChange={(event) =>
                        updateDraftField('esPublico', !event.target.checked)
                      }
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                    Privado
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {campaigns.map((campaign) => {
                      const active = (viewSpell.campanas || []).some(
                        (item) => item.id === campaign.id
                      )

                      return (
                        <button
                          key={campaign.id}
                          type="button"
                          onClick={() => toggleCampaign(campaign.id)}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-left text-xs font-bold transition',
                            active
                              ? 'border-brand bg-brand/15 text-brand'
                              : 'border-stroke bg-surface-strong text-ink-soft hover:border-brand hover:text-brand'
                          )}
                        >
                          {campaign.nombre}
                        </button>
                      )
                    })}
                  </div>
                </SpellEditSection>
              </div>
            ) : null}

            {!isEditing ? (
              <>
                <div className="mt-7 grid gap-3 md:grid-cols-3">
                  <InfoTile
                    title="Casteo"
                    value={spell.tipoCasteo || 'No indicado'}
                  />
                  <InfoTile
                    title="Alcance"
                    value={
                      spell.alcancePies
                        ? `${spell.alcancePies} pies`
                        : 'No indicado'
                    }
                  />
                  <InfoTile
                    title="Duración"
                    value={
                      spell.duracionPersonalizada ||
                      spell.duracion ||
                      'No indicada'
                    }
                  />
                </div>

                <div className="mt-6 rounded-xl border border-stroke bg-white p-4">
                  <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                    Componentes
                  </p>
                  <div className="mt-3 grid items-start gap-3 md:grid-cols-4">
                    <ComponentBadge active={components.verbal} label="Verbal" />
                    <ComponentBadge
                      active={components.somatico}
                      label="Somático"
                    />
                    <ComponentBadge
                      active={Boolean(components.material)}
                      label="Material"
                      detail={components.material}
                    />
                    <ComponentBadge
                      active={spell.concentracion}
                      label="Concentración"
                      detail={spell.concentracion ? 'S\u00ed' : 'No'}
                    />
                  </div>
                  {components.consumeMaterial ? (
                    <p className="mt-3 text-sm font-semibold text-brand">
                      El material se consume al lanzar el hechizo.
                    </p>
                  ) : null}
                </div>

                <div className="theme-sheet-copy mt-8 whitespace-pre-line text-base leading-8 text-ink-soft">
                  <WikiText
                    text={viewSpell.descripcion}
                    emptyText="Este hechizo no tiene descripción registrada."
                  />
                </div>

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <TagList title="Clases" items={spell.clases} />
                  <TagList title="Daño" items={spell.tiposDano} />
                  <TagList title="Condiciones" items={spell.condiciones} />
                  <TagList title="Miscelánea" items={spell.miscelanea} />
                  <TagList
                    title="Criaturas afectadas"
                    items={spell.criaturasAfectadas}
                  />
                </div>

                <div className="hidden">
                  <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                    Información técnica
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <InfoTile title="Tipo de ataque" value={spell.tipoAtaque} />
                    <InfoTile title="Salvación" value={spell.tipoSalvacion} />
                    <InfoTile title="Prueba" value={spell.pruebaHabilidad} />
                    <InfoTile title="Rango" value={spell.rango} />
                    <InfoTile title="Área" value={spell.estiloArea} />
                    <InfoTile
                      title="Visibilidad"
                      value={spell.esPublico ? 'Público' : 'Privado'}
                    />
                    <InfoTile title="Origen" value={spell.origen} />
                    <InfoTile title="Fuente" value={spell.fuente} />
                    <InfoTile
                      title="Creado"
                      value={
                        spell.creadoEn
                          ? new Date(spell.creadoEn).toLocaleDateString()
                          : null
                      }
                    />
                  </div>
                  {spell.descripcionHtml ? (
                    <div className="mt-5 rounded-xl border border-stroke bg-white p-4">
                      <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                        Información enriquecida
                      </p>
                      <div className="mt-2 whitespace-pre-line text-sm leading-7 text-ink-soft">
                        {spell.descripcionHtml}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {createMode || spell.puedeEditar ? (
                isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => updateMutation.mutate()}
                      disabled={
                        updateMutation.isPending || !draft?.nombre?.trim()
                      }
                      className="theme-solid-button inline-flex items-center gap-2 rounded-xl px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {createMode ? 'Crear' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.removeItem(draftKey)
                        window.localStorage.removeItem(reloadKey)
                        if (createMode) {
                          handleBack()
                        } else {
                          setDraft(spell)
                          setIsEditing(false)
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-stroke px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft"
                    >
                      <X className="h-4 w-4" />
                      {createMode ? 'Descartar' : 'Cancelar'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="theme-solid-button inline-flex items-center gap-2 rounded-xl px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteStep(1)}
                      className="inline-flex items-center gap-2 rounded-xl border border-danger/40 px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </>
                )
              ) : null}
            </div>

            {!createMode ? (
              <div className="min-w-0 text-right">
                {spell.creadoPor ? (
                  <Link
                    to={`/app/perfiles/${spell.creadoPor.id}`}
                    className="inline-flex items-center gap-3 rounded-xl border border-stroke bg-surface px-4 py-3 text-left transition hover:border-brand/50"
                  >
                    {spell.creadoPor.imagenPerfilUrl ? (
                      <img
                        src={spell.creadoPor.imagenPerfilUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 font-label text-[11px] font-black text-brand">
                        {String(spell.creadoPor.nombreUsuario || 'U')
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                    <span>
                      <span className="block font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                        Creador
                      </span>
                      <span className="block text-sm font-bold text-ink">
                        {spell.creadoPor.nombreUsuario}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="inline-flex rounded-xl border border-stroke bg-surface px-4 py-3 text-left">
                    <span>
                      <span className="block font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                        Creador
                      </span>
                      <span className="block text-sm font-bold text-ink">
                        Sistema
                      </span>
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </article>
      {deleteStep ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
          <div className="w-full max-w-md rounded-3xl border border-stroke bg-white p-6 shadow-card">
            {deleteStep === 1 ? (
              <>
                <h2 className="font-display text-2xl font-bold text-ink">
                  ¿Eliminar hechizo?
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink-soft">
                  Esta acción eliminará el hechizo y sus vínculos con
                  personajes, objetos, campañas y guardados.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(0)}
                    className="rounded-xl border border-stroke px-4 py-2 text-sm font-bold text-ink-soft"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="rounded-xl bg-danger px-4 py-2 text-sm font-bold text-white"
                  >
                    Sí, continuar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-bold text-ink">
                  Confirmación final
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink-soft">
                  Escribe <strong>ELIMINAR</strong> para borrar el hechizo.
                </p>
                <input
                  value={deleteText}
                  onChange={(event) => setDeleteText(event.target.value)}
                  className="archive-input mt-4 w-full rounded-xl"
                  placeholder="ELIMINAR"
                />
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteStep(0)
                      setDeleteText('')
                    }}
                    className="rounded-xl border border-stroke px-4 py-2 text-sm font-bold text-ink-soft"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate()}
                    disabled={
                      deleteText !== 'ELIMINAR' || deleteMutation.isPending
                    }
                    className="rounded-xl bg-danger px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
