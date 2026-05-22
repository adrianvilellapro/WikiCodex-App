import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { CommentsSection } from '../components/comments/CommentsSection'
import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
import { cn } from '../lib/cn'
import { ACCEPTED_IMAGE_INPUT_TYPES } from '../lib/image-upload'
import { recordRecentActivity } from '../services/recent-activity'
import {
  CharacterDeleteModal,
  CharacterSheetHeader,
  CreatorBadge,
  ScrollTopButton,
} from './character-detail/components'
import {
  createPower,
  deletePower,
  fetchPowerDetail,
  fetchPowerOptions,
  signAndUploadPowerImage,
  updatePower,
} from './powers/api'

const POWER_TABS = [
  { id: 'informacion', label: 'Información' },
  { id: 'usuarios', label: 'Usuarios' },
]
const POWER_NAME_MAX_LENGTH = 120
const POWER_DESCRIPTION_MAX_LENGTH = 8000
const DRAFT_STORAGE_PREFIX = 'wikicodex:power-editor:draft'
const RELOAD_STORAGE_PREFIX = 'wikicodex:power-editor:reload'
const PRIVACY_OPTIONS = [
  ['private', 'Privado', 'privado'],
  ['public', 'Público', 'campana_completo'],
  ['preview', 'Solo vista previa', 'campana_vista_previa'],
  ['custom', 'Usuarios concretos', 'usuarios_seleccionados'],
]

const EMPTY_DRAFT = {
  nombre: '',
  descripcion: '',
  imagenUrl: '',
  categorias: [],
  campanaIds: [],
  ambitoVisibilidadCodigo: 'usuarios_seleccionados',
  permisosUsuarios: [],
}

function getDraftStorageKey(powerId) {
  return `${DRAFT_STORAGE_PREFIX}:${powerId || 'new'}`
}

function getReloadStorageKey(powerId) {
  return `${RELOAD_STORAGE_PREFIX}:${powerId || 'new'}`
}

function markReloadResume(powerId) {
  window.localStorage.setItem(getReloadStorageKey(powerId), '1')
}

function consumeReloadResume(powerId) {
  const key = getReloadStorageKey(powerId)
  const value = window.localStorage.getItem(key) === '1'
  window.localStorage.removeItem(key)
  return value
}

function readStoredDraft(powerId) {
  const raw = window.localStorage.getItem(getDraftStorageKey(powerId))

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed?.draft ? parsed : null
  } catch {
    window.localStorage.removeItem(getDraftStorageKey(powerId))
    return null
  }
}

function persistDraft(powerId, draft) {
  window.localStorage.setItem(
    getDraftStorageKey(powerId),
    JSON.stringify({ powerId: powerId || 'new', draft })
  )
}

function clearDraft(powerId) {
  window.localStorage.removeItem(getDraftStorageKey(powerId))
  window.localStorage.removeItem(getReloadStorageKey(powerId))
}

function cloneDraft(value) {
  return JSON.parse(
    JSON.stringify({
      ...EMPTY_DRAFT,
      ...(value || {}),
      categorias: Array.isArray(value?.categorias) ? value.categorias : [],
      campanaIds: Array.isArray(value?.campanaIds) ? value.campanaIds : [],
      permisosUsuarios: Array.isArray(value?.permisosUsuarios)
        ? value.permisosUsuarios
        : [],
    })
  )
}

function toDraft(item) {
  if (!item) {
    return cloneDraft()
  }

  return cloneDraft({
    nombre: item.nombre || '',
    descripcion: item.descripcion || '',
    imagenUrl: item.imagenUrl || '',
    categorias: (item.categorias || []).map((category) => category.nombre),
    campanaIds: (item.campanas || []).map((campaign) => campaign.id),
    ambitoVisibilidadCodigo:
      item.ambitoVisibilidadCodigo || 'usuarios_seleccionados',
    permisosUsuarios: item.permisosUsuarios || [],
  })
}

function normalizeLooseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function privacyModeFromCode(code) {
  return (
    PRIVACY_OPTIONS.find(([, , optionCode]) => optionCode === code)?.[0] ||
    'custom'
  )
}

