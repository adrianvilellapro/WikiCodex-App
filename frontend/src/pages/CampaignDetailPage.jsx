import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  ImagePlus,
  Lock,
  MapPinned,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
import { useIncrementalCardFeed } from '../hooks/useIncrementalCardFeed'
import { cn } from '../lib/cn'
import { ACCEPTED_IMAGE_INPUT_TYPES } from '../lib/image-upload'
import {
  PublicProfileCharacterCard,
  PublicProfileObjectCard,
  PublicProfilePlaceCard,
} from './public-profile/components'
import {
  addCampaignPlayer,
  createCampaign,
  createCampaignNarrative,
  deleteCampaignNarrative,
  fetchCampaignCharacters,
  fetchCampaignDetail,
  fetchCampaignObjects,
  fetchCampaignPlaces,
  fetchCampaignPowers,
  fetchCampaignSpells,
  fetchCampaignUserOptions,
  removeCampaignPlayer,
  signAndUploadCampaignImage,
  updateCampaign,
  updateCampaignNarrative,
} from './campaign-detail/api'

const EMPTY_ITEMS = Object.freeze([])
const DRAFT_PREFIX = 'wikicodex:campaign-editor:draft'
const RELOAD_PREFIX = 'wikicodex:campaign-editor:reload'

const EMPTY_CAMPAIGN_FORM = {
  nombre: '',
  descripcion: '',
  imagenUrl: '',
  privacidadModo: 'publica',
}

const EMPTY_ARC_FORM = {
  nombre: '',
  descripcion: '',
  imagenUrl: '',
  aventuraId: '',
  fechaInicio: '',
  fechaFin: '',
}

const EMPTY_SESSION_FORM = {
  nombre: '',
  descripcion: '',
  imagenUrl: '',
  aventuraId: '',
  arcoId: '',
  jugadaEn: new Date().toISOString().slice(0, 10),
}

const NARRATIVE_CONFIG = {
  adventures: {
    title: 'Aventuras',
    singular: 'aventura',
    emptyForm: EMPTY_CAMPAIGN_FORM,
    icon: BookOpen,
  },
  arcs: {
    title: 'Arcos',
    singular: 'arco',
    emptyForm: EMPTY_ARC_FORM,
    icon: Swords,
  },
  sessions: {
    title: 'Partidas',
    singular: 'partida',
    emptyForm: EMPTY_SESSION_FORM,
    icon: CalendarDays,
  },
}

function storageKey(id) {
  return `${DRAFT_PREFIX}:${id || 'nuevo'}`
}

function reloadKey(id) {
  return `${RELOAD_PREFIX}:${id || 'nuevo'}`
}

function safeParse(value, fallback = null) {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function readDraft(id) {
  if (typeof window === 'undefined') {
    return {}
  }

  return safeParse(window.localStorage.getItem(storageKey(id)), {}) || {}
}

function readDraftSection(id, section, fallback = null) {
  return readDraft(id)?.[section] ?? fallback
}

function writeDraftSection(id, section, value) {
  if (typeof window === 'undefined') {
    return
  }

  const draft = readDraft(id)
  window.localStorage.setItem(
    storageKey(id),
    JSON.stringify({ ...draft, [section]: value })
  )
}

function clearDraft(id) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(storageKey(id))
  window.sessionStorage.removeItem(reloadKey(id))
}

function createDraftId(prefix = 'draft') {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}:${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function markReload(id) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(reloadKey(id), '1')
}

function consumeReload(id) {
  if (typeof window === 'undefined') {
    return false
  }

  const key = reloadKey(id)
  const shouldResume = window.sessionStorage.getItem(key) === '1'
  window.sessionStorage.removeItem(key)
  return shouldResume
}

function dateInputValue(value) {
  if (!value) {
    return ''
  }

  return String(value).slice(0, 10)
}

function campaignToForm(campaign) {
  return {
    nombre: campaign?.nombre || '',
    descripcion: campaign?.descripcion || '',
    imagenUrl: campaign?.imagenUrl || '',
    privacidadModo: campaign?.privacidad?.codigo || 'publica',
  }
}

function itemToForm(item, type) {
  if (!item) {
    return { ...NARRATIVE_CONFIG[type].emptyForm }
  }

  if (type === 'arcs') {
    return {
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      imagenUrl: item.imagenUrl || '',
      aventuraId: item.aventuraId || '',
      fechaInicio: dateInputValue(item.fechaInicio),
      fechaFin: dateInputValue(item.fechaFin),
    }
  }

  if (type === 'sessions') {
    return {
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      imagenUrl: item.imagenUrl || '',
      aventuraId: item.aventuraId || '',
      arcoId: item.arcoId || '',
      jugadaEn: dateInputValue(item.jugadaEn) || EMPTY_SESSION_FORM.jugadaEn,
    }
  }

  return {
    nombre: item.nombre || '',
    descripcion: item.descripcion || '',
    imagenUrl: item.imagenUrl || '',
    privacidadModo: 'publica',
  }
}

function normalizePayload(form) {
  return {
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim() || null,
    imagenUrl: form.imagenUrl || null,
  }
}

function normalizeCampaignPayload(form) {
  return {
    ...normalizePayload(form),
    privacidadCodigo: form.privacidadModo || 'publica',
  }
}

function normalizeArcPayload(form) {
  return {
    ...normalizePayload(form),
    aventuraId: form.aventuraId || null,
    fechaInicio: form.fechaInicio || null,
    fechaFin: form.fechaFin || null,
  }
}

function normalizeSessionPayload(form) {
  return {
    ...normalizePayload(form),
    aventuraId: form.aventuraId || null,
    arcoId: form.arcoId || null,
    jugadaEn: form.jugadaEn || EMPTY_SESSION_FORM.jugadaEn,
  }
}

function hydrateDraftNarrativeItem(type, payload, currentDraft) {
  const item = {
    ...payload,
    id: createDraftId(type),
    campanaId: null,
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  }

  if (type === 'arcs') {
    item.aventura = payload.aventuraId
      ? currentDraft.adventures.find(
          (adventure) => adventure.id === payload.aventuraId
        ) || null
      : null
    item.totalPartidas = 0
  }

  if (type === 'sessions') {
    item.arco = payload.arcoId
      ? currentDraft.arcs.find((arc) => arc.id === payload.arcoId) || null
      : null
    item.aventura = payload.aventuraId
      ? currentDraft.adventures.find(
          (adventure) => adventure.id === payload.aventuraId
        ) || null
      : item.arco?.aventura || null
  }

  if (type === 'adventures') {
    item.totalArcos = 0
    item.totalPartidas = 0
  }

  return item
}

function refreshDraftNarrativeRelations(draft) {
  return {
    adventures: draft.adventures || [],
    arcs: (draft.arcs || []).map((arc) => ({
      ...arc,
      aventura: arc.aventuraId
        ? (draft.adventures || []).find(
            (adventure) => adventure.id === arc.aventuraId
          ) || null
        : null,
    })),
    sessions: (draft.sessions || []).map((session) => {
      const arc = session.arcoId
        ? (draft.arcs || []).find((item) => item.id === session.arcoId) || null
        : null
      const adventure = session.aventuraId
        ? (draft.adventures || []).find(
            (item) => item.id === session.aventuraId
          ) || null
        : arc?.aventura || null

      return {
        ...session,
        arco: arc,
        aventura: adventure,
      }
    }),
  }
}

function normalizeNarrativePayload(form, type) {
  if (type === 'arcs') {
    return normalizeArcPayload(form)
  }

  if (type === 'sessions') {
    return normalizeSessionPayload(form)
  }

  return normalizePayload(form)
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function InfoPill({ label, value, icon: Icon }) {
  return (
    <div className="theme-sheet-soft rounded-xl border border-stroke/70 px-4 py-3 shadow-card">
      <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-ink-muted">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
        {Icon ? <Icon className="h-5 w-5 text-brand" /> : null}
        {value}
      </div>
    </div>
  )
}

function FormField({ label, children, className }) {
  return (
    <label className={cn('grid gap-2', className)}>
      <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10',
        props.className
      )}
    />
  )
}

function TextArea(props) {
  return (
    <WikiTextArea
      {...props}
      className={cn(
        'min-h-32 w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-semibold leading-6 text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10',
        props.className
      )}
    />
  )
}

function SelectInput(props) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10',
        props.className
      )}
    />
  )
}

function ImageUploadField({
  label,
  value,
  onChange,
  campaignId,
  entityType,
  disabled = false,
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setIsUploading(true)
    setError('')

    try {
      const uploadedUrl = await signAndUploadCampaignImage({
        file,
        campaignId,
        entityType,
      })
      onChange(uploadedUrl)
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, 'No se pudo subir la imagen.'))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="grid gap-3">
      <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </span>
      <div className="overflow-hidden rounded-xl border border-stroke bg-surface shadow-card">
        <div className="relative h-56 bg-surface-strong">
          {value ? (
            <CloudinaryImage
              src={value}
              alt={label}
              variant="detail"
              sizes="(min-width: 1024px) 640px, 100vw"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
              <ImagePlus className="h-12 w-12" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-stroke/70 bg-white px-4 py-3">
          <label className="theme-solid-button inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition">
            <ImagePlus className="h-4 w-4" />
            {isUploading ? 'Subiendo...' : 'Subir imagen'}
            <input
              type="file"
              accept={ACCEPTED_IMAGE_INPUT_TYPES}
              disabled={disabled || isUploading}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled || isUploading}
              className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-danger hover:text-danger disabled:opacity-45"
            >
              <X className="h-4 w-4" />
              Quitar imagen
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="text-sm font-semibold text-danger">{error}</p>
      ) : null}
    </div>
  )
}

function CollapsiblePanel({
  title,
  eyebrow,
  icon: Icon,
  count,
  children,
  defaultOpen = false,
  className,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <article className={cn('panel overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full flex-col gap-3 px-6 py-5 text-left sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          {eyebrow ? (
            <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 inline-flex items-center gap-3 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
            {Icon ? <Icon className="h-6 w-6 text-brand" /> : null}
            {title}
            <ChevronDown
              className={cn(
                'h-5 w-5 text-brand transition',
                open && 'rotate-180'
              )}
            />
          </h2>
        </div>
        {count !== undefined ? (
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="border-t border-stroke/70 px-6 py-5">{children}</div>
      ) : null}
    </article>
  )
}

function CampaignCoreForm({
  initialCampaign,
  isSaving,
  onSubmit,
  draftId,
  campaignId,
  formId,
}) {
  const [form, setForm] = useState(
    () =>
      readDraftSection(draftId, 'core', null) || campaignToForm(initialCampaign)
  )

  useEffect(() => {
    writeDraftSection(draftId, 'core', form)
  }, [draftId, form])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit(normalizeCampaignPayload(form))
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="grid gap-6">
      <section className="panel p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-5">
            <FormField label="Nombre de la campaña">
              <TextInput
                value={form.nombre}
                onChange={(event) => updateField('nombre', event.target.value)}
                placeholder="Nombre de la campaña"
                required
                className="font-display text-3xl font-black tracking-[-0.06em]"
              />
            </FormField>
            <FormField label="Descripción">
              <TextArea
                value={form.descripcion}
                onChange={(event) =>
                  updateField('descripcion', event.target.value)
                }
                placeholder="Describe el tono, la premisa o el estado de la campaña."
              />
            </FormField>
          </div>

          <ImageUploadField
            label="Imagen de campaña"
            value={form.imagenUrl}
            onChange={(value) => updateField('imagenUrl', value)}
            campaignId={campaignId}
            entityType="campana"
            disabled={isSaving}
          />
        </div>
      </section>

      <CollapsiblePanel
        title="Privacidad"
        eyebrow="Visibilidad"
        icon={Shield}
        count="Plegado por defecto"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label
            className={cn(
              'rounded-xl border p-4 transition',
              form.privacidadModo === 'publica'
                ? 'border-brand bg-brand/10'
                : 'border-stroke bg-surface-strong'
            )}
          >
            <input
              type="radio"
              checked={form.privacidadModo === 'publica'}
              onChange={() => updateField('privacidadModo', 'publica')}
              className="mr-2"
            />
            <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
              Pública
            </span>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              La campaña aparece para otros usuarios. Los personajes, objetos y
              lugares siguen respetando su propia privacidad.
            </p>
          </label>
          <label
            className={cn(
              'rounded-xl border p-4 transition',
              form.privacidadModo === 'privada'
                ? 'border-brand bg-brand/10'
                : 'border-stroke bg-surface-strong'
            )}
          >
            <input
              type="radio"
              checked={form.privacidadModo === 'privada'}
              onChange={() => updateField('privacidadModo', 'privada')}
              className="mr-2"
            />
            <span className="inline-flex items-center gap-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
              <Lock className="h-4 w-4" />
              Privada
            </span>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Solo master, administradores y jugadores pueden ver la campaña y
              cualquier contenido que dependa únicamente de ella.
            </p>
          </label>
        </div>
      </CollapsiblePanel>
    </form>
  )
}

function CampaignEditorActions({
  formId,
  submitText,
  isSaving,
  onCancel,
  className,
}) {
  return (
    <div
      className={cn('panel flex flex-wrap justify-start gap-3 p-5', className)}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="inline-flex items-center gap-2 rounded-md border border-stroke bg-surface-strong px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
      >
        <X className="h-4 w-4" />
        Cancelar
      </button>
      <button
        type="submit"
        form={formId}
        disabled={isSaving}
        className="theme-solid-button inline-flex items-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Check className="h-4 w-4" />
        {isSaving ? 'Guardando...' : submitText}
      </button>
    </div>
  )
}

function PlayersPanel({
  detail,
  users,
  editable,
  selectedUserId,
  setSelectedUserId,
  onAdd,
  onRemove,
  isSaving,
}) {
  const playerIds = new Set(
    (detail.jugadores || []).map((item) => item.usuarioId)
  )
  const candidates = users.filter(
    (user) => user.id !== detail.item.masterUsuarioId && !playerIds.has(user.id)
  )

  return (
    <CollapsiblePanel
      title="Jugadores"
      eyebrow="Mesa"
      icon={Users}
      count={`${detail.jugadores?.length || 0} jugadores`}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <PlayerCard
            user={detail.item.master}
            roleLabel="Master principal"
            linkProfile={!editable}
            locked
          />
          {(detail.jugadores || []).map((membership) => (
            <PlayerCard
              key={membership.id}
              user={membership.usuario}
              roleLabel="Jugador"
              editable={editable}
              linkProfile={!editable}
              onRemove={() => onRemove(membership.usuarioId)}
              disabled={isSaving}
            />
          ))}
        </div>

        {editable ? (
          <div className="grid gap-3 rounded-xl border border-stroke/70 bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <SelectInput
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              <option value="">Selecciona un usuario para añadir</option>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombreUsuario}
                </option>
              ))}
            </SelectInput>
            <button
              type="button"
              onClick={onAdd}
              disabled={!selectedUserId || isSaving}
              className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Users className="h-4 w-4" />
              Añadir jugador
            </button>
          </div>
        ) : null}
      </div>
    </CollapsiblePanel>
  )
}

function DraftPlayersPanel({
  users,
  selectedUserId,
  setSelectedUserId,
  selectedPlayerIds,
  setSelectedPlayerIds,
  isSaving,
}) {
  const selectedIds = new Set(selectedPlayerIds)
  const selectedUsers = users.filter((user) => selectedIds.has(user.id))
  const candidates = users.filter((user) => !selectedIds.has(user.id))

  function addSelectedPlayer() {
    if (!selectedUserId || selectedIds.has(selectedUserId)) {
      return
    }

    setSelectedPlayerIds((current) => [...current, selectedUserId])
    setSelectedUserId('')
  }

  function removeSelectedPlayer(userId) {
    setSelectedPlayerIds((current) => current.filter((id) => id !== userId))
  }

  return (
    <CollapsiblePanel
      title="Jugadores"
      eyebrow="Mesa"
      icon={Users}
      count={`${selectedUsers.length} jugadores preparados`}
    >
      <div className="grid gap-4">
        {selectedUsers.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selectedUsers.map((user) => (
              <PlayerCard
                key={user.id}
                user={user}
                roleLabel="Jugador preparado"
                editable
                onRemove={() => removeSelectedPlayer(user.id)}
                disabled={isSaving}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stroke bg-white/70 px-5 py-6 text-sm text-ink-soft">
            Todavía no has preparado jugadores para esta campaña.
          </div>
        )}

        <div className="grid gap-3 rounded-xl border border-stroke/70 bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <SelectInput
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            <option value="">Selecciona un usuario para añadir</option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.nombreUsuario}
              </option>
            ))}
          </SelectInput>
          <button
            type="button"
            onClick={addSelectedPlayer}
            disabled={!selectedUserId || isSaving}
            className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Users className="h-4 w-4" />
            Añadir jugador
          </button>
        </div>
      </div>
    </CollapsiblePanel>
  )
}