function privacyCodeFromMode(mode) {
  return (
    PRIVACY_OPTIONS.find(([optionMode]) => optionMode === mode)?.[2] ||
    'usuarios_seleccionados'
  )
}

function permissionForUser(draft, userId) {
  const permission = draft.permisosUsuarios.find(
    (item) => item.usuarioId === userId
  )

  if (!permission) {
    return 'hidden'
  }

  return permission.nivelAccesoCodigo === 'vista_previa' ? 'preview' : 'full'
}

function buildPayload(draft) {
  const isCustom = draft.ambitoVisibilidadCodigo === 'usuarios_seleccionados'

  return {
    nombre: draft.nombre.trim(),
    descripcion: draft.descripcion.trim() || null,
    imagenUrl: draft.imagenUrl || null,
    categorias: draft.categorias,
    campanaIds: draft.campanaIds,
    ambitoVisibilidadCodigo: draft.ambitoVisibilidadCodigo,
    permisosUsuarios: isCustom ? draft.permisosUsuarios : [],
  }
}

function PowerPreviewImage({ src, alt, className, sizes }) {
  return (
    <div
      className={cn(
        'theme-header-card relative overflow-hidden border border-brand/35 bg-surface-strong p-3',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="theme-brand-orbit absolute inset-[-58%] animate-[spin_6.5s_linear_infinite]" />
        <div className="theme-brand-orbit-inner absolute inset-[4px] rounded-[inherit]" />
      </div>
      <div className="theme-brand-gradient relative h-full overflow-hidden rounded-[inherit] bg-ink">
        {src ? (
          <CloudinaryImage
            src={src}
            alt={alt || 'Poder'}
            variant="detail"
            sizes={sizes}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="theme-brand-gradient flex h-full min-h-[18rem] w-full items-center justify-center text-brand">
            <Sparkles className="h-14 w-14" />
          </div>
        )}
      </div>
    </div>
  )
}

function PowerPrivacyBadge({ code }) {
  const label =
    PRIVACY_OPTIONS.find(([, , optionCode]) => optionCode === code)?.[1] ||
    'Usuarios concretos'

  return (
    <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-[11px] font-semibold text-brand">
      {label}
    </span>
  )
}

export function PowerDetailPage({ createMode = false, startEditing = false }) {
  const { powerId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const formId = `power-form-${createMode ? 'nuevo' : powerId || 'detalle'}`
  const [draftState, setDraftState] = useState(null)
  const [draftResetVersion, setDraftResetVersion] = useState(0)
  const [categoryQuery, setCategoryQuery] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [activeTab, setActiveTab] = useState('informacion')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const preservePowerEditor = Boolean(location.state?.preservePowerEditor)
  const queryEditing = searchParams.get('editing') === '1'
  const shouldResumeAfterReload = useMemo(
    () => consumeReloadResume(powerId || 'new'),
    [powerId]
  )

  const powerQuery = useQuery({
    queryKey: ['power-detail', powerId],
    queryFn: () => fetchPowerDetail(powerId),
    enabled: Boolean(powerId) && !createMode,
  })
  const power = powerQuery.data
  const canEdit = Boolean(createMode || power?.puedeEditar)
  const editingRequested = Boolean(
    createMode || queryEditing || startEditing || preservePowerEditor
  )
  const storageId = createMode ? 'new' : powerId
  const draftSourceKey = createMode
    ? 'new-power'
    : `${power?.id || 'pending'}:${power?.actualizadoEn || 'draft'}`
  const shouldUseStoredDraft =
    createMode ||
    preservePowerEditor ||
    shouldResumeAfterReload ||
    ((queryEditing || startEditing) && canEdit)
  const initialDraft = useMemo(() => {
    if (createMode) {
      return cloneDraft()
    }

    if (!createMode && power) {
      return toDraft(power)
    }

    return null
  }, [createMode, power])
  const storedDraft = useMemo(() => {
    if (!initialDraft) {
      return null
    }

    if (draftResetVersion > 0) {
      return null
    }

    const stored = readStoredDraft(storageId)

    if (!stored) {
      return null
    }

    if (!shouldUseStoredDraft) {
      clearDraft(storageId)
      return null
    }

    return cloneDraft(stored.draft)
  }, [draftResetVersion, initialDraft, shouldUseStoredDraft, storageId])
  const draft =
    draftState?.key === draftSourceKey
      ? draftState.value
      : storedDraft || initialDraft || cloneDraft()
  const editingActive = canEdit && editingRequested
  const visiblePowerTabs = useMemo(
    () =>
      !editingActive && !createMode
        ? POWER_TABS
        : POWER_TABS.filter((tab) => tab.id === 'informacion'),
    [createMode, editingActive]
  )
  const activePowerTab = visiblePowerTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : 'informacion'
  const optionsQuery = useQuery({
    queryKey: ['power-options'],
    queryFn: fetchPowerOptions,
    enabled: Boolean(
      createMode || editingActive || (powerId && power?.puedeEditar)
    ),
  })
  const options = optionsQuery.data || {}
  const viewName =
    (editingActive ? draft.nombre : power?.nombre) ||
    (createMode ? 'Nuevo poder' : 'Poder')
  const selectedPrivacyMode = privacyModeFromCode(draft.ambitoVisibilidadCodigo)

  const filteredCategorySuggestions = useMemo(() => {
    const selected = new Set(
      draft.categorias.map((category) => normalizeLooseText(category))
    )
    const query = normalizeLooseText(categoryQuery)

    return (options.categorias || []).filter((category) => {
      if (selected.has(normalizeLooseText(category.nombre))) {
        return false
      }

      if (!query) {
        return true
      }

      return normalizeLooseText(category.nombre).includes(query)
    })
  }, [categoryQuery, draft.categorias, options.categorias])

  const visibleCategoryOptions = filteredCategorySuggestions.slice(0, 10)

  function setDraft(updater) {
    setDraftState((current) => {
      const base =
        current?.key === draftSourceKey
          ? current.value
          : storedDraft || initialDraft || cloneDraft()
      const value = typeof updater === 'function' ? updater(base) : updater

      if (value) {
        persistDraft(storageId, value)
      }

      return {
        key: draftSourceKey,
        value,
      }
    })
  }

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 520)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!power?.id || editingActive) {
      return
    }

    recordRecentActivity({
      entityType: 'power',
      entityId: power.id,
      nombre: power.nombre,
      subtitulo: power.categorias?.length
        ? power.categorias.map((category) => category.nombre).join(', ')
        : 'Otro poder',
      imagenUrl: power.imagenUrl || null,
      urlDestino: `/app/poderes/otros/${power.id}`,
      modoVista: power.modoVista,
    })
  }, [editingActive, power])

  useEffect(() => {
    if (!editingActive || !draft) {
      return undefined
    }

    function handleBeforeUnload() {
      persistDraft(storageId, draft)
      markReloadResume(storageId)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [draft, editingActive, storageId])

  useEffect(() => {
    if (createMode || !power?.id) {
      return
    }

    if (startEditing && canEdit) {
      navigate(`/app/poderes/otros/${power.id}?editing=1`, {
        replace: true,
        state: null,
      })
      return
    }

    if ((queryEditing || startEditing) && !canEdit) {
      clearDraft(storageId)
      navigate(`/app/poderes/otros/${power.id}`, {
        replace: true,
        state: null,
      })
    }
  }, [
    canEdit,
    createMode,
    navigate,
    power?.id,
    queryEditing,
    startEditing,
    storageId,
  ])

  useEffect(() => {
    return () => {
      const currentPath = window.location.pathname
      const ownPath = createMode
        ? '/app/poderes/otros/nuevo'
        : `/app/poderes/otros/${powerId}`
      const ownEditPath = createMode
        ? ownPath
        : `/app/poderes/otros/${powerId}/editar`

      if (currentPath !== ownPath && currentPath !== ownEditPath) {
        clearDraft(storageId)
      }
    }
  }, [createMode, powerId, storageId])

  function updateDraft(patch) {
    setDraft((current) => {
      const next = cloneDraft({ ...current, ...patch })
      return next
    })
  }

  function discardEditing() {
    clearDraft(storageId)
    setDraftState(null)
    setDraftResetVersion((version) => version + 1)
    setSaveError('')
    setCategoryQuery('')

    if (createMode) {
      navigate('/app/poderes/otros')
      return
    }

    if (power?.id) {
      navigate(`/app/poderes/otros/${power.id}`, {
        replace: true,
        state: null,
      })
    }
  }

  function addCategoryFromEntry(category) {
    const name = String(category?.nombre || categoryQuery || '').trim()

    if (!name) {
      return
    }

    const exists = draft.categorias.some(
      (item) => normalizeLooseText(item) === normalizeLooseText(name)
    )

    if (!exists) {
      updateDraft({ categorias: [...draft.categorias, name] })
    }

    setCategoryQuery('')
  }

  function removeCategory(categoryName) {
    updateDraft({
      categorias: draft.categorias.filter(
        (item) => normalizeLooseText(item) !== normalizeLooseText(categoryName)
      ),
    })
  }

  function toggleCampaign(campaignId) {
    updateDraft({
      campanaIds: draft.campanaIds.includes(campaignId)
        ? draft.campanaIds.filter((id) => id !== campaignId)
        : [...draft.campanaIds, campaignId],
    })
  }

  function setUserPermission(userId, value) {
    updateDraft({
      permisosUsuarios:
        value === 'hidden'
          ? draft.permisosUsuarios.filter((item) => item.usuarioId !== userId)
          : [
              ...draft.permisosUsuarios.filter(
                (item) => item.usuarioId !== userId
              ),
              {
                usuarioId: userId,
                nivelAccesoCodigo:
                  value === 'preview' ? 'vista_previa' : 'completo',
              },
            ],
    })
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      createMode
        ? createPower(buildPayload(draft))
        : updatePower(powerId, buildPayload(draft)),
    onSuccess: (item) => {
      clearDraft(storageId)
      setDraftState(null)
      setDraftResetVersion((version) => version + 1)
      setSaveError('')
      queryClient.invalidateQueries({ queryKey: ['powers'] })
      queryClient.invalidateQueries({ queryKey: ['power-detail', item.id] })
      navigate(`/app/poderes/otros/${item.id}`, {
        replace: true,
        state: null,
      })
    },
    onError: (error) => {
      setSaveError(
        error?.response?.data?.message || 'No se pudo guardar el poder.'
      )
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => deletePower(powerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['powers'] })
      navigate('/app/poderes/otros')
    },
    onError: (error) => {
      setDeleteError(
        error?.response?.data?.message || 'No se pudo eliminar el poder.'
      )
    },
  })
  const uploadMutation = useMutation({
    mutationFn: (file) => signAndUploadPowerImage({ file, powerId }),
    onSuccess: (url) => updateDraft({ imagenUrl: url }),
  })

  function submitForm(event) {
    event.preventDefault()
    setSaveError('')

    if (!draft.nombre.trim()) {
      setSaveError('El poder necesita un nombre.')
      return
    }

    saveMutation.mutate()
  }

  function renderLinkedCharacters() {
    const characters = power?.personajes || []

    return (
      <div className="grid gap-4">
        <div>
          <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
            Usuarios
          </p>
          <h2 className="mt-2 font-headline text-2xl font-black text-ink">
            Personajes vinculados
          </h2>
        </div>
        {characters.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {characters.map((character) => (
              <a
                key={character.id}
                href={`/app/personajes/${character.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 gap-3 border border-slate-200 bg-white p-3 transition hover:border-brand/40 hover:bg-brand/5"
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden border border-brand/20 bg-brand/10">
                  {character.imagenPrincipalUrl ? (
                    <CloudinaryImage
                      src={character.imagenPrincipalUrl}
                      alt={character.nombre}
                      variant="thumb"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-brand">
                      <Sparkles className="h-6 w-6" />
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink">
                    {character.nombre}
                  </span>
                  <span className="block truncate text-xs font-semibold text-ink-muted">
                    {character.titulo ||
                      character.campana?.nombre ||
                      'Personaje'}
                  </span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-slate-300 px-4 py-6 text-sm font-semibold text-ink-soft">
            No hay personajes vinculados visibles para tu usuario.
          </div>
        )}
      </div>
    )
  }

  if (!createMode && powerQuery.isLoading) {
    return (
      <div className="theme-sheet-card border p-8 text-sm text-ink-soft shadow-card">
        Cargando poder...
      </div>
    )
  }

  if (!createMode && powerQuery.isError) {
    return (
      <div className="theme-sheet-card border border-danger/40 p-8 text-sm font-semibold text-danger shadow-card">
        No se pudo cargar el poder.
      </div>
    )
  }

  return (
    <>
      <CharacterDeleteModal
        open={deleteOpen}
        characterName={power?.nombre || 'este poder'}
        entityLabel="poder"
        confirmationText={deleteConfirm}
        isDeleting={deleteMutation.isPending}
        error={deleteError}
        onConfirmationTextChange={setDeleteConfirm}
        onClose={() => {
          setDeleteOpen(false)
          setDeleteConfirm('')
          setDeleteError('')
        }}
        onConfirm={() => deleteMutation.mutate()}
      />

      <section className="grid gap-6">
        <article className="theme-sheet-shell overflow-hidden shadow-card">
          <CharacterSheetHeader
            tabs={visiblePowerTabs}
            activeTab={activePowerTab}
            characterId={powerId || 'nuevo-poder'}
            characterName={viewName}
            onTabChange={({ tab }) => setActiveTab(tab)}
            onBack={() => navigate('/app/poderes/otros')}
          />

          <div className="mx-auto w-full max-w-[84rem] px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-8 xl:px-6">
            <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[1.8rem,minmax(0,1fr),1.8rem] xl:gap-3 2xl:grid-cols-[2rem,minmax(0,1fr),2rem]">
              <div />

              <div className="mx-auto w-full max-w-[40rem] sm:max-w-[44rem] md:max-w-none">
                <div
                  className={cn(
                    'theme-sheet-frame border px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8 xl:px-10 xl:py-10',
                    editingActive
                      ? 'border-brand/50 theme-brand-outline-soft'
                      : 'border-slate-200'
                  )}
                >
                  {activePowerTab === 'usuarios' &&
                  !editingActive &&
                  !createMode ? (
                    renderLinkedCharacters()
                  ) : editingActive ? (
                    <form
                      id={formId}
                      onSubmit={submitForm}
                      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
                    >
                      <div className="grid min-w-0 gap-4">
                        <input
                          value={draft.nombre}
                          onChange={(event) =>
                            updateDraft({ nombre: event.target.value })
                          }
                          placeholder="Nombre del poder"
                          className="archive-input font-display text-3xl font-black tracking-normal sm:tracking-[-0.04em]"
                          maxLength={POWER_NAME_MAX_LENGTH}
                          required
                        />
                        <WikiTextArea
                          value={draft.descripcion}
                          onChange={(event) =>
                            updateDraft({ descripcion: event.target.value })
                          }
                          placeholder="Descripción del poder"
                          rows={10}
                          className="archive-input min-h-64 resize-y"
                          maxLength={POWER_DESCRIPTION_MAX_LENGTH}
                        />
                        <div className="flex flex-wrap justify-between gap-3 text-[11px] font-semibold text-ink-muted">
                          <span>
                            Nombre: {draft.nombre.length}/
                            {POWER_NAME_MAX_LENGTH}
                          </span>
                          <span>
                            Descripción: {draft.descripcion.length}/
                            {POWER_DESCRIPTION_MAX_LENGTH}
                          </span>
                        </div>

                        <div className="theme-sheet-card border p-4">
                          <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                            Categorías
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {draft.categorias.map((category) => (
                              <span
                                key={category}
                                className="group inline-flex max-w-full items-center break-words rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-[11px] font-semibold text-brand [overflow-wrap:anywhere]"
                              >
                                {category}
                                <button
                                  type="button"
                                  onClick={() => removeCategory(category)}
                                  className="ml-2 hidden text-brand/70 transition hover:text-brand group-hover:inline-flex"
                                  aria-label={`Quitar categoría ${category}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            ))}

                            <div className="w-full space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                  value={categoryQuery}
                                  onChange={(event) =>
                                    setCategoryQuery(event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault()
                                      const exactMatch =
                                        filteredCategorySuggestions.find(
                                          (item) =>
                                            normalizeLooseText(item.nombre) ===
                                            normalizeLooseText(categoryQuery)
                                        )
                                      addCategoryFromEntry(
                                        exactMatch || { nombre: categoryQuery }
                                      )
                                    }
                                  }}
                                  className="flex-1 border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                                  placeholder="Buscar o crear categoría"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    addCategoryFromEntry({
                                      nombre: categoryQuery,
                                    })
                                  }
                                  className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700"
                                >
                                  <Plus className="h-4 w-4" />
                                  Añadir categoría
                                </button>
                              </div>

                              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                                {visibleCategoryOptions.length ? (
                                  visibleCategoryOptions.map((category) => (
                                    <button
                                      key={category.id}
                                      type="button"
                                      onClick={() =>
                                        addCategoryFromEntry(category)
                                      }
                                      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand/30 hover:bg-brand/5"
                                    >
                                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                                        {category.nombre}
                                      </span>
                                      <Plus className="h-4 w-4 text-slate-400" />
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-sm text-slate-500">
                                    No hay coincidencias. Puedes crear una
                                    categoría nueva escribiendo su nombre.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="theme-sheet-card border p-4">
                          <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                            Campañas
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(options.campanasGestionables || []).map(
                              (campaign) => (
                                <button
                                  type="button"
                                  key={campaign.id}
                                  onClick={() => toggleCampaign(campaign.id)}
                                  className={cn(
                                    'max-w-full break-words rounded-full border px-4 py-2 text-xs font-bold transition [overflow-wrap:anywhere]',
                                    draft.campanaIds.includes(campaign.id)
                                      ? 'border-brand bg-brand/10 text-brand'
                                      : 'border-stroke bg-surface-strong text-ink-soft'
                                  )}
                                >
                                  {campaign.nombre}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <div className="theme-sheet-card border p-4">
                          <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                            Privacidad
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-4">
                            {PRIVACY_OPTIONS.map(([mode, label]) => (
                              <button
                                type="button"
                                key={mode}
                                onClick={() =>
                                  updateDraft({
                                    ambitoVisibilidadCodigo:
                                      privacyCodeFromMode(mode),
                                  })
                                }
                                className={cn(
                                  'rounded-md border px-4 py-3 text-sm font-bold transition',
                                  selectedPrivacyMode === mode
                                    ? 'border-brand bg-brand/10 text-brand'
                                    : 'border-stroke bg-surface-strong text-ink-soft'
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {selectedPrivacyMode === 'custom' ? (
                            <div className="mt-4 grid gap-3">
                              {(options.usuarios || []).map((user) => (
                                <div
                                  key={user.id}
                                  className="grid gap-3 rounded-xl border border-stroke bg-surface-strong/45 p-3 sm:grid-cols-[1fr_auto]"
                                >
                                  <div className="min-w-0">
                                    <p className="break-words font-display text-base font-bold text-ink [overflow-wrap:anywhere]">
                                      {user.nombreUsuario}
                                    </p>
                                    <p className="text-xs text-ink-muted">
                                      {user.rol?.nombre || 'Usuario'}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {[
                                      ['full', 'Completo'],
                                      ['preview', 'Preview'],
                                      ['hidden', 'Oculto'],
                                    ].map(([value, label]) => {
                                      const selected =
                                        permissionForUser(draft, user.id) ===
                                        value

                                      return (
                                        <button
                                          type="button"
                                          key={value}
                                          onClick={() =>
                                            setUserPermission(user.id, value)
                                          }
                                          className={cn(
                                            'rounded-md border px-3 py-2 text-xs font-bold transition',
                                            selected
                                              ? 'border-brand bg-brand/10 text-brand'
                                              : 'border-stroke bg-surface-strong text-ink-soft'
                                          )}
                                        >
                                          {label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <aside className="order-first grid min-w-0 w-full max-w-[16rem] content-start gap-4 justify-self-center lg:order-none lg:max-w-none lg:justify-self-auto">
                        <PowerPreviewImage
                          src={draft.imagenUrl}
                          alt={draft.nombre || 'Poder'}
                          className="aspect-[3/4] rounded-xl"
                          sizes="360px"
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPTED_IMAGE_INPUT_TYPES}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) {
                              uploadMutation.mutate(file)
                            }
                            event.target.value = ''
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadMutation.isPending}
                          className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                        >
                          <ImagePlus className="h-4 w-4" />
                          {uploadMutation.isPending
                            ? 'Subiendo...'
                            : 'Subir imagen'}
                        </button>
                      </aside>

                      {saveError ? (
                        <p className="rounded-md bg-danger/10 px-4 py-3 text-sm font-semibold text-danger lg:col-span-2">
                          {saveError}
                        </p>
                      ) : null}
                    </form>
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-7">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <PowerPrivacyBadge
                            code={power?.ambitoVisibilidadCodigo}
                          />
                          {(power?.categorias || []).map((category) => (
                            <span
                              key={category.id || category.nombre}
                              className="inline-flex max-w-full items-center break-words rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 [overflow-wrap:anywhere]"
                            >
                              {category.nombre}
                            </span>
                          ))}
                          {(power?.campanas || []).map((campaign) => (
                            <span
                              key={campaign.id}
                              className="inline-flex max-w-full items-center break-words rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 [overflow-wrap:anywhere]"
                            >
                              {campaign.nombre}
                            </span>
                          ))}
                        </div>
                        <p className="mt-5 font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                          Otro poder
                        </p>
                        <h1 className="mt-3 break-words font-display text-3xl font-black tracking-normal text-ink [overflow-wrap:anywhere] sm:text-5xl sm:tracking-[-0.06em]">
                          {power?.nombre}
                        </h1>
                        <p className="mt-5 whitespace-pre-line break-words text-base leading-8 text-ink-soft [overflow-wrap:anywhere]">
                          <WikiText
                            text={power?.descripcion}
                            emptyText="Sin descripción registrada."
                          />
                        </p>
                      </div>

                      <PowerPreviewImage
                        src={power?.imagenUrl}
                        alt={power?.nombre || 'Poder'}
                        className="order-first aspect-[3/4] w-full max-w-[16rem] justify-self-center rounded-xl lg:order-none lg:max-w-none lg:justify-self-auto"
                        sizes="360px"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid gap-3 sm:flex sm:flex-wrap sm:justify-start">
                    {editingActive ? (
                      <>
                        <button
                          type="submit"
                          form={formId}
                          disabled={
                            saveMutation.isPending || !draft.nombre.trim()
                          }
                          className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Save className="h-4 w-4" />
                          {saveMutation.isPending
                            ? 'Guardando...'
                            : createMode
                              ? 'Crear'
                              : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          onClick={discardEditing}
                          disabled={saveMutation.isPending}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-stroke bg-surface-strong px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <X className="h-4 w-4" />
                          {createMode ? 'Descartar' : 'Cancelar'}
                        </button>
                      </>
                    ) : canEdit ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const nextDraft = initialDraft || toDraft(power)
                            setDraft(nextDraft)
                            navigate(
                              `/app/poderes/otros/${power.id}?editing=1`,
                              {
                                replace: true,
                                state: null,
                              }
                            )
                          }}
                          className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteOpen(true)}
                          disabled={deleteMutation.isPending}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-danger/40 px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:border-danger/60 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deleteMutation.isPending
                            ? 'Eliminando...'
                            : 'Borrar'}
                        </button>
                      </>
                    ) : null}
                  </div>

                  {!createMode ? (
                    <CreatorBadge creator={power?.creadoPor} />
                  ) : null}
                </div>
              </div>

              <div />
            </div>
          </div>
        </article>

        {!createMode && power?.id ? (
          <CommentsSection
            key={`comentarios-poder-${power.id}`}
            targetType="poder"
            targetId={power.id}
          />
        ) : null}

        <ScrollTopButton
          show={showScrollTop}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />
      </section>
    </>
  )
}