function PlayerCard({
  user,
  roleLabel,
  editable,
  linkProfile,
  locked,
  onRemove,
  disabled,
}) {
  const avatar = (
    <div className="h-14 w-14 overflow-hidden rounded-full border border-stroke bg-surface-strong">
      {user?.imagenPerfilUrl ? (
        <CloudinaryImage
          src={user.imagenPerfilUrl}
          alt={user.nombreUsuario}
          variant="avatar"
          sizes="56px"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
          <UserRound className="h-7 w-7" />
        </div>
      )}
    </div>
  )

  return (
    <article className="flex items-center gap-4 rounded-xl border border-stroke/70 bg-white p-4 shadow-card">
      {linkProfile && user?.id ? (
        <Link
          to={`/app/perfiles/${user.id}`}
          className="rounded-full outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={`Ver perfil publico de ${user.nombreUsuario}`}
        >
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-bold tracking-[-0.04em] text-ink">
          {user?.nombreUsuario || 'Usuario'}
        </p>
        <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
          {roleLabel}
        </p>
      </div>
      {editable && !locked ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded-md border border-danger/40 p-2 text-danger transition hover:bg-danger hover:text-white disabled:opacity-45"
          aria-label="Sacar jugador"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </article>
  )
}

function NarrativeForm({
  type,
  form,
  setForm,
  onSubmit,
  onCancel,
  isSaving,
  adventures,
  arcs,
  campaignId,
  submitText,
}) {
  const config = NARRATIVE_CONFIG[type]

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function handleArcChange(value) {
    const selectedArc = arcs.find((arc) => arc.id === value)
    setForm((current) => ({
      ...current,
      arcoId: value,
      aventuraId: selectedArc?.aventuraId || current.aventuraId,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit(normalizeNarrativePayload(form, type))
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 rounded-xl border border-stroke/70 bg-surface p-4"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          <FormField label={`Nombre de ${config.singular}`}>
            <TextInput
              value={form.nombre || ''}
              onChange={(event) => updateField('nombre', event.target.value)}
              required
            />
          </FormField>
          <FormField label="Descripción">
            <TextArea
              value={form.descripcion || ''}
              onChange={(event) =>
                updateField('descripcion', event.target.value)
              }
            />
          </FormField>

          {type === 'arcs' ? (
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Aventura">
                <SelectInput
                  value={form.aventuraId || ''}
                  onChange={(event) =>
                    updateField('aventuraId', event.target.value)
                  }
                >
                  <option value="">Arco principal de campaña</option>
                  {adventures.map((adventure) => (
                    <option key={adventure.id} value={adventure.id}>
                      {adventure.nombre}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Fecha inicio">
                <TextInput
                  type="date"
                  value={form.fechaInicio || ''}
                  onChange={(event) =>
                    updateField('fechaInicio', event.target.value)
                  }
                />
              </FormField>
              <FormField label="Fecha fin">
                <TextInput
                  type="date"
                  value={form.fechaFin || ''}
                  onChange={(event) =>
                    updateField('fechaFin', event.target.value)
                  }
                />
              </FormField>
            </div>
          ) : null}

          {type === 'sessions' ? (
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Aventura">
                <SelectInput
                  value={form.aventuraId || ''}
                  onChange={(event) =>
                    updateField('aventuraId', event.target.value)
                  }
                >
                  <option value="">Sin aventura directa</option>
                  {adventures.map((adventure) => (
                    <option key={adventure.id} value={adventure.id}>
                      {adventure.nombre}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Arco">
                <SelectInput
                  value={form.arcoId || ''}
                  onChange={(event) => handleArcChange(event.target.value)}
                >
                  <option value="">Sin arco</option>
                  {arcs.map((arc) => (
                    <option key={arc.id} value={arc.id}>
                      {arc.nombre}
                      {arc.aventura?.nombre ? ` (${arc.aventura.nombre})` : ''}
                    </option>
                  ))}
                </SelectInput>
              </FormField>
              <FormField label="Fecha de partida">
                <TextInput
                  type="date"
                  value={form.jugadaEn || EMPTY_SESSION_FORM.jugadaEn}
                  onChange={(event) =>
                    updateField('jugadaEn', event.target.value)
                  }
                />
              </FormField>
            </div>
          ) : null}
        </div>

        <ImageUploadField
          label={`Imagen de ${config.singular}`}
          value={form.imagenUrl || ''}
          onChange={(value) => updateField('imagenUrl', value)}
          campaignId={campaignId}
          entityType={config.singular}
          disabled={isSaving}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-danger hover:text-danger disabled:opacity-45"
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSaving || !form.nombre?.trim()}
          className="theme-solid-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Check className="h-4 w-4" />
          {isSaving ? 'Guardando...' : submitText}
        </button>
      </div>
    </form>
  )
}

function NarrativeManager({
  type,
  items,
  adventures,
  arcs,
  campaignId,
  draftId,
  editable,
  onCreate,
  onUpdate,
  onDelete,
  isSaving,
}) {
  const config = NARRATIVE_CONFIG[type]
  const Icon = config.icon
  const [createForm, setCreateForm] = useState(
    () =>
      readDraftSection(draftId, `${type}:create`, null) || {
        ...config.emptyForm,
      }
  )
  const [editingId, setEditingId] = useState(
    () => readDraftSection(draftId, `${type}:editingId`, '') || ''
  )
  const [editingForms, setEditingForms] = useState(
    () => readDraftSection(draftId, `${type}:editingForms`, {}) || {}
  )

  useEffect(() => {
    writeDraftSection(draftId, `${type}:create`, createForm)
  }, [createForm, draftId, type])

  useEffect(() => {
    writeDraftSection(draftId, `${type}:editingId`, editingId)
  }, [draftId, editingId, type])

  useEffect(() => {
    writeDraftSection(draftId, `${type}:editingForms`, editingForms)
  }, [draftId, editingForms, type])

  function startEditing(item) {
    setEditingId(item.id)
    setEditingForms((current) => ({
      ...current,
      [item.id]: current[item.id] || itemToForm(item, type),
    }))
  }

  function cancelEditing(itemId) {
    setEditingId('')
    setEditingForms((current) => {
      const next = { ...current }
      delete next[itemId]
      return next
    })
  }

  return (
    <CollapsiblePanel
      title={config.title}
      eyebrow="Cronología"
      icon={Icon}
      count={`${items.length} registros`}
    >
      <div className="grid gap-5">
        {editable ? (
          <NarrativeForm
            type={type}
            form={createForm}
            setForm={setCreateForm}
            adventures={adventures}
            arcs={arcs}
            campaignId={campaignId}
            isSaving={isSaving}
            submitText={`Crear ${config.singular}`}
            onSubmit={(payload) =>
              onCreate(type, payload, () =>
                setCreateForm({ ...config.emptyForm })
              )
            }
          />
        ) : null}

        <div className="grid gap-3">
          {items.length ? (
            items.map((item) => {
              const isEditingItem = editingId === item.id
              const editingForm =
                editingForms[item.id] || itemToForm(item, type)

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-stroke/70 bg-white p-4 shadow-card"
                >
                  {isEditingItem ? (
                    <NarrativeForm
                      type={type}
                      form={editingForm}
                      setForm={(updater) =>
                        setEditingForms((current) => ({
                          ...current,
                          [item.id]:
                            typeof updater === 'function'
                              ? updater(current[item.id] || editingForm)
                              : updater,
                        }))
                      }
                      adventures={adventures}
                      arcs={arcs}
                      campaignId={campaignId}
                      isSaving={isSaving}
                      submitText={`Guardar ${config.singular}`}
                      onCancel={() => cancelEditing(item.id)}
                      onSubmit={(payload) =>
                        onUpdate(type, item.id, payload, () =>
                          cancelEditing(item.id)
                        )
                      }
                    />
                  ) : (
                    <NarrativeCard
                      item={item}
                      type={type}
                      editable={editable}
                      onEdit={() => startEditing(item)}
                      onDelete={() => onDelete(type, item.id)}
                      isSaving={isSaving}
                    />
                  )}
                </article>
              )
            })
          ) : (
            <div className="rounded-xl border border-dashed border-stroke bg-white/70 px-5 py-8 text-sm text-ink-soft">
              Todavía no hay {config.title.toLowerCase()} en esta campaña.
            </div>
          )}
        </div>
      </div>
    </CollapsiblePanel>
  )
}

function NarrativeCard({ item, type, editable, onEdit, onDelete, isSaving }) {
  const meta = []

  if (type === 'arcs' && item.aventura?.nombre) {
    meta.push(`Aventura: ${item.aventura.nombre}`)
  }

  if (type === 'sessions') {
    if (item.arco?.nombre) {
      meta.push(`Arco: ${item.arco.nombre}`)
    }
    if (item.aventura?.nombre) {
      meta.push(`Aventura: ${item.aventura.nombre}`)
    }
    if (item.jugadaEn) {
      meta.push(dateInputValue(item.jugadaEn))
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
      <NarrativeThumb item={item} />
      <div className="min-w-0">
        <h3 className="font-display text-xl font-bold tracking-[-0.05em] text-ink">
          {item.nombre}
        </h3>
        {meta.length ? (
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-brand">
            {meta.join(' · ')}
          </p>
        ) : null}
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-soft">
          <WikiText
            text={item.descripcion}
            emptyText="Sin descripción registrada."
          />
        </p>
      </div>
      {editable ? (
        <div className="flex gap-2 sm:flex-col">
          <button
            type="button"
            onClick={onEdit}
            disabled={isSaving}
            className="rounded-md border border-stroke p-2 text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-45"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving}
            className="rounded-md border border-danger/40 p-2 text-danger transition hover:bg-danger hover:text-white disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function NarrativeThumb({ item }) {
  return (
    <div className="h-28 overflow-hidden rounded-lg border border-stroke bg-surface-strong">
      {item.imagenUrl ? (
        <CloudinaryImage
          src={item.imagenUrl}
          alt={item.nombre}
          variant="card"
          sizes="120px"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
          <BookOpen className="h-8 w-8" />
        </div>
      )}
    </div>
  )
}

function NarrativeOverview({ detail }) {
  const [sessionOrder, setSessionOrder] = useState('desc')
  const [selectedSession, setSelectedSession] = useState(null)
  const adventures = detail.aventuras || []
  const arcs = detail.arcos || []
  const sessions = detail.partidas || []

  function sortSessions(items = []) {
    return [...items].sort((left, right) => {
      const leftTime = new Date(
        left.jugadaEn || left.creadoEn || '1970-01-01'
      ).getTime()
      const rightTime = new Date(
        right.jugadaEn || right.creadoEn || '1970-01-01'
      ).getTime()
      const diff =
        rightTime - leftTime || String(right.id).localeCompare(left.id)
      return sessionOrder === 'desc' ? diff : -diff
    })
  }

  const sessionsByArc = new Map()
  const sessionsByAdventure = new Map()
  const looseSessions = []

  sessions.forEach((session) => {
    if (session.arcoId) {
      const list = sessionsByArc.get(session.arcoId) || []
      list.push(session)
      sessionsByArc.set(session.arcoId, list)
      return
    }

    if (session.aventuraId) {
      const list = sessionsByAdventure.get(session.aventuraId) || []
      list.push(session)
      sessionsByAdventure.set(session.aventuraId, list)
      return
    }

    looseSessions.push(session)
  })

  const mainArcs = arcs.filter((arc) => !arc.aventuraId)

  return (
    <CollapsiblePanel
      title="Aventuras, arcos y partidas"
      eyebrow="Cronología"
      icon={BookOpen}
      count={`${arcs.length + adventures.length + sessions.length} registros`}
    >
      <div className="grid gap-5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() =>
              setSessionOrder((current) =>
                current === 'desc' ? 'asc' : 'desc'
              )
            }
            className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
          >
            {sessionOrder === 'desc' ? (
              <ArrowDown className="h-4 w-4" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
            {sessionOrder === 'desc' ? 'Descendente' : 'Ascendente'}
          </button>
        </div>
        <section className="grid gap-3">
          <h3 className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
            Arcos principales
          </h3>
          {mainArcs.length ? (
            mainArcs.map((arc) => (
              <TimelineBlock
                key={arc.id}
                title={arc.nombre}
                description={arc.descripcion}
                imageUrl={arc.imagenUrl}
                items={sortSessions(sessionsByArc.get(arc.id) || [])}
                itemLabel="partidas"
                onSelectSession={setSelectedSession}
              />
            ))
          ) : (
            <EmptyTimeline text="No hay arcos principales todavía." />
          )}
        </section>

        <section className="grid gap-3">
          <h3 className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
            Aventuras
          </h3>
          {adventures.length ? (
            adventures.map((adventure) => {
              const adventureArcs = arcs.filter(
                (arc) => arc.aventuraId === adventure.id
              )
              const directSessions = sessionsByAdventure.get(adventure.id) || []

              return (
                <TimelineBlock
                  key={adventure.id}
                  title={adventure.nombre}
                  description={adventure.descripcion}
                  imageUrl={adventure.imagenUrl}
                  itemLabel="elementos"
                  items={sortSessions(directSessions)}
                  onSelectSession={setSelectedSession}
                >
                  {adventureArcs.length ? (
                    <div className="mt-4 grid gap-3">
                      {adventureArcs.map((arc) => (
                        <TimelineBlock
                          key={arc.id}
                          title={arc.nombre}
                          description={arc.descripcion}
                          imageUrl={arc.imagenUrl}
                          items={sortSessions(sessionsByArc.get(arc.id) || [])}
                          itemLabel="partidas"
                          onSelectSession={setSelectedSession}
                          nested
                        />
                      ))}
                    </div>
                  ) : null}
                </TimelineBlock>
              )
            })
          ) : (
            <EmptyTimeline text="No hay aventuras todavía." />
          )}
        </section>

        {looseSessions.length ? (
          <section className="grid gap-3">
            <h3 className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
              Partidas sin asignar
            </h3>
            <div className="grid gap-3">
              {sortSessions(looseSessions).map((session) => (
                <SessionMini
                  key={session.id}
                  session={session}
                  onSelect={setSelectedSession}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </CollapsiblePanel>
  )
}

function TimelineBlock({
  title,
  description,
  imageUrl,
  items,
  itemLabel,
  nested = false,
  onSelectSession,
  children,
}) {
  return (
    <details
      className={cn(
        'group overflow-hidden rounded-xl border border-stroke/70 bg-white shadow-card',
        nested && 'bg-surface'
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-stroke bg-surface-strong">
          {imageUrl ? (
            <CloudinaryImage
              src={imageUrl}
              alt={title}
              variant="card"
              sizes="64px"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
              <BookOpen className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-xl font-bold tracking-[-0.05em] text-ink">
            {title}
          </h4>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-brand">
            {(items?.length || 0) + (children ? 1 : 0)} {itemLabel}
          </p>
        </div>
        <ChevronDown className="h-5 w-5 text-brand transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-stroke/70 px-4 py-4">
        <p className="text-sm leading-6 text-ink-soft">
          <WikiText
            text={description}
            emptyText="Sin descripción registrada."
          />
        </p>
        {items?.length ? (
          <div className="mt-4 grid gap-3">
            {items.map((session) => (
              <SessionMini
                key={session.id}
                session={session}
                onSelect={onSelectSession}
              />
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </details>
  )
}

function SessionMini({ session }) {
  return (
    <Link
      to={`/app/campanas/${session.campanaId}/partidas/${session.id}`}
      className="grid w-full gap-3 rounded-lg border border-stroke/70 bg-surface px-4 py-3 text-left transition hover:border-brand hover:bg-brand/5 sm:grid-cols-[72px_minmax(0,1fr)]"
    >
      <div className="h-16 w-full overflow-hidden rounded-md border border-stroke bg-surface-strong sm:w-[72px]">
        {session.imagenUrl ? (
          <CloudinaryImage
            src={session.imagenUrl}
            alt={session.nombre}
            variant="card"
            sizes="72px"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
            <CalendarDays className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-display text-lg font-bold tracking-[-0.05em] text-ink">
          {session.nombre}
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-brand">
          {dateInputValue(session.jugadaEn) || 'Sin fecha'}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-ink-soft">
          <WikiText
            text={session.descripcion}
            emptyText="Sin descripción registrada."
            disableLinks
          />
        </p>
      </div>
    </Link>
  )
}

function SessionDetailModal({ session, onClose }) {
  if (!session) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6">
      <article className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-stroke bg-white shadow-2xl">
        <div className="relative min-h-56 bg-ink text-white">
          {session.imagenUrl ? (
            <CloudinaryImage
              src={session.imagenUrl}
              alt={session.nombre}
              variant="detail"
              sizes="768px"
              className="absolute inset-0 h-full w-full object-cover opacity-50"
            />
          ) : (
            <div className="theme-brand-gradient absolute inset-0 opacity-75" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white transition hover:border-brand hover:text-brand"
            aria-label="Cerrar partida"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative flex min-h-56 flex-col justify-end p-6">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.24em] text-brand">
              Ficha de partida
            </p>
            <h3 className="mt-2 font-display text-4xl font-black tracking-[-0.06em]">
              {session.nombre}
            </h3>
          </div>
        </div>
        <div className="grid gap-5 p-6">
          <div className="flex flex-wrap gap-2">
            <span className="archive-chip">
              {dateInputValue(session.jugadaEn) || 'Sin fecha'}
            </span>
            {session.aventura?.nombre ? (
              <span className="archive-chip">
                Aventura: {session.aventura.nombre}
              </span>
            ) : null}
            {session.arco?.nombre ? (
              <span className="archive-chip">Arco: {session.arco.nombre}</span>
            ) : null}
          </div>
          <p className="whitespace-pre-line text-sm leading-7 text-ink-soft">
            <WikiText
              text={session.descripcion}
              emptyText="Sin descripción registrada."
            />
          </p>
        </div>
      </article>
    </div>
  )
}

function CampaignSpellCard({ item }) {
  return (
    <Link
      to={`/app/poderes/hechizos/${item.id}`}
      className="group grid min-h-44 gap-3 rounded-lg border border-stroke bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-bold tracking-[-0.05em] text-ink transition group-hover:text-brand">
            {item.nombre}
          </p>
          <p className="mt-1 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand">
            {Number(item.nivel || 0) === 0 ? 'Truco' : `Nivel ${item.nivel}`}
          </p>
        </div>
        <BookOpen className="h-5 w-5 shrink-0 text-brand" />
      </div>
      <p className="line-clamp-3 text-sm leading-6 text-ink-soft">
        <WikiText
          text={item.descripcion}
          emptyText="Sin descripción registrada."
          disableLinks
        />
      </p>
      <div className="flex flex-wrap gap-2">
        {item.escuela ? (
          <span className="archive-chip">{item.escuela}</span>
        ) : null}
        {item.tipoCasteo ? (
          <span className="archive-chip">{item.tipoCasteo}</span>
        ) : null}
      </div>
    </Link>
  )
}

function CampaignPowerCard({ item }) {
  return (
    <Link
      to={`/app/poderes/otros/${item.id}`}
      className="group grid min-h-44 gap-3 rounded-lg border border-stroke bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-bold tracking-[-0.05em] text-ink transition group-hover:text-brand">
            {item.nombre}
          </p>
          <p className="mt-1 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand">
            Otro poder
          </p>
        </div>
        <Sparkles className="h-5 w-5 shrink-0 text-brand" />
      </div>
      <p className="line-clamp-3 text-sm leading-6 text-ink-soft">
        <WikiText
          text={item.descripcion}
          emptyText="Sin descripción registrada."
          disableLinks
        />
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
    </Link>
  )
}

function EmptyTimeline({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-stroke bg-white/70 px-5 py-6 text-sm text-ink-soft">
      {text}
    </div>
  )
}

function CampaignEntrySection({
  title,
  icon,
  items,
  shownCount,
  totalCount,
  canLoadMore,
  canLoadLess,
  isLoading,
  isFetchingMore,
  error,
  renderItem,
  open,
  onToggle,
  onLoadMore,
  onLoadLess,
  onLoadAll,
  onShowRecent,
  mobileThreeColumns = false,
}) {
  const SectionIcon = icon

  return (
    <article className="panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-3 px-6 py-6 text-left sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
            Contenido de campaña
          </p>
          <h2 className="mt-2 inline-flex items-center gap-3 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
            {SectionIcon ? (
              <SectionIcon className="h-6 w-6 text-brand" />
            ) : null}
            {title}
            <ChevronDown
              className={cn(
                'h-5 w-5 text-brand transition',
                open && 'rotate-180'
              )}
            />
          </h2>
        </div>
        <span className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
          {shownCount} mostrados de {totalCount}
        </span>
      </button>

      {open ? (
        <div className="border-t border-stroke/70 px-6 pb-6 pt-5">
          {error ? (
            <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <div
            className={cn(
              'grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-5',
              mobileThreeColumns ? 'grid-cols-3 gap-2' : 'grid-cols-1 gap-4'
            )}
          >
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-white p-2 opacity-45 shadow-card"
                >
                  <div className="h-72 rounded-md bg-surface-strong" />
                  <div className="space-y-2 px-2 pb-2 pt-4">
                    <div className="h-5 w-3/4 rounded bg-surface-strong" />
                    <div className="h-4 w-1/2 rounded bg-surface-strong" />
                  </div>
                </div>
              ))
            ) : items.length ? (
              items.map((item) => renderItem(item))
            ) : (
              <div className="col-span-full rounded-lg border border-stroke/70 bg-white/60 px-5 py-6 text-sm text-ink-soft">
                No hay {title.toLowerCase()} visibles dentro de esta campaña.
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={!canLoadMore || isLoading || isFetchingMore}
              className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronDown className="h-4 w-4" />
              Cargar 10 más
            </button>
            <button
              type="button"
              onClick={onLoadLess}
              disabled={!canLoadLess || isLoading || isFetchingMore}
              className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronUp className="h-4 w-4" />
              Cargar 10 menos
            </button>
            <button
              type="button"
              onClick={onLoadAll}
              disabled={!canLoadMore || isLoading || isFetchingMore}
              className="theme-solid-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isFetchingMore ? 'Cargando...' : 'Cargar todos'}
            </button>
            <button
              type="button"
              onClick={onShowRecent}
              disabled={!canLoadLess || isLoading || isFetchingMore}
              className="inline-flex items-center gap-2 rounded-md bg-surface-strong px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw className="h-4 w-4" />
              Mostrar solo 10 últimos
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function CampaignEntryGrid({
  items,
  renderItem,
  emptyText,
  mobileThreeColumns = false,
}) {
  return (
    <div
      className={cn(
        'grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-5',
        mobileThreeColumns ? 'grid-cols-3 gap-2' : 'grid-cols-1 gap-4'
      )}
    >
      {items.length ? (
        items.map((item) => renderItem(item))
      ) : (
        <div className="col-span-full rounded-lg border border-stroke/70 bg-white/60 px-5 py-6 text-sm text-ink-soft">
          {emptyText}
        </div>
      )}
    </div>
  )
}

function CampaignFeedControls({
  canLoadMore,
  canLoadLess,
  isLoading,
  isFetchingMore,
  onLoadMore,
  onLoadLess,
  onLoadAll,
  onShowRecent,
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={!canLoadMore || isLoading || isFetchingMore}
        className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ChevronDown className="h-4 w-4" />
        Cargar 10 más
      </button>
      <button
        type="button"
        onClick={onLoadLess}
        disabled={!canLoadLess || isLoading || isFetchingMore}
        className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ChevronUp className="h-4 w-4" />
        Cargar 10 menos
      </button>
      <button
        type="button"
        onClick={onLoadAll}
        disabled={!canLoadMore || isLoading || isFetchingMore}
        className="theme-solid-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isFetchingMore ? 'Cargando...' : 'Cargar todos'}
      </button>
      <button
        type="button"
        onClick={onShowRecent}
        disabled={!canLoadLess || isLoading || isFetchingMore}
        className="inline-flex items-center gap-2 rounded-md bg-surface-strong px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
      >
        <RotateCcw className="h-4 w-4" />
        Mostrar solo 10 últimos
      </button>
    </div>
  )
}

function CampaignGroupedEntrySection({
  title,
  icon,
  shownCount,
  totalCount,
  canLoadMore,
  canLoadLess,
  isLoading,
  isFetchingMore,
  error,
  open,
  onToggle,
  onLoadMore,
  onLoadLess,
  onLoadAll,
  onShowRecent,
  children,
}) {
  const SectionIcon = icon

  return (
    <article className="panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-3 px-6 py-6 text-left sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
            Contenido de campaña
          </p>
          <h2 className="mt-2 inline-flex items-center gap-3 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
            {SectionIcon ? (
              <SectionIcon className="h-6 w-6 text-brand" />
            ) : null}
            {title}
            <ChevronDown
              className={cn(
                'h-5 w-5 text-brand transition',
                open && 'rotate-180'
              )}
            />
          </h2>
        </div>
        <span className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
          {shownCount} mostrados de {totalCount}
        </span>
      </button>

      {open ? (
        <div className="grid gap-4 border-t border-stroke/70 px-4 pb-5 pt-4 sm:pl-10 sm:pr-6">
          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          {isLoading ? (
            <div className="rounded-lg bg-white p-2 opacity-45 shadow-card">
              <div className="h-72 rounded-md bg-surface-strong" />
              <div className="space-y-2 px-2 pb-2 pt-4">
                <div className="h-5 w-3/4 rounded bg-surface-strong" />
                <div className="h-4 w-1/2 rounded bg-surface-strong" />
              </div>
            </div>
          ) : (
            children
          )}
          <CampaignFeedControls
            canLoadMore={canLoadMore}
            canLoadLess={canLoadLess}
            isLoading={isLoading}
            isFetchingMore={isFetchingMore}
            onLoadMore={onLoadMore}
            onLoadLess={onLoadLess}
            onLoadAll={onLoadAll}
            onShowRecent={onShowRecent}
          />
        </div>
      ) : null}
    </article>
  )
}

function CampaignNestedContentSection({
  title,
  icon,
  count,
  open,
  onToggle,
  children,
}) {
  const SectionIcon = icon

  return (
    <article className="overflow-hidden rounded-2xl border border-stroke/70 bg-white/70 shadow-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-2 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
      >
        <h3 className="inline-flex min-w-0 items-center gap-3 font-display text-xl font-bold tracking-[-0.04em] text-ink">
          {SectionIcon ? (
            <SectionIcon className="h-5 w-5 shrink-0 text-brand" />
          ) : null}
          <span className="truncate">{title}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-brand transition',
              open && 'rotate-180'
            )}
          />
        </h3>
        <span className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
          {count} elemento{count === 1 ? '' : 's'}
        </span>
      </button>
      {open ? (
        <div className="border-t border-stroke/70 p-4">{children}</div>
      ) : null}
    </article>
  )
}

function buildCampaignTierGroups(items) {
  const groups = new Map()

  items
    .filter((item) => item.tier?.id)
    .forEach((item) => {
      const existing = groups.get(item.tier.id) || {
        tier: item.tier,
        items: [],
      }
      existing.items.push(item)
      groups.set(item.tier.id, existing)
    })

  return [...groups.values()].sort((left, right) => {
    const leftOrder = left.tier.ordenVisualizacion ?? 0
    const rightOrder = right.tier.ordenVisualizacion ?? 0
    return (
      rightOrder - leftOrder ||
      String(left.tier.nombre || '').localeCompare(
        String(right.tier.nombre || '')
      )
    )
  })
}

function CampaignTierListContentSection({
  groups,
  renderItem,
  emptyText,
  mobileThreeColumns = false,
}) {
  const [openTiers, setOpenTiers] = useState({})

  if (!groups.length) {
    return (
      <div className="rounded-lg border border-stroke/70 bg-white/60 px-5 py-6 text-sm text-ink-soft">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {groups.map((group) => {
        const key = group.tier.id
        const open = Boolean(openTiers[key])

        return (
          <CampaignNestedContentSection
            key={key}
            title={group.tier.nombre}
            icon={Sparkles}
            count={group.items.length}
            open={open}
            onToggle={() =>
              setOpenTiers((current) => ({
                ...current,
                [key]: !current[key],
              }))
            }
          >
            <CampaignEntryGrid
              items={group.items}
              renderItem={renderItem}
              emptyText={emptyText}
              mobileThreeColumns={mobileThreeColumns}
            />
          </CampaignNestedContentSection>
        )
      })}
    </div>
  )
}

function useScrollTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 520)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return visible
}

export function CampaignDetailPage({ createMode = false }) {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const draftId = createMode ? 'nuevo' : campaignId
  const [resumeFromReload] = useState(() => consumeReload(draftId))
  const [isEditing, setIsEditing] = useState(createMode || resumeFromReload)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [draftPlayerIds, setDraftPlayerIds] = useState(
    () => readDraftSection(draftId, 'players', []) || []
  )
  const [draftNarrative, setDraftNarrative] = useState(() =>
    refreshDraftNarrativeRelations(
      readDraftSection(draftId, 'narrative', {
        adventures: [],
        arcs: [],
        sessions: [],
      }) || {
        adventures: [],
        arcs: [],
        sessions: [],
      }
    )
  )
  const [mutationError, setMutationError] = useState('')
  const [openContentSections, setOpenContentSections] = useState({
    personajes: false,
    personajesArchivo: false,
    bestiario: false,
    personajesTierlist: false,
    objetos: false,
    objetosArchivo: false,
    objetosTierlist: false,
    lugares: false,
    poderes: false,
    hechizos: false,
    otrosPoderes: false,
  })
  const didReloadRef = useRef(false)
  const showScrollTop = useScrollTopButton()
  const campaignFormId = `campaign-core-form-${draftId || 'nuevo'}`

  const detailQuery = useQuery({
    queryKey: ['campaign-detail', campaignId],
    queryFn: () => fetchCampaignDetail(campaignId),
    enabled: !createMode && Boolean(campaignId),
  })

  const usersQuery = useQuery({
    queryKey: ['campaign-user-options'],
    queryFn: fetchCampaignUserOptions,
    enabled: createMode || Boolean(detailQuery.data?.item?.puedeGestionar),
    staleTime: 5 * 60 * 1000,
  })

  const contentEnabled = !createMode && Boolean(campaignId)

  const charactersQuery = useQuery({
    queryKey: ['campaign-content', campaignId, 'characters'],
    queryFn: () => fetchCampaignCharacters(campaignId, { limit: 10 }),
    enabled: contentEnabled,
    staleTime: 2 * 60 * 1000,
  })

  const objectsQuery = useQuery({
    queryKey: ['campaign-content', campaignId, 'objects'],
    queryFn: () => fetchCampaignObjects(campaignId, { limit: 10 }),
    enabled: contentEnabled,
    staleTime: 2 * 60 * 1000,
  })

  const placesQuery = useQuery({
    queryKey: ['campaign-content', campaignId, 'places'],
    queryFn: () => fetchCampaignPlaces(campaignId, { limit: 10 }),
    enabled: contentEnabled,
    staleTime: 2 * 60 * 1000,
  })

  const spellsQuery = useQuery({
    queryKey: ['campaign-content', campaignId, 'spells'],
    queryFn: () => fetchCampaignSpells(campaignId, { limit: 10 }),
    enabled: contentEnabled,
    staleTime: 2 * 60 * 1000,
  })

  const powersQuery = useQuery({
    queryKey: ['campaign-content', campaignId, 'powers'],
    queryFn: () => fetchCampaignPowers(campaignId, { limit: 10 }),
    enabled: contentEnabled,
    staleTime: 2 * 60 * 1000,
  })

  const characterFeed = useIncrementalCardFeed({
    seedKey: `${campaignId || 'nuevo'}:characters:${charactersQuery.dataUpdatedAt}`,
    initialItems: charactersQuery.data?.items || EMPTY_ITEMS,
    initialTotal:
      charactersQuery.data?.meta?.totalVisible ||
      charactersQuery.data?.meta?.total ||
      0,
    initialNextCursor: charactersQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: (options) => fetchCampaignCharacters(campaignId, options),
  })

  const objectFeed = useIncrementalCardFeed({
    seedKey: `${campaignId || 'nuevo'}:objects:${objectsQuery.dataUpdatedAt}`,
    initialItems: objectsQuery.data?.items || EMPTY_ITEMS,
    initialTotal:
      objectsQuery.data?.meta?.totalVisible ||
      objectsQuery.data?.meta?.total ||
      0,
    initialNextCursor: objectsQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: (options) => fetchCampaignObjects(campaignId, options),
  })

  const placeFeed = useIncrementalCardFeed({
    seedKey: `${campaignId || 'nuevo'}:places:${placesQuery.dataUpdatedAt}`,
    initialItems: placesQuery.data?.items || EMPTY_ITEMS,
    initialTotal:
      placesQuery.data?.meta?.totalVisible ||
      placesQuery.data?.meta?.total ||
      0,
    initialNextCursor: placesQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: (options) => fetchCampaignPlaces(campaignId, options),
  })

  const spellFeed = useIncrementalCardFeed({
    seedKey: `${campaignId || 'nuevo'}:spells:${spellsQuery.dataUpdatedAt}`,
    initialItems: spellsQuery.data?.items || EMPTY_ITEMS,
    initialTotal:
      spellsQuery.data?.meta?.totalVisible ||
      spellsQuery.data?.meta?.total ||
      0,
    initialNextCursor: spellsQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: (options) => fetchCampaignSpells(campaignId, options),
  })

  const powerFeed = useIncrementalCardFeed({
    seedKey: `${campaignId || 'nuevo'}:powers:${powersQuery.dataUpdatedAt}`,
    initialItems: powersQuery.data?.items || EMPTY_ITEMS,
    initialTotal:
      powersQuery.data?.meta?.totalVisible ||
      powersQuery.data?.meta?.total ||
      0,
    initialNextCursor: powersQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: (options) => fetchCampaignPowers(campaignId, options),
  })

  const campaignCharacterGroups = useMemo(
    () => ({
      personajes: characterFeed.items.filter((item) => !item.esCriatura),
      bestiario: characterFeed.items.filter((item) => item.esCriatura),
      tiers: buildCampaignTierGroups(characterFeed.items),
    }),
    [characterFeed.items]
  )
  const campaignObjectGroups = useMemo(
    () => ({
      objetos: objectFeed.items,
      tiers: buildCampaignTierGroups(objectFeed.items),
    }),
    [objectFeed.items]
  )

  useEffect(() => {
    if (!draftId || (!isEditing && !createMode)) {
      return undefined
    }

    function handlePersistedExit() {
      didReloadRef.current = true
      markReload(draftId)
    }

    window.addEventListener('beforeunload', handlePersistedExit)
    window.addEventListener('pagehide', handlePersistedExit)
    return () => {
      window.removeEventListener('beforeunload', handlePersistedExit)
      window.removeEventListener('pagehide', handlePersistedExit)

      if (!didReloadRef.current) {
        clearDraft(draftId)
      }
    }
  }, [createMode, draftId, isEditing])

  useEffect(() => {
    if (createMode) {
      writeDraftSection(draftId, 'players', draftPlayerIds)
    }
  }, [createMode, draftId, draftPlayerIds])

  useEffect(() => {
    if (createMode) {
      writeDraftSection(draftId, 'narrative', draftNarrative)
    }
  }, [createMode, draftId, draftNarrative])

  const detail = detailQuery.data
  const campaign = detail?.item
  const canManage = Boolean(campaign?.puedeGestionar)

  const createCampaignMutation = useMutation({
    mutationFn: async (payload) => {
      const createdCampaign = await createCampaign(payload)
      const adventureIdMap = new Map()
      const arcIdMap = new Map()

      for (const userId of draftPlayerIds) {
        await addCampaignPlayer(createdCampaign.id, userId)
      }

      for (const adventure of draftNarrative.adventures) {
        const createdAdventure = await createCampaignNarrative(
          createdCampaign.id,
          'adventures',
          normalizePayload(adventure)
        )
        adventureIdMap.set(adventure.id, createdAdventure.id)
      }

      for (const arc of draftNarrative.arcs) {
        const createdArc = await createCampaignNarrative(
          createdCampaign.id,
          'arcs',
          normalizeArcPayload({
            ...arc,
            aventuraId: adventureIdMap.get(arc.aventuraId) || null,
          })
        )
        arcIdMap.set(arc.id, createdArc.id)
      }

      for (const session of draftNarrative.sessions) {
        await createCampaignNarrative(
          createdCampaign.id,
          'sessions',
          normalizeSessionPayload({
            ...session,
            aventuraId: adventureIdMap.get(session.aventuraId) || null,
            arcoId: arcIdMap.get(session.arcoId) || null,
          })
        )
      }

      return createdCampaign
    },
    onSuccess: (item) => {
      setMutationError('')
      clearDraft(draftId)
      setDraftPlayerIds([])
      setDraftNarrative({ adventures: [], arcs: [], sessions: [] })
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      navigate(`/app/campanas/${item.id}`, { replace: true })
    },
    onError: (error) => {
      setMutationError(getErrorMessage(error, 'No se pudo crear la campaña.'))
    },
  })

  const updateCampaignMutation = useMutation({
    mutationFn: (payload) => updateCampaign(campaignId, payload),
    onSuccess: () => {
      setMutationError('')
      clearDraft(draftId)
      setIsEditing(false)
      queryClient.invalidateQueries({
        queryKey: ['campaign-detail', campaignId],
      })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
    onError: (error) => {
      setMutationError(
        getErrorMessage(error, 'No se pudo actualizar la campaña.')
      )
    },
  })

  const addPlayerMutation = useMutation({
    mutationFn: (userId) => addCampaignPlayer(campaignId, userId),
    onSuccess: () => {
      setSelectedUserId('')
      queryClient.invalidateQueries({
        queryKey: ['campaign-detail', campaignId],
      })
    },
    onError: (error) => {
      setMutationError(getErrorMessage(error, 'No se pudo añadir el jugador.'))
    },
  })

  const removePlayerMutation = useMutation({
    mutationFn: (userId) => removeCampaignPlayer(campaignId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['campaign-detail', campaignId],
      })
    },
    onError: (error) => {
      setMutationError(getErrorMessage(error, 'No se pudo sacar el jugador.'))
    },
  })

  const createNarrativeMutation = useMutation({
    mutationFn: ({ type, payload }) =>
      createCampaignNarrative(campaignId, type, payload),
    onSuccess: (_item, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['campaign-detail', campaignId],
      })
      queryClient.invalidateQueries({
        queryKey: ['campaign-content', campaignId, variables.type],
      })
    },
    onError: (error) => {
      setMutationError(getErrorMessage(error, 'No se pudo crear el registro.'))
    },
  })

  const updateNarrativeMutation = useMutation({
    mutationFn: ({ type, itemId, payload }) =>
      updateCampaignNarrative(campaignId, type, itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['campaign-detail', campaignId],
      })
    },
    onError: (error) => {
      setMutationError(
        getErrorMessage(error, 'No se pudo actualizar el registro.')
      )
    },
  })

  const deleteNarrativeMutation = useMutation({
    mutationFn: ({ type, itemId }) =>
      deleteCampaignNarrative(campaignId, type, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['campaign-detail', campaignId],
      })
    },
    onError: (error) => {
      setMutationError(getErrorMessage(error, 'No se pudo borrar el registro.'))
    },
  })

  const anyMutationPending =
    createCampaignMutation.isPending ||
    updateCampaignMutation.isPending ||
    addPlayerMutation.isPending ||
    removePlayerMutation.isPending ||
    createNarrativeMutation.isPending ||
    updateNarrativeMutation.isPending ||
    deleteNarrativeMutation.isPending

  const stats = useMemo(
    () => [
      {
        label: 'Jugadores',
        value: campaign?.totalJugadores || detail?.jugadores?.length || 0,
        icon: Users,
      },
      {
        label: 'Aventuras',
        value: campaign?.totalAventuras || detail?.aventuras?.length || 0,
        icon: BookOpen,
      },
      {
        label: 'Arcos',
        value: campaign?.totalArcos || detail?.arcos?.length || 0,
        icon: Swords,
      },
      {
        label: 'Partidas',
        value: campaign?.totalPartidas || detail?.partidas?.length || 0,
        icon: CalendarDays,
      },
    ],
    [campaign, detail]
  )

  function handleBack() {
    const returnTo = location.state?.returnTo?.pathname || '/app/campanas'
    navigate(returnTo)
  }

  function handleCancel() {
    clearDraft(draftId)

    if (createMode) {
      navigate('/app/campanas')
      return
    }

    setIsEditing(false)
  }

  function toggleContentSection(sectionName) {
    setOpenContentSections((current) => ({
      ...current,
      [sectionName]: !current[sectionName],
    }))
  }

  function handleCreateNarrative(type, payload, onDone) {
    createNarrativeMutation.mutate(
      { type, payload },
      {
        onSuccess: () => {
          setMutationError('')
          onDone?.()
        },
      }
    )
  }

  function handleUpdateNarrative(type, itemId, payload, onDone) {
    updateNarrativeMutation.mutate(
      { type, itemId, payload },
      {
        onSuccess: () => {
          setMutationError('')
          onDone?.()
        },
      }
    )
  }

  function handleDeleteNarrative(type, itemId) {
    const label = NARRATIVE_CONFIG[type].singular
    if (!window.confirm(`¿Seguro que quieres borrar esta ${label}?`)) {
      return
    }

    deleteNarrativeMutation.mutate({ type, itemId })
  }

  function handleCreateDraftNarrative(type, payload, onDone) {
    setDraftNarrative((current) => {
      const next = {
        ...current,
        [type]: [
          ...(current[type] || []),
          hydrateDraftNarrativeItem(type, payload, current),
        ],
      }
      return refreshDraftNarrativeRelations(next)
    })
    onDone?.()
  }

  function handleUpdateDraftNarrative(type, itemId, payload, onDone) {
    setDraftNarrative((current) => {
      const next = {
        ...current,
        [type]: (current[type] || []).map((item) =>
          item.id === itemId
            ? { ...item, ...payload, actualizadoEn: new Date().toISOString() }
            : item
        ),
      }
      return refreshDraftNarrativeRelations(next)
    })
    onDone?.()
  }

  function handleDeleteDraftNarrative(type, itemId) {
    const label = NARRATIVE_CONFIG[type].singular
    if (!window.confirm(`¿Seguro que quieres borrar esta ${label}?`)) {
      return
    }

    setDraftNarrative((current) => {
      const next = {
        ...current,
        [type]: (current[type] || []).filter((item) => item.id !== itemId),
      }

      if (type === 'adventures') {
        next.arcs = next.arcs.map((arc) =>
          arc.aventuraId === itemId ? { ...arc, aventuraId: '' } : arc
        )
        next.sessions = next.sessions.map((session) =>
          session.aventuraId === itemId
            ? { ...session, aventuraId: '' }
            : session
        )
      }

      if (type === 'arcs') {
        next.sessions = next.sessions.map((session) =>
          session.arcoId === itemId ? { ...session, arcoId: '' } : session
        )
      }

      return refreshDraftNarrativeRelations(next)
    })
  }

  if (!createMode && detailQuery.isLoading) {
    return (
      <section className="grid gap-6">
        <article className="panel h-64 animate-pulse bg-white/70" />
        <article className="panel h-40 animate-pulse bg-white/70" />
      </section>
    )
  }

  if (!createMode && detailQuery.isError) {
    return (
      <section className="panel px-6 py-8">
        <p className="text-sm font-semibold text-danger">
          {getErrorMessage(detailQuery.error, 'No se pudo cargar la campaña.')}
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-stroke bg-white px-4 py-2 text-sm font-bold text-ink-soft"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
      </section>
    )
  }

  const showEditor = createMode || (isEditing && canManage)

  return (
    <section className="grid gap-6">
      {showScrollTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="theme-solid-button fixed bottom-6 right-6 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-glow"
          aria-label="Subir arriba"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      ) : null}

      <article className="panel overflow-hidden">
        <div className="relative min-h-64 bg-ink text-white">
          {campaign?.imagenUrl ? (
            <CloudinaryImage
              src={campaign.imagenUrl}
              alt={campaign.nombre}
              variant="detail"
              sizes="100vw"
              className="absolute inset-0 h-full w-full object-cover opacity-45"
              loading="eager"
            />
          ) : (
            <div className="theme-brand-gradient absolute inset-0 opacity-70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/15" />
          <div className="relative grid gap-6 px-6 py-6 sm:px-8 sm:py-8">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white transition hover:border-brand hover:text-brand"
              aria-label="Volver"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div>
              <p className="font-label text-[10px] font-black uppercase tracking-[0.28em] text-brand">
                Campaña activa
              </p>
              <h1 className="mt-3 max-w-4xl font-display text-5xl font-black tracking-[-0.07em] sm:text-6xl">
                {createMode ? 'Nueva campaña' : campaign?.nombre}
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-white/75">
                {createMode ? (
                  'Crea la campaña base y después gestiona jugadores, arcos, aventuras y partidas desde su ficha.'
                ) : (
                  <WikiText
                    text={campaign?.descripcion}
                    emptyText="Sin descripción registrada."
                  />
                )}
              </p>
            </div>

            {campaign ? (
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1.5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  {campaign.privacidad?.nombre || 'Pública'}
                </span>
                <span className="rounded-full bg-brand px-3 py-1.5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  {campaign.rolEnCampaña || 'visitante'}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </article>

      {mutationError ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-5 py-4 text-sm font-semibold text-danger">
          {mutationError}
        </div>
      ) : null}

      {showEditor ? (
        <>
          <CampaignCoreForm
            key={createMode ? 'create' : campaign?.id}
            initialCampaign={campaign}
            isSaving={anyMutationPending}
            onSubmit={(payload) =>
              createMode
                ? createCampaignMutation.mutate(payload)
                : updateCampaignMutation.mutate(payload)
            }
            draftId={draftId}
            campaignId={campaignId}
            formId={campaignFormId}
          />

          {createMode ? (
            <>
              <DraftPlayersPanel
                users={usersQuery.data || EMPTY_ITEMS}
                selectedUserId={selectedUserId}
                setSelectedUserId={setSelectedUserId}
                selectedPlayerIds={draftPlayerIds}
                setSelectedPlayerIds={setDraftPlayerIds}
                isSaving={anyMutationPending}
              />
              <NarrativeManager
                type="adventures"
                items={draftNarrative.adventures}
                adventures={draftNarrative.adventures}
                arcs={draftNarrative.arcs}
                campaignId={null}
                draftId={draftId}
                editable
                onCreate={handleCreateDraftNarrative}
                onUpdate={handleUpdateDraftNarrative}
                onDelete={handleDeleteDraftNarrative}
                isSaving={anyMutationPending}
              />
              <NarrativeManager
                type="arcs"
                items={draftNarrative.arcs}
                adventures={draftNarrative.adventures}
                arcs={draftNarrative.arcs}
                campaignId={null}
                draftId={draftId}
                editable
                onCreate={handleCreateDraftNarrative}
                onUpdate={handleUpdateDraftNarrative}
                onDelete={handleDeleteDraftNarrative}
                isSaving={anyMutationPending}
              />
              <NarrativeManager
                type="sessions"
                items={draftNarrative.sessions}
                adventures={draftNarrative.adventures}
                arcs={draftNarrative.arcs}
                campaignId={null}
                draftId={draftId}
                editable
                onCreate={handleCreateDraftNarrative}
                onUpdate={handleUpdateDraftNarrative}
                onDelete={handleDeleteDraftNarrative}
                isSaving={anyMutationPending}
              />
              <CampaignEditorActions
                formId={campaignFormId}
                submitText="Guardar campaña"
                isSaving={anyMutationPending}
                onCancel={handleCancel}
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <InfoPill key={stat.label} {...stat} />
            ))}
          </div>
        </>
      )}

      {!createMode && detail ? (
        <>
          <PlayersPanel
            detail={detail}
            users={usersQuery.data || EMPTY_ITEMS}
            editable={showEditor && canManage}
            selectedUserId={selectedUserId}
            setSelectedUserId={setSelectedUserId}
            onAdd={() =>
              selectedUserId && addPlayerMutation.mutate(selectedUserId)
            }
            onRemove={(userId) => removePlayerMutation.mutate(userId)}
            isSaving={anyMutationPending}
          />

          {showEditor && canManage ? (
            <>
              <NarrativeManager
                type="adventures"
                items={detail.aventuras || EMPTY_ITEMS}
                adventures={detail.aventuras || EMPTY_ITEMS}
                arcs={detail.arcos || EMPTY_ITEMS}
                campaignId={campaignId}
                draftId={draftId}
                editable
                onCreate={handleCreateNarrative}
                onUpdate={handleUpdateNarrative}
                onDelete={handleDeleteNarrative}
                isSaving={anyMutationPending}
              />
              <NarrativeManager
                type="arcs"
                items={detail.arcos || EMPTY_ITEMS}
                adventures={detail.aventuras || EMPTY_ITEMS}
                arcs={detail.arcos || EMPTY_ITEMS}
                campaignId={campaignId}
                draftId={draftId}
                editable
                onCreate={handleCreateNarrative}
                onUpdate={handleUpdateNarrative}
                onDelete={handleDeleteNarrative}
                isSaving={anyMutationPending}
              />
              <NarrativeManager
                type="sessions"
                items={detail.partidas || EMPTY_ITEMS}
                adventures={detail.aventuras || EMPTY_ITEMS}
                arcs={detail.arcos || EMPTY_ITEMS}
                campaignId={campaignId}
                draftId={draftId}
                editable
                onCreate={handleCreateNarrative}
                onUpdate={handleUpdateNarrative}
                onDelete={handleDeleteNarrative}
                isSaving={anyMutationPending}
              />
              <CampaignEditorActions
                formId={campaignFormId}
                submitText="Guardar cambios"
                isSaving={anyMutationPending}
                onCancel={handleCancel}
              />
            </>
          ) : (
            <NarrativeOverview detail={detail} />
          )}

          {!showEditor ? (
            <>
              <CampaignGroupedEntrySection
                title="Personajes"
                icon={UserRound}
                shownCount={characterFeed.shownCount}
                totalCount={characterFeed.total}
                canLoadMore={characterFeed.canLoadMore}
                canLoadLess={characterFeed.canLoadLess}
                isLoading={charactersQuery.isLoading}
                isFetchingMore={characterFeed.isFetchingMore}
                error={characterFeed.error}
                open={openContentSections.personajes}
                onToggle={() => toggleContentSection('personajes')}
                onLoadMore={characterFeed.loadMore}
                onLoadLess={characterFeed.loadLess}
                onLoadAll={characterFeed.loadAll}
                onShowRecent={characterFeed.showRecent}
              >
                <CampaignNestedContentSection
                  title="Personajes"
                  icon={UserRound}
                  count={campaignCharacterGroups.personajes.length}
                  open={openContentSections.personajesArchivo}
                  onToggle={() => toggleContentSection('personajesArchivo')}
                >
                  <CampaignEntryGrid
                    items={campaignCharacterGroups.personajes}
                    renderItem={(item) => (
                      <PublicProfileCharacterCard key={item.id} item={item} />
                    )}
                    emptyText="No hay personajes visibles dentro de esta campaña."
                    mobileThreeColumns
                  />
                </CampaignNestedContentSection>

                <CampaignNestedContentSection
                  title="Bestiario"
                  icon={Shield}
                  count={campaignCharacterGroups.bestiario.length}
                  open={openContentSections.bestiario}
                  onToggle={() => toggleContentSection('bestiario')}
                >
                  <CampaignEntryGrid
                    items={campaignCharacterGroups.bestiario}
                    renderItem={(item) => (
                      <PublicProfileCharacterCard key={item.id} item={item} />
                    )}
                    emptyText="No hay criaturas visibles dentro de esta campaña."
                    mobileThreeColumns
                  />
                </CampaignNestedContentSection>

                <CampaignNestedContentSection
                  title="TierList"
                  icon={Sparkles}
                  count={campaignCharacterGroups.tiers.reduce(
                    (total, group) => total + group.items.length,
                    0
                  )}
                  open={openContentSections.personajesTierlist}
                  onToggle={() => toggleContentSection('personajesTierlist')}
                >
                  <CampaignTierListContentSection
                    groups={campaignCharacterGroups.tiers}
                    renderItem={(item) => (
                      <PublicProfileCharacterCard key={item.id} item={item} />
                    )}
                    emptyText="No hay personajes con tier visible dentro de esta campaña."
                    mobileThreeColumns
                  />
                </CampaignNestedContentSection>
              </CampaignGroupedEntrySection>

              <CampaignGroupedEntrySection
                title="Objetos"
                icon={Swords}
                shownCount={objectFeed.shownCount}
                totalCount={objectFeed.total}
                canLoadMore={objectFeed.canLoadMore}
                canLoadLess={objectFeed.canLoadLess}
                isLoading={objectsQuery.isLoading}
                isFetchingMore={objectFeed.isFetchingMore}
                error={objectFeed.error}
                open={openContentSections.objetos}
                onToggle={() => toggleContentSection('objetos')}
                onLoadMore={objectFeed.loadMore}
                onLoadLess={objectFeed.loadLess}
                onLoadAll={objectFeed.loadAll}
                onShowRecent={objectFeed.showRecent}
              >
                <CampaignNestedContentSection
                  title="Objetos"
                  icon={Swords}
                  count={campaignObjectGroups.objetos.length}
                  open={openContentSections.objetosArchivo}
                  onToggle={() => toggleContentSection('objetosArchivo')}
                >
                  <CampaignEntryGrid
                    items={campaignObjectGroups.objetos}
                    renderItem={(item) => (
                      <PublicProfileObjectCard key={item.id} item={item} />
                    )}
                    emptyText="No hay objetos visibles dentro de esta campaña."
                    mobileThreeColumns
                  />
                </CampaignNestedContentSection>

                <CampaignNestedContentSection
                  title="TierList"
                  icon={Sparkles}
                  count={campaignObjectGroups.tiers.reduce(
                    (total, group) => total + group.items.length,
                    0
                  )}
                  open={openContentSections.objetosTierlist}
                  onToggle={() => toggleContentSection('objetosTierlist')}
                >
                  <CampaignTierListContentSection
                    groups={campaignObjectGroups.tiers}
                    renderItem={(item) => (
                      <PublicProfileObjectCard key={item.id} item={item} />
                    )}
                    emptyText="No hay objetos con tier visible dentro de esta campaña."
                    mobileThreeColumns
                  />
                </CampaignNestedContentSection>
              </CampaignGroupedEntrySection>

              <CampaignEntrySection
                title="Lugares"
                icon={MapPinned}
                items={placeFeed.items}
                shownCount={placeFeed.shownCount}
                totalCount={placeFeed.total}
                canLoadMore={placeFeed.canLoadMore}
                canLoadLess={placeFeed.canLoadLess}
                isLoading={placesQuery.isLoading}
                isFetchingMore={placeFeed.isFetchingMore}
                error={placeFeed.error}
                renderItem={(item) => (
                  <PublicProfilePlaceCard key={item.id} item={item} />
                )}
                open={openContentSections.lugares}
                onToggle={() => toggleContentSection('lugares')}
                onLoadMore={placeFeed.loadMore}
                onLoadLess={placeFeed.loadLess}
                onLoadAll={placeFeed.loadAll}
                onShowRecent={placeFeed.showRecent}
                mobileThreeColumns
              />

              <article className="panel overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleContentSection('poderes')}
                  className="flex w-full flex-col gap-3 px-6 py-6 text-left sm:flex-row sm:items-end sm:justify-between"
                >
                  <div>
                    <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
                      Archivo de campana
                    </p>
                    <h2 className="mt-2 inline-flex items-center gap-3 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
                      <BookOpen className="h-6 w-6 text-brand" />
                      Poderes
                      <ChevronDown
                        className={`h-5 w-5 text-brand transition ${
                          openContentSections.poderes ? 'rotate-180' : ''
                        }`}
                      />
                    </h2>
                  </div>
                </button>

                {openContentSections.poderes ? (
                  <div className="grid gap-4 border-t border-stroke/70 px-4 pb-5 pt-4 sm:pl-10 sm:pr-6">
                    <CampaignEntrySection
                      title="Hechizos"
                      icon={BookOpen}
                      items={spellFeed.items}
                      shownCount={spellFeed.shownCount}
                      totalCount={spellFeed.total}
                      canLoadMore={spellFeed.canLoadMore}
                      canLoadLess={spellFeed.canLoadLess}
                      isLoading={spellsQuery.isLoading}
                      isFetchingMore={spellFeed.isFetchingMore}
                      error={spellFeed.error}
                      renderItem={(item) => (
                        <CampaignSpellCard key={item.id} item={item} />
                      )}
                      open={openContentSections.hechizos}
                      onToggle={() => toggleContentSection('hechizos')}
                      onLoadMore={spellFeed.loadMore}
                      onLoadLess={spellFeed.loadLess}
                      onLoadAll={spellFeed.loadAll}
                      onShowRecent={spellFeed.showRecent}
                    />
                    <CampaignEntrySection
                      title="Otros poderes"
                      icon={Sparkles}
                      items={powerFeed.items}
                      shownCount={powerFeed.shownCount}
                      totalCount={powerFeed.total}
                      canLoadMore={powerFeed.canLoadMore}
                      canLoadLess={powerFeed.canLoadLess}
                      isLoading={powersQuery.isLoading}
                      isFetchingMore={powerFeed.isFetchingMore}
                      error={powerFeed.error}
                      renderItem={(item) => (
                        <CampaignPowerCard key={item.id} item={item} />
                      )}
                      open={openContentSections.otrosPoderes}
                      onToggle={() => toggleContentSection('otrosPoderes')}
                      onLoadMore={powerFeed.loadMore}
                      onLoadLess={powerFeed.loadLess}
                      onLoadAll={powerFeed.loadAll}
                      onShowRecent={powerFeed.showRecent}
                    />
                  </div>
                ) : null}
              </article>

              {canManage ? (
                <div className="panel flex justify-start p-5">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="theme-solid-button inline-flex items-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                  >
                    <Edit3 className="h-4 w-4" />
                    Editar campaña
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
