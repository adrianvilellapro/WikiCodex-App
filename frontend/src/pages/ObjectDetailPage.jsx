import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { CommentsSection } from '../components/comments/CommentsSection'
import { FavoriteStarButton } from '../components/ui/FavoriteStarButton'
import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
import { cn } from '../lib/cn'
import { ACCEPTED_IMAGE_INPUT_TYPES } from '../lib/image-upload'
import { useAuth } from '../features/auth/auth-context'
import { recordRecentActivity } from '../services/recent-activity'
import {
  CharacterDeleteModal,
  CharacterSheetHeader,
  CreatorBadge,
  ScrollTopButton,
} from './character-detail/components'
import { normalizeLooseText } from './character-detail/utils'
import {
  createObjectEditor,
  deleteObject,
  fetchObjectCreationEditor,
  fetchObjectDetail,
  fetchObjectEditor,
  fetchObjectVersions,
  saveObjectEditor,
  signAndUploadObjectImage,
} from './object-detail/api'

const TYPE_LABELS = {
  no_magico: 'No magico',
  magico: 'Magico',
  reliquia: 'Reliquia',
}

const MODIFIER_LABELS = {
  ataque: 'Ataque',
  dano: 'Daño',
  cd: 'CD',
  clase_armadura: 'Clase de Armadura',
  pruebas_caracteristica: 'Pruebas de Caracteristica',
  otro: 'Otro',
}

const OBJECT_TABS = [
  { id: 'informacion', label: 'Información' },
  { id: 'usuarios', label: 'Usuarios' },
]
const DRAFT_STORAGE_PREFIX = 'wikicodex:object-editor:draft'
const RELOAD_STORAGE_PREFIX = 'wikicodex:object-editor:reload'

function getDraftStorageKey(objectId) {
  return `${DRAFT_STORAGE_PREFIX}:${objectId || 'new'}`
}

function getReloadStorageKey(objectId) {
  return `${RELOAD_STORAGE_PREFIX}:${objectId || 'new'}`
}

function markReloadResume(objectId) {
  window.localStorage.setItem(getReloadStorageKey(objectId), '1')
}

function consumeReloadResume(objectId) {
  const key = getReloadStorageKey(objectId)
  const value = window.localStorage.getItem(key) === '1'
  window.localStorage.removeItem(key)
  return value
}

function isSpellTraitName(name) {
  return normalizeLooseText(name) === 'hechizos'
}

function readStoredDraft(objectId) {
  const raw = window.localStorage.getItem(getDraftStorageKey(objectId))

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed?.draft ? parsed : null
  } catch {
    window.localStorage.removeItem(getDraftStorageKey(objectId))
    return null
  }
}

function persistDraft(objectId, draft) {
  window.localStorage.setItem(
    getDraftStorageKey(objectId),
    JSON.stringify({ objectId: objectId || 'new', draft })
  )
}

function clearDraft(objectId) {
  window.localStorage.removeItem(getDraftStorageKey(objectId))
  window.localStorage.removeItem(getReloadStorageKey(objectId))
}

function emptyDraft(editorMeta, currentUserId) {
  const defaultOwnerId = editorMeta?.usuarios?.some(
    (owner) => owner.id === currentUserId
  )
    ? currentUserId
    : editorMeta?.usuarios?.[0]?.id || ''

  return {
    core: {
      campanaIds:
        editorMeta?.campanas?.length === 1 ? [editorMeta.campanas[0].id] : [],
      propietarioUsuarioId: defaultOwnerId,
      objetoBaseId: '',
      tierId: editorMeta?.tiers?.[0]?.id || '',
      tipoMagicoCodigo: 'no_magico',
      nombre: '',
      descripcion: '',
      imagenPrincipalUrl: '',
    },
    modificadores: [],
    rasgos: [],
    hechizos: [],
    hechizosSlots: {},
    privacidad: {
      mode: 'public',
      userPermissions: [],
    },
  }
}

function buildDraftFromItem(item, editorMeta) {
  const currentPermissions = editorMeta?.permisosActuales || []
  const visibility = item?.ambitoVisibilidadCodigo
  const privacyMode =
    visibility === 'campana_completo'
      ? 'public'
      : visibility === 'campana_vista_previa'
        ? 'preview'
        : visibility === 'usuarios_seleccionados'
          ? 'custom'
          : 'private'

  const rawTraits =
    item?.rasgos ||
    item?.rasgosAgrupados?.flatMap((group) => group.rasgos || []) ||
    []
  const traits = rawTraits.map((trait) => {
    const matchingType = editorMeta?.tiposRasgo?.find(
      (type) =>
        type.nombre === trait.tipoRasgoNombre ||
        normalizeLooseText(type.nombre) ===
          normalizeLooseText(trait.tipoRasgoNombre)
    )

    return {
      id: trait.id || '',
      tipoRasgoId: matchingType?.id || editorMeta?.tiposRasgo?.[0]?.id || '',
      nombre: trait.nombre || '',
      descripcion: trait.descripcion || '',
    }
  })
  const spellTraitType = editorMeta?.tiposRasgo?.find((type) =>
    isSpellTraitName(type.nombre)
  )
  const hasSpellContent =
    (item?.hechizos || []).length > 0 ||
    Object.keys(item?.hechizosSlots || {}).length > 0

  if (
    hasSpellContent &&
    spellTraitType &&
    !traits.some((trait) => trait.tipoRasgoId === spellTraitType.id)
  ) {
    traits.push({
      id: 'object-spells',
      tipoRasgoId: spellTraitType.id,
      nombre: spellTraitType.nombre || 'Hechizos',
      descripcion: '',
    })
  }

  return {
    core: {
      campanaIds: item?.campanaIds || [],
      propietarioUsuarioId:
        item?.propietarioUsuarioId || item?.creadoPorUsuarioId || '',
      objetoBaseId: item?.objetoBaseId || '',
      tierId: item?.tierId || '',
      tipoMagicoCodigo: item?.tipoMagicoCodigo || 'no_magico',
      nombre: item?.nombre || '',
      descripcion: item?.descripcion || '',
      imagenPrincipalUrl: item?.imagenPrincipalUrl || '',
    },
    modificadores: (item?.modificadores || []).map((modifier) => ({
      id: modifier.id || '',
      valor: modifier.valor ?? 1,
      tipoCodigo: modifier.tipoCodigo || 'ataque',
      otro: modifier.otro || '',
    })),
    rasgos: traits,
    hechizos: (item?.hechizos || []).map((spell) => ({
      hechizoId: spell.id,
      id: spell.id,
      nombre: spell.nombre,
      nivel: spell.nivel,
      escuela: spell.escuela,
      tipoCasteo: spell.tipoCasteo,
      concentracion: Boolean(spell.concentracion),
      clases: spell.clases || [],
    })),
    hechizosSlots: item?.hechizosSlots || {},
    privacidad: {
      mode: privacyMode,
      userPermissions: currentPermissions.map((permission) => ({
        usuarioId: permission.usuarioId,
        nivelAccesoCodigo:
          permission.nivelAccesoCodigo === 'vista_previa'
            ? 'preview'
            : permission.nivelAccesoCodigo === 'completo'
              ? 'full'
              : permission.nivelAccesoCodigo,
      })),
    },
  }
}

function buildPayload(draft) {
  return {
    core: {
      campanaIds: draft.core.campanaIds,
      propietarioUsuarioId: draft.core.propietarioUsuarioId || null,
      objetoBaseId: draft.core.objetoBaseId || null,
      tierId: draft.core.tierId || null,
      tipoMagicoCodigo: draft.core.tipoMagicoCodigo || 'no_magico',
      nombre: draft.core.nombre,
      descripcion: draft.core.descripcion || null,
      imagenPrincipalUrl: draft.core.imagenPrincipalUrl || null,
    },
    modificadores: draft.modificadores
      .filter((modifier) => modifier.tipoCodigo)
      .map((modifier) => ({
        id: modifier.id || null,
        valor: Number(modifier.valor || 0),
        tipoCodigo: modifier.tipoCodigo,
        otro: modifier.tipoCodigo === 'otro' ? modifier.otro || null : null,
      })),
    rasgos: draft.rasgos
      .filter((trait) => trait.nombre.trim() && trait.descripcion.trim())
      .map((trait) => ({
        id: trait.id || null,
        tipoRasgoId: trait.tipoRasgoId || null,
        nombre: trait.nombre.trim(),
        descripcion: trait.descripcion.trim(),
      })),
    hechizos: (draft.hechizos || [])
      .map((spell) => ({ hechizoId: spell.hechizoId || spell.id }))
      .filter((spell) => spell.hechizoId),
    hechizosSlots: draft.hechizosSlots || {},
    privacidad: {
      mode: draft.privacidad.mode,
      userPermissions:
        draft.privacidad.mode === 'custom'
          ? draft.privacidad.userPermissions
          : [],
    },
  }
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function formatModifier(modifier) {
  const sign = modifier.valor > 0 ? `+${modifier.valor}` : modifier.valor
  const label =
    modifier.tipoCodigo === 'otro'
      ? modifier.otro || 'Otro'
      : MODIFIER_LABELS[modifier.tipoCodigo] || 'Modificador'

  return `${sign} a ${label}`
}

function ObjectVersionButtons({
  versions,
  objectId,
  preserveEditor,
  locationState,
  onBeforeNavigate,
}) {
  if (versions.length <= 1) {
    return null
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2 sm:mb-5 sm:gap-3">
      {versions.map((item) => (
        <Link
          key={item.id}
          to={`/app/objetos/${item.id}`}
          state={{
            ...(locationState || {}),
            preserveObjectEditor: preserveEditor,
          }}
          onClick={onBeforeNavigate}
          className={cn(
            'min-w-0 flex-1 break-words border px-4 py-3 text-center font-label text-[10px] font-black uppercase tracking-[0.14em] transition [overflow-wrap:anywhere] sm:min-w-[13rem] sm:text-[11px] sm:tracking-[0.18em]',
            item.id === objectId
              ? 'theme-header-surface border-brand text-brand theme-brand-outline'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          )}
        >
          {item.nombre}
        </Link>
      ))}
    </div>
  )
}

function ObjectSheetActions({
  canEdit,
  isPreviewMode,
  isEditing,
  isSaving,
  isDeleting,
  createMode,
  creator,
  creatorLabel,
  onStartEditing,
  onSaveEditing,
  onCancelEditing,
  onDelete,
}) {
  if (isPreviewMode) {
    return (
      <div className="mt-4 flex justify-end px-1">
        <CreatorBadge creator={creator} label={creatorLabel} />
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
      {canEdit || createMode ? (
        <div className="grid gap-3 sm:flex sm:flex-wrap">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={onStartEditing}
                className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-danger/40 px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:border-danger/60 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onSaveEditing}
                disabled={isSaving}
                className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Save className="h-4 w-4" />
                {isSaving
                  ? createMode
                    ? 'Creando...'
                    : 'Guardando...'
                  : createMode
                    ? 'Crear Objeto'
                    : 'Confirmar edicion'}
              </button>
              <button
                type="button"
                onClick={onCancelEditing}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-stroke bg-surface-strong px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
              >
                <X className="h-4 w-4" />
                {createMode ? 'Descartar Objeto' : 'Cancelar edicion'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div />
      )}
      <CreatorBadge creator={creator} label={creatorLabel} />
    </div>
  )
}

export function ObjectDetailPage({ createMode = false }) {
  const { objectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const imageInputRef = useRef(null)
  const [editingOverride, setEditingOverride] = useState(null)
  const [draftState, setDraftState] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false)
  const [isVersionSectionOpen, setIsVersionSectionOpen] = useState(false)
  const [versionSearchQuery, setVersionSearchQuery] = useState('')
  const [visibleVersionOptions, setVisibleVersionOptions] = useState(5)
  const [activeTab, setActiveTab] = useState('informacion')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [spellPickerQuery, setSpellPickerQuery] = useState('')
  const [spellPickerClass, setSpellPickerClass] = useState('')
  const [spellPickerLevel, setSpellPickerLevel] = useState('')

  const returnTo = location.state?.returnTo || null
  const preserveObjectEditor = Boolean(location.state?.preserveObjectEditor)
  const shouldResumeAfterReload = useMemo(
    () => consumeReloadResume(objectId || 'new'),
    [objectId]
  )

  const {
    data: item,
    isLoading: isItemLoading,
    isError: isItemError,
  } = useQuery({
    queryKey: ['object', objectId],
    queryFn: () => fetchObjectDetail(objectId),
    enabled: Boolean(!createMode && objectId),
    staleTime: 60 * 1000,
  })

  const { data: versionsResponse } = useQuery({
    queryKey: ['object-versions', objectId],
    queryFn: () => fetchObjectVersions(objectId),
    enabled: Boolean(!createMode && objectId),
    staleTime: 60 * 1000,
  })

  const {
    data: editorResponse,
    isLoading: isEditorLoading,
    isError: isEditorError,
  } = useQuery({
    queryKey: createMode
      ? ['object-editor', 'new']
      : ['object-editor', objectId],
    queryFn: () =>
      createMode ? fetchObjectCreationEditor() : fetchObjectEditor(objectId),
    enabled: Boolean(createMode || (objectId && item?.puedeEditar)),
    staleTime: 60 * 1000,
  })

  const editorMeta = editorResponse?.editor || null
  const currentItem = createMode ? null : item
  const spellTraitType = useMemo(
    () =>
      editorMeta?.tiposRasgo?.find((traitType) =>
        isSpellTraitName(traitType.nombre)
      ) || null,
    [editorMeta?.tiposRasgo]
  )
  const spellTraitTypeIds = useMemo(
    () =>
      new Set(
        (editorMeta?.tiposRasgo || [])
          .filter((traitType) => isSpellTraitName(traitType.nombre))
          .map((traitType) => traitType.id)
      ),
    [editorMeta?.tiposRasgo]
  )
  const isSpellTraitTypeId = useCallback(
    (typeId) => {
      return Boolean(typeId && spellTraitTypeIds.has(typeId))
    },
    [spellTraitTypeIds]
  )
  const storageId = createMode ? 'new' : objectId
  const draftSourceKey = createMode
    ? 'new-object'
    : `${item?.id || 'pending'}:${item?.actualizadoEn || 'draft'}`
  const shouldUseStoredDraft =
    createMode || preserveObjectEditor || shouldResumeAfterReload

  const initialDraft = useMemo(() => {
    if (createMode && editorMeta) {
      return emptyDraft(editorMeta, user?.id)
    }

    if (!createMode && item && editorMeta) {
      return buildDraftFromItem(item, editorMeta)
    }

    return null
  }, [createMode, editorMeta, item, user?.id])

  const storedDraft = useMemo(() => {
    if (!initialDraft) {
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

    return stored.draft
  }, [initialDraft, shouldUseStoredDraft, storageId])

  const draft =
    draftState?.key === draftSourceKey
      ? draftState.value
      : storedDraft || initialDraft
  const isEditing =
    editingOverride ??
    Boolean(createMode || preserveObjectEditor || shouldResumeAfterReload)
  const visibleObjectTabs = useMemo(
    () =>
      !isEditing && !createMode
        ? OBJECT_TABS
        : OBJECT_TABS.filter((tab) => tab.id === 'informacion'),
    [createMode, isEditing]
  )
  const activeObjectTab = visibleObjectTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : 'informacion'
  const isPreviewMode = currentItem?.modoVista === 'preview'
  const versions = versionsResponse?.versiones || []
  const versionIds = versions.map((version) => version.id)

  function setDraft(updater) {
    setDraftState((current) => {
      const base =
        current?.key === draftSourceKey
          ? current.value
          : storedDraft || initialDraft
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
    if (!isEditing || !draft) {
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
  }, [draft, isEditing, storageId])

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 500)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (createMode || !currentItem?.id) {
      return
    }

    recordRecentActivity({
      entityType: 'object',
      entityId: currentItem.id,
      nombre: currentItem.nombre,
      subtitulo: currentItem.tier?.nombre || 'Objeto',
      imagenUrl: currentItem.imagenPrincipalUrl,
      urlDestino: `/app/objetos/${currentItem.id}`,
      modoVista: currentItem.modoVista,
    })
  }, [
    createMode,
    currentItem?.id,
    currentItem?.imagenPrincipalUrl,
    currentItem?.modoVista,
    currentItem?.nombre,
    currentItem?.tier?.nombre,
  ])

  const tierOptions = editorMeta?.tiers || []
  const campaignOptions = editorMeta?.campanas || []
  const permissionUsers = editorMeta?.usuarios || []
  const versionOptions = useMemo(() => {
    const query = versionSearchQuery.trim().toLowerCase()
    const ownObjects = (editorMeta?.objetosPropios || []).filter(
      (object) => object.id !== objectId
    )

    if (!query) {
      return ownObjects.slice(0, visibleVersionOptions)
    }

    return ownObjects
      .filter(
        (object) =>
          object.nombre?.toLowerCase().includes(query) ||
          object.descripcion?.toLowerCase().includes(query)
      )
      .slice(0, visibleVersionOptions)
  }, [
    editorMeta?.objetosPropios,
    objectId,
    versionSearchQuery,
    visibleVersionOptions,
  ])

  const totalVersionOptionMatches = useMemo(() => {
    const query = versionSearchQuery.trim().toLowerCase()
    const ownObjects = (editorMeta?.objetosPropios || []).filter(
      (object) => object.id !== objectId
    )

    if (!query) {
      return ownObjects.length
    }

    return ownObjects.filter(
      (object) =>
        object.nombre?.toLowerCase().includes(query) ||
        object.descripcion?.toLowerCase().includes(query)
    ).length
  }, [editorMeta?.objetosPropios, objectId, versionSearchQuery])

  const canSave = Boolean(draft?.core?.nombre?.trim() && !isEditorLoading)

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!canSave) {
        throw new Error('El objeto necesita al menos un nombre.')
      }

      if (createMode) {
        const created = await createObjectEditor(buildPayload(draft))
        return { currentItem: created, savedIds: ['new'] }
      }

      const draftsToSave = [{ objectId, currentDraft: draft }]

      for (const versionId of versionIds) {
        if (versionId === objectId) {
          continue
        }

        const stored = readStoredDraft(versionId)

        if (stored?.draft) {
          draftsToSave.push({ objectId: versionId, currentDraft: stored.draft })
        }
      }

      let currentSaved = null

      for (const entry of draftsToSave) {
        const saved = await saveObjectEditor(
          entry.objectId,
          buildPayload(entry.currentDraft)
        )

        if (entry.objectId === objectId) {
          currentSaved = saved
        }
      }

      return {
        currentItem: currentSaved,
        savedIds: draftsToSave.map((entry) => entry.objectId),
      }
    },
    onSuccess: async (result) => {
      setSaveError('')
      for (const id of result.savedIds) {
        clearDraft(id)
      }
      setDraftState(null)
      setEditingOverride(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['objects'] }),
        queryClient.invalidateQueries({ queryKey: ['object'] }),
        queryClient.invalidateQueries({ queryKey: ['object-versions'] }),
        queryClient.invalidateQueries({ queryKey: ['object-editor'] }),
      ])

      if (createMode) {
        clearDraft('new')
        navigate(`/app/objetos/${result.currentItem.id}`)
      }
    },
    onError: (error) => {
      setSaveError(getErrorMessage(error, 'No se pudo guardar el objeto.'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteObject(objectId),
    onSuccess: async () => {
      setDeleteError('')
      setDeleteOpen(false)
      setDeleteText('')
      await queryClient.invalidateQueries({ queryKey: ['objects'] })
      if (returnTo?.pathname) {
        navigate(returnTo.pathname, {
          state: {
            restoreScrollY: returnTo.scrollY || 0,
          },
          replace: true,
        })
        return
      }
      navigate('/app/objetos')
    },
    onError: (error) => {
      setDeleteError(getErrorMessage(error, 'No se pudo borrar el objeto.'))
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file) =>
      signAndUploadObjectImage({
        file,
        campaignId: draft?.core?.campanaIds?.[0],
        objectId,
      }),
    onSuccess: (url) => {
      setUploadError('')
      updateCore('imagenPrincipalUrl', url)
    },
    onError: (error) => {
      setUploadError(getErrorMessage(error, 'No se pudo subir la imagen.'))
    },
  })

  function updateCore(field, value) {
    setDraft((current) => ({
      ...current,
      core: {
        ...current.core,
        [field]: value,
      },
    }))
  }

  function toggleCampaign(campaignId) {
    setDraft((current) => {
      const selected = new Set(current.core.campanaIds)

      if (selected.has(campaignId)) {
        selected.delete(campaignId)
      } else {
        selected.add(campaignId)
      }

      return {
        ...current,
        core: {
          ...current.core,
          campanaIds: [...selected],
        },
      }
    })
  }

  function addModifier() {
    setDraft((current) => ({
      ...current,
      modificadores: [
        ...current.modificadores,
        { id: '', valor: 1, tipoCodigo: 'ataque', otro: '' },
      ],
    }))
  }

  function updateModifier(index, patch) {
    setDraft((current) => ({
      ...current,
      modificadores: current.modificadores.map((modifier, modifierIndex) =>
        modifierIndex === index ? { ...modifier, ...patch } : modifier
      ),
    }))
  }

  function removeModifier(index) {
    setDraft((current) => ({
      ...current,
      modificadores: current.modificadores.filter(
        (_, modifierIndex) => modifierIndex !== index
      ),
    }))
  }

  function addTrait() {
    setDraft((current) => ({
      ...current,
      rasgos: [
        ...current.rasgos,
        {
          id: '',
          tipoRasgoId: editorMeta?.tiposRasgo?.[0]?.id || '',
          nombre: 'Nuevo rasgo',
          descripcion: '',
        },
      ],
    }))
  }

  function updateTrait(index, patch) {
    setDraft((current) => {
      const currentTrait = current.rasgos[index]
      const nextTypeId = patch.tipoRasgoId ?? currentTrait?.tipoRasgoId
      const wasSpellTrait = isSpellTraitTypeId(currentTrait?.tipoRasgoId)
      const willBeSpellTrait = isSpellTraitTypeId(nextTypeId)
      const nextRasgos = current.rasgos.map((trait, traitIndex) => {
        if (traitIndex !== index) {
          return trait
        }

        if (willBeSpellTrait) {
          return {
            ...trait,
            ...patch,
            tipoRasgoId: nextTypeId,
            nombre: spellTraitType?.nombre || 'Hechizos',
            descripcion: '',
          }
        }

        return { ...trait, ...patch }
      })
      const normalizedRasgos = willBeSpellTrait
        ? nextRasgos.filter(
            (trait, traitIndex) =>
              traitIndex === index || !isSpellTraitTypeId(trait.tipoRasgoId)
          )
        : nextRasgos
      const shouldClearSpells =
        wasSpellTrait &&
        !willBeSpellTrait &&
        !normalizedRasgos.some((trait) => isSpellTraitTypeId(trait.tipoRasgoId))

      return {
        ...current,
        rasgos: normalizedRasgos,
        ...(shouldClearSpells ? { hechizos: [], hechizosSlots: {} } : {}),
      }
    })
  }

  function removeTrait(index) {
    setDraft((current) => {
      const removedTrait = current.rasgos[index]
      const nextRasgos = current.rasgos.filter(
        (_, traitIndex) => traitIndex !== index
      )
      const shouldClearSpells =
        isSpellTraitTypeId(removedTrait?.tipoRasgoId) &&
        !nextRasgos.some((trait) => isSpellTraitTypeId(trait.tipoRasgoId))

      return {
        ...current,
        rasgos: nextRasgos,
        ...(shouldClearSpells ? { hechizos: [], hechizosSlots: {} } : {}),
      }
    })
  }

  const viewItem = currentItem || {}
  const savedSpellMap = useMemo(
    () =>
      new Map(
        (editorMeta?.hechizosGuardados || []).map((spell) => [spell.id, spell])
      ),
    [editorMeta?.hechizosGuardados]
  )
  const viewSpells = useMemo(() => {
    const source = isEditing ? draft?.hechizos || [] : viewItem.hechizos || []

    return [...source]
      .map((spell) => {
        const spellId = spell.hechizoId || spell.id
        return {
          ...savedSpellMap.get(spellId),
          ...spell,
          id: spellId,
          hechizoId: spellId,
        }
      })
      .filter((spell) => spell.id)
      .sort(
        (left, right) =>
          Number(left.nivel || 0) - Number(right.nivel || 0) ||
          String(left.nombre || '').localeCompare(String(right.nombre || ''))
      )
  }, [draft?.hechizos, isEditing, savedSpellMap, viewItem.hechizos])
  const selectedSpellIds = useMemo(
    () => new Set(viewSpells.map((spell) => spell.id)),
    [viewSpells]
  )
  const spellSlots = useMemo(
    () =>
      isEditing ? draft?.hechizosSlots || {} : viewItem.hechizosSlots || {},
    [draft?.hechizosSlots, isEditing, viewItem.hechizosSlots]
  )
  const hasObjectSpellContent = useMemo(
    () =>
      viewSpells.length > 0 ||
      Object.keys(spellSlots || {}).some((level) =>
        Number.isFinite(Number(level))
      ),
    [spellSlots, viewSpells.length]
  )
  const hasSpellTraitInDraft = useMemo(
    () =>
      Boolean(
        isEditing &&
        (draft?.rasgos || []).some((trait) =>
          isSpellTraitTypeId(trait.tipoRasgoId)
        )
      ),
    [draft?.rasgos, isEditing, isSpellTraitTypeId]
  )
  const groupedObjectSpells = useMemo(() => {
    if (!hasObjectSpellContent && !hasSpellTraitInDraft) {
      return []
    }

    const highestSlotLevel = Math.max(
      0,
      ...Object.entries(spellSlots || {})
        .map(([level]) => Number(level))
        .filter((level) => Number.isFinite(level))
    )
    const highestSpellLevel = Math.max(
      0,
      ...viewSpells.map((spell) => Number(spell.nivel || 0))
    )
    const groups = new Map([[0, []]])

    for (
      let level = 1;
      level <= Math.max(highestSlotLevel, highestSpellLevel);
      level += 1
    ) {
      groups.set(level, [])
    }

    for (const spell of viewSpells) {
      const level = Number(spell.nivel || 0)
      if (!groups.has(level)) {
        groups.set(level, [])
      }
      groups.get(level).push(spell)
    }

    return [...groups.entries()].map(([level, spells]) => ({
      level,
      label: level === 0 ? 'Trucos' : `NV${level}`,
      slots: level === 0 ? null : Number(spellSlots?.[level] || 0),
      spells,
    }))
  }, [hasObjectSpellContent, hasSpellTraitInDraft, spellSlots, viewSpells])

  const spellClassOptions = useMemo(() => {
    const classes = new Set()
    for (const spell of editorMeta?.hechizosGuardados || []) {
      for (const className of spell.clases || []) {
        classes.add(className)
      }
    }
    return [...classes].sort((left, right) => left.localeCompare(right))
  }, [editorMeta?.hechizosGuardados])
  const filteredSavedSpells = useMemo(() => {
    const query = spellPickerQuery.trim().toLowerCase()

    return [...(editorMeta?.hechizosGuardados || [])].filter((spell) => {
      const matchesQuery =
        !query ||
        `${spell.nombre || ''} ${spell.escuela || ''}`
          .toLowerCase()
          .includes(query)
      const matchesClass =
        !spellPickerClass || (spell.clases || []).includes(spellPickerClass)
      const matchesLevel =
        spellPickerLevel === '' ||
        Number(spell.nivel || 0) === Number(spellPickerLevel)

      return matchesQuery && matchesClass && matchesLevel
    })
  }, [
    editorMeta?.hechizosGuardados,
    spellPickerClass,
    spellPickerLevel,
    spellPickerQuery,
  ])

  function addSpellToObject(spell) {
    setDraft((current) => {
      if (
        (current.hechizos || []).some(
          (item) => (item.hechizoId || item.id) === spell.id
        )
      ) {
        return current
      }

      const level = Number(spell.nivel || 0)
      const slots = { ...(current.hechizosSlots || {}) }
      for (let slotLevel = 1; slotLevel <= level; slotLevel += 1) {
        if (slots[slotLevel] === undefined) {
          slots[slotLevel] = 0
        }
      }

      return {
        ...current,
        hechizos: [
          ...(current.hechizos || []),
          { ...spell, hechizoId: spell.id },
        ],
        hechizosSlots: slots,
      }
    })
  }

  function removeSpellFromObject(spellId) {
    setDraft((current) => ({
      ...current,
      hechizos: (current.hechizos || []).filter(
        (spell) => (spell.hechizoId || spell.id) !== spellId
      ),
    }))
  }

  function addObjectSpellLevel(level) {
    setDraft((current) => {
      const slots = { ...(current.hechizosSlots || {}) }
      for (let slotLevel = 1; slotLevel <= level; slotLevel += 1) {
        if (slots[slotLevel] === undefined) {
          slots[slotLevel] = 0
        }
      }
      return { ...current, hechizosSlots: slots }
    })
  }

  function updateObjectSpellSlots(level, delta) {
    setDraft((current) => ({
      ...current,
      hechizosSlots: {
        ...(current.hechizosSlots || {}),
        [level]: Math.max(
          0,
          Number(current.hechizosSlots?.[level] || 0) + delta
        ),
      },
    }))
  }

  function renderObjectSpellBlock({ editable = false } = {}) {
    if (!editable && !hasObjectSpellContent) {
      return null
    }

    return (
      <div className="theme-sheet-copy mt-4 space-y-2 text-[0.9rem] leading-7">
        {groupedObjectSpells.map((group, groupIndex) => (
          <p key={group.level}>
            <strong className="theme-sheet-copy-strong font-semibold">
              -{group.label}
              {group.level > 0 ? `(${group.slots || 0})` : ''}:
            </strong>{' '}
            {editable && group.level > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => updateObjectSpellSlots(group.level, 1)}
                  className="mx-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-stroke text-[10px] font-black text-ink-soft transition hover:border-brand hover:text-brand"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => updateObjectSpellSlots(group.level, -1)}
                  className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-stroke text-[10px] font-black text-ink-soft transition hover:border-danger hover:text-danger"
                >
                  -
                </button>
              </>
            ) : null}
            <span className="break-words align-baseline">
              {group.spells.map((spell, spellIndex) => (
                <span key={spell.id} className="inline">
                  {spellIndex > 0 ? <span className="mx-1">|</span> : null}
                  <Link
                    to={`/app/poderes/hechizos/${spell.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-inherit underline-offset-4 transition hover:underline"
                  >
                    {spell.nombre}
                  </Link>
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => removeSpellFromObject(spell.id)}
                      className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-danger"
                      aria-label="Quitar hechizo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </span>
              ))}
              {editable &&
              groupIndex === groupedObjectSpells.length - 1 &&
              group.level < 10 ? (
                <button
                  type="button"
                  onClick={() => addObjectSpellLevel(group.level + 1)}
                  className="ml-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-brand"
                >
                  Añadir NV{group.level + 1}
                </button>
              ) : null}
            </span>
          </p>
        ))}

        {!groupedObjectSpells.length ? (
          <p className="mt-2 text-sm text-ink-soft">
            Todavia no hay hechizos asignados a este objeto.
          </p>
        ) : null}

        {editable ? (
          <div className="theme-sheet-card mt-4 grid gap-3 border p-3">
            <p className="text-xs font-semibold text-ink-soft">
              Añade hechizos guardados en tu repositorio personal. Los hechizos
              nuevos se crean desde Poderes / Hechizos.
            </p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)_7rem]">
              <input
                value={spellPickerQuery}
                onChange={(event) => setSpellPickerQuery(event.target.value)}
                className="archive-input rounded-none"
                placeholder="Buscar hechizo"
              />
              <select
                value={spellPickerClass}
                onChange={(event) => setSpellPickerClass(event.target.value)}
                className="archive-input rounded-none"
              >
                <option value="">Todas las clases</option>
                {spellClassOptions.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
              <select
                value={spellPickerLevel}
                onChange={(event) => setSpellPickerLevel(event.target.value)}
                className="archive-input rounded-none"
              >
                <option value="">Nivel</option>
                {Array.from({ length: 11 }, (_, index) => (
                  <option key={index} value={index}>
                    {index === 0 ? 'Truco' : `N${index}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid max-h-52 gap-2 overflow-y-auto">
              {filteredSavedSpells.map((spell) => (
                <button
                  key={spell.id}
                  type="button"
                  disabled={selectedSpellIds.has(spell.id)}
                  onClick={() => addSpellToObject(spell)}
                  className="flex items-center justify-between gap-3 rounded-md border border-stroke bg-surface px-3 py-2 text-left text-xs transition hover:border-brand disabled:opacity-45"
                >
                  <span className="min-w-0 truncate font-semibold text-ink">
                    {spell.nombre}
                  </span>
                  <span className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
                    {spell.nivel === 0 ? 'Truco' : `N${spell.nivel}`}
                  </span>
                </button>
              ))}
              {!filteredSavedSpells.length ? (
                <p className="rounded-md border border-dashed border-stroke px-3 py-3 text-xs font-semibold text-ink-soft">
                  No hay hechizos que coincidan con esos filtros.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  function setPrivacyMode(mode) {
    setDraft((current) => ({
      ...current,
      privacidad: {
        ...current.privacidad,
        mode,
      },
    }))
  }

  function getUserPermission(userId) {
    return (
      draft?.privacidad.userPermissions.find(
        (permission) => permission.usuarioId === userId
      )?.nivelAccesoCodigo || 'hidden'
    )
  }

  function setUserPermission(userId, level) {
    setDraft((current) => {
      const withoutUser = current.privacidad.userPermissions.filter(
        (permission) => permission.usuarioId !== userId
      )

      return {
        ...current,
        privacidad: {
          ...current.privacidad,
          userPermissions:
            level === 'hidden'
              ? withoutUser
              : [
                  ...withoutUser,
                  { usuarioId: userId, nivelAccesoCodigo: level },
                ],
        },
      }
    })
  }

  function startEditing() {
    const nextDraft = draft || initialDraft
    setEditingOverride(true)

    if (nextDraft) {
      persistDraft(storageId, nextDraft)
      setDraft(nextDraft)
    }
  }

  function discardEditing() {
    const idsToClear = versionIds.length ? versionIds : [storageId]

    for (const id of idsToClear) {
      clearDraft(id)
    }

    clearDraft(storageId)
    setDraftState(null)
    setSaveError('')
    setUploadError('')
    setEditingOverride(false)

    if (createMode) {
      navigate('/app/objetos')
    }
  }

  function handleReturnToOrigin() {
    clearDraft(storageId)

    if (returnTo?.pathname) {
      navigate(returnTo.pathname, {
        state: {
          restoreScrollY: returnTo.scrollY || 0,
        },
      })
      return
    }

    navigate('/app/objetos')
  }

  function persistCurrentDraft() {
    if (isEditing && draft) {
      persistDraft(storageId, draft)
    }
  }

  if (
    isItemLoading ||
    (createMode && isEditorLoading) ||
    (isEditing && !draft)
  ) {
    return (
      <div className="theme-sheet-shell p-8 text-sm text-ink-soft shadow-card">
        Cargando ficha de objeto...
      </div>
    )
  }

  if (isItemError || isEditorError || (!createMode && !currentItem)) {
    return (
      <div className="theme-sheet-shell p-8 shadow-card">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-danger">
          No se pudo abrir el objeto
        </p>
        <button
          type="button"
          onClick={() => navigate('/app/objetos')}
          className="theme-solid-button mt-4 inline-flex px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em]"
        >
          Volver a objetos
        </button>
      </div>
    )
  }

  const viewName = isEditing ? draft?.core.nombre : viewItem.nombre
  const viewDescription = isEditing
    ? draft?.core.descripcion
    : viewItem.descripcion || ''
  const viewImage = isEditing
    ? draft?.core.imagenPrincipalUrl
    : viewItem.imagenPrincipalUrl
  const viewTier =
    viewItem.tier?.nombre ||
    tierOptions.find((tier) => tier.id === draft?.core.tierId)?.nombre ||
    'Sin tier'
  const viewType =
    TYPE_LABELS[viewItem.tipoMagicoCodigo || draft?.core.tipoMagicoCodigo] ||
    'No magico'
  const selectedCampaigns = campaignOptions.filter((campaign) =>
    draft?.core.campanaIds?.includes(campaign.id)
  )
  const viewCampaigns =
    viewItem.campanas?.length > 0 ? viewItem.campanas : selectedCampaigns
  const selectedOwner =
    editorMeta?.usuarios?.find(
      (owner) => owner.id === draft?.core.propietarioUsuarioId
    ) ||
    viewItem.propietario ||
    viewItem.creadoPor ||
    null
  const viewOwner = isEditing
    ? selectedOwner
    : viewItem.propietario || viewItem.creadoPor
  const viewModifiers = isEditing
    ? draft?.modificadores || []
    : viewItem.modificadores || []
  const viewTraits = isEditing ? draft?.rasgos || [] : viewItem.rasgos || []
  const traitGroups = isEditing
    ? (editorMeta?.tiposRasgo || [])
        .map((type) => ({
          id: type.id,
          nombre: type.nombre,
          ordenVisualizacion: type.ordenVisualizacion,
          rasgos: viewTraits.filter((trait) => trait.tipoRasgoId === type.id),
        }))
        .filter((group) => group.rasgos.length)
    : (() => {
        const groups = [...(viewItem.rasgosAgrupados || [])]

        if (
          hasObjectSpellContent &&
          !groups.some((group) => isSpellTraitName(group.nombre))
        ) {
          groups.push({
            id: spellTraitType?.id || 'object-spells',
            tipoRasgoId: spellTraitType?.id || 'object-spells',
            nombre: spellTraitType?.nombre || 'Hechizos',
            ordenVisualizacion: spellTraitType?.ordenVisualizacion ?? 999,
            rasgos: [],
          })
        }

        return groups
      })()
  function renderLinkedCharacters() {
    const characters = viewItem.personajes || []

    return (
      <section className="theme-sheet-card mb-8 border p-4 sm:p-5">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
          Usuarios
        </p>
        <h2 className="mt-2 font-headline text-2xl font-black text-ink">
          Personajes vinculados
        </h2>
        {characters.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                      <ImagePlus className="h-6 w-6" />
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
          <div className="mt-4 border border-dashed border-slate-300 px-4 py-6 text-sm font-semibold text-ink-soft">
            No hay personajes vinculados visibles para tu usuario.
          </div>
        )}
      </section>
    )
  }

  return (
    <>
      <CharacterDeleteModal
        open={deleteOpen}
        characterName={viewName || 'este objeto'}
        entityLabel="objeto"
        confirmationText={deleteText}
        isDeleting={deleteMutation.isPending}
        error={deleteError}
        onConfirmationTextChange={setDeleteText}
        onClose={() => {
          setDeleteOpen(false)
          setDeleteText('')
          setDeleteError('')
        }}
        onConfirm={() => deleteMutation.mutate()}
      />

      <section className="grid gap-6">
        <article className="entity-sheet entity-sheet--object theme-sheet-shell overflow-hidden shadow-card">
          <CharacterSheetHeader
            tabs={visibleObjectTabs}
            activeTab={activeObjectTab}
            characterId={objectId || 'nuevo-objeto'}
            characterName={viewName || 'Nuevo objeto'}
            onTabChange={({ tab }) => setActiveTab(tab)}
            onBack={handleReturnToOrigin}
          />

          <div className="mx-auto w-full max-w-[84rem] px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-8 xl:px-6">
            {!createMode && currentItem?.id ? (
              <div className="mb-3 flex justify-end gap-2">
                <FavoriteStarButton
                  entityType="object"
                  entityId={currentItem.id}
                />
                {currentItem.puedeEditar && !isEditing ? (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-white text-ink-soft shadow-card transition hover:border-brand hover:text-brand"
                    aria-label="Editar objeto"
                    title="Editar objeto"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <ObjectVersionButtons
              versions={versions}
              objectId={objectId}
              locationState={location.state}
              preserveEditor={isEditing}
              onBeforeNavigate={persistCurrentDraft}
            />

            <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[1.8rem,minmax(0,1fr),1.8rem] xl:gap-3 2xl:grid-cols-[2rem,minmax(0,1fr),2rem]">
              <div />

              <div>
                <div
                  className={cn(
                    'theme-sheet-frame mx-auto max-w-[40rem] border px-3 py-4 sm:max-w-[44rem] sm:px-6 sm:py-6 md:max-w-none md:px-8 md:py-8 xl:px-10 xl:py-10',
                    isEditing
                      ? 'border-brand/50 theme-brand-outline-soft'
                      : 'border-slate-200',
                    activeObjectTab === 'usuarios' &&
                      !isEditing &&
                      !createMode &&
                      '[&>section:not(:first-child)]:hidden'
                  )}
                >
                  {activeObjectTab === 'usuarios' && !isEditing && !createMode
                    ? renderLinkedCharacters()
                    : null}

                  <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
                    <div className="min-w-0">
                      <p className="font-label text-[10px] font-black uppercase tracking-[0.24em] text-brand">
                        {isPreviewMode
                          ? 'Vista parcial'
                          : createMode
                            ? 'Nuevo objeto'
                            : viewType}
                      </p>

                      {isEditing ? (
                        <input
                          value={draft.core.nombre}
                          onChange={(event) =>
                            updateCore('nombre', event.target.value)
                          }
                          className="archive-input mt-3 rounded-none font-display text-3xl font-bold tracking-normal sm:text-4xl sm:tracking-[-0.04em]"
                          placeholder="Nombre del objeto"
                        />
                      ) : isPreviewMode ? null : (
                        <h1 className="mt-3 break-words font-display text-3xl font-bold tracking-normal text-ink [overflow-wrap:anywhere] sm:text-5xl sm:tracking-[-0.05em]">
                          {viewName}
                        </h1>
                      )}

                      {!isPreviewMode ? (
                        <>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <span className="theme-sheet-soft max-w-full break-words border px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-soft [overflow-wrap:anywhere]">
                              {viewTier}
                            </span>
                            <span className="theme-sheet-soft max-w-full break-words border px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-soft [overflow-wrap:anywhere]">
                              {isEditing
                                ? TYPE_LABELS[draft.core.tipoMagicoCodigo]
                                : viewType}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {viewModifiers.length ? (
                              viewModifiers.map((modifier, index) => (
                                <span
                                  key={`${modifier.tipoCodigo}-${index}`}
                                  className="max-w-full break-words border border-brand/45 bg-brand/15 px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)] [overflow-wrap:anywhere]"
                                >
                                  {formatModifier(modifier)}
                                </span>
                              ))
                            ) : (
                              <span className="max-w-full break-words border border-brand/35 bg-brand/10 px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand [overflow-wrap:anywhere]">
                                Sin modificador
                              </span>
                            )}
                          </div>
                        </>
                      ) : null}

                      {isEditing ? (
                        <WikiTextArea
                          value={draft.core.descripcion}
                          onChange={(event) =>
                            updateCore('descripcion', event.target.value)
                          }
                          className="archive-input mt-6 min-h-36 rounded-none leading-7"
                          placeholder="Descripcion del objeto"
                        />
                      ) : (
                        <p className="theme-sheet-copy mt-6 whitespace-pre-line break-words text-base leading-8 [overflow-wrap:anywhere]">
                          <WikiText
                            text={viewDescription}
                            emptyText="Este objeto aún no tiene descripción."
                          />
                        </p>
                      )}
                    </div>

                    <div className="theme-sheet-image order-first h-64 w-full max-w-[16rem] min-w-0 flex-none self-center overflow-hidden border sm:h-72 sm:max-w-[17.9rem] lg:order-none lg:h-[22.75rem] lg:w-[17.9rem] lg:min-w-[17.9rem] lg:self-start">
                      {isEditing ? (
                        <div className="relative h-full min-h-0">
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept={ACCEPTED_IMAGE_INPUT_TYPES}
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (file) {
                                uploadMutation.mutate(file)
                              }
                              event.target.value = ''
                            }}
                          />
                          {viewImage ? (
                            <button
                              type="button"
                              onClick={() => imageInputRef.current?.click()}
                              disabled={uploadMutation.isPending}
                              className="group relative block h-full w-full cursor-pointer text-left disabled:cursor-wait"
                              aria-label="Cambiar imagen principal del objeto"
                            >
                              <CloudinaryImage
                                src={viewImage}
                                alt={viewName || 'Objeto'}
                                variant="detail"
                                sizes="320px"
                                className="h-full w-full object-fill"
                              />
                              <span className="absolute inset-x-0 bottom-0 bg-black/65 px-3 py-2 text-center font-label text-[9px] font-black uppercase tracking-[0.14em] text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                {uploadMutation.isPending
                                  ? 'Subiendo...'
                                  : 'Cambiar imagen'}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => imageInputRef.current?.click()}
                              disabled={uploadMutation.isPending}
                              className="theme-sheet-soft flex h-full w-full items-center justify-center text-brand disabled:cursor-wait"
                              aria-label="Subir imagen principal del objeto"
                            >
                              <ImagePlus className="h-10 w-10" />
                              <span className="sr-only">
                                {uploadMutation.isPending
                                  ? 'Subiendo imagen'
                                  : 'Subir imagen'}
                              </span>
                            </button>
                          )}
                          {uploadError ? (
                            <p className="absolute inset-x-2 top-2 bg-white/90 px-2 py-1 text-xs font-semibold text-danger shadow-card">
                              {uploadError}
                            </p>
                          ) : null}
                        </div>
                      ) : viewImage ? (
                        <CloudinaryImage
                          src={viewImage}
                          alt={viewName || 'Objeto'}
                          variant="detail"
                          sizes="320px"
                          className="h-full w-full object-fill"
                        />
                      ) : (
                        <div className="theme-sheet-soft flex h-full w-full items-center justify-center text-sm text-ink-soft">
                          Sin imagen principal
                        </div>
                      )}
                    </div>
                  </section>

                  {isEditing && draft ? (
                    <section className="theme-sheet-soft mt-8 grid gap-4 border p-4 sm:gap-5 sm:p-5 lg:mt-10 lg:grid-cols-2">
                      <label className="flex flex-col gap-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-soft">
                        Tier
                        <select
                          value={draft.core.tierId}
                          onChange={(event) =>
                            updateCore('tierId', event.target.value)
                          }
                          className="archive-input rounded-none"
                        >
                          <option value="">Sin tier</option>
                          {tierOptions.map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.nombre}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-soft">
                        Tipo
                        <select
                          value={draft.core.tipoMagicoCodigo}
                          onChange={(event) =>
                            updateCore('tipoMagicoCodigo', event.target.value)
                          }
                          className="archive-input rounded-none"
                        >
                          {Object.entries(TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-soft lg:col-span-2">
                        Propietario
                        <select
                          value={draft.core.propietarioUsuarioId || ''}
                          onChange={(event) =>
                            updateCore(
                              'propietarioUsuarioId',
                              event.target.value
                            )
                          }
                          className="archive-input rounded-none"
                        >
                          {permissionUsers.map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.nombreUsuario}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="relative lg:col-span-2">
                        <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-soft">
                          Campañas
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setIsCampaignDropdownOpen((value) => !value)
                          }
                          className="archive-input mt-2 flex items-center justify-between gap-3 rounded-none text-left"
                        >
                          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                            {selectedCampaigns.length
                              ? selectedCampaigns
                                  .map((campaign) => campaign.nombre)
                                  .join(', ')
                              : 'Selecciona campañas'}
                          </span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        {isCampaignDropdownOpen ? (
                          <div className="theme-sheet-card absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-auto border p-3 shadow-card">
                            {campaignOptions.map((campaign) => (
                              <label
                                key={campaign.id}
                                className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm font-semibold text-ink"
                              >
                                <input
                                  type="checkbox"
                                  checked={draft.core.campanaIds.includes(
                                    campaign.id
                                  )}
                                  onChange={() => toggleCampaign(campaign.id)}
                                />
                                <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                                  {campaign.nombre}
                                </span>
                              </label>
                            ))}
                            {!campaignOptions.length ? (
                              <p className="px-3 py-2 text-sm text-danger">
                                Necesitas pertenecer a una campaña.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="theme-sheet-card border p-4 lg:col-span-2">
                        <button
                          type="button"
                          onClick={() =>
                            setIsVersionSectionOpen((value) => !value)
                          }
                          className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                        >
                          <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-soft">
                            Version de
                          </span>
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 text-brand transition',
                              isVersionSectionOpen && 'rotate-180'
                            )}
                          />
                        </button>

                        {isVersionSectionOpen ? (
                          <div className="mt-4">
                            {draft.core.objetoBaseId ? (
                              <button
                                type="button"
                                onClick={() => updateCore('objetoBaseId', '')}
                                className="inline-flex w-full items-center justify-center gap-2 border border-danger/40 bg-danger/10 px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-danger transition hover:border-danger hover:bg-danger/15 sm:w-auto"
                              >
                                <X className="h-4 w-4" />
                                Quitar versión
                              </button>
                            ) : null}
                            <input
                              value={versionSearchQuery}
                              onChange={(event) => {
                                setVersionSearchQuery(event.target.value)
                                setVisibleVersionOptions(5)
                              }}
                              className="archive-input mt-3 rounded-none"
                              placeholder="Buscar entre tus objetos..."
                            />
                            <div className="mt-3 grid gap-2">
                              {versionOptions.map((object) => (
                                <button
                                  key={object.id}
                                  type="button"
                                  onClick={() =>
                                    updateCore('objetoBaseId', object.id)
                                  }
                                  className={cn(
                                    'theme-sheet-soft min-w-0 border px-3 py-3 text-left transition hover:border-brand/50',
                                    draft.core.objetoBaseId === object.id &&
                                      'border-brand text-brand'
                                  )}
                                >
                                  <span className="block break-words text-sm font-bold [overflow-wrap:anywhere]">
                                    {object.nombre}
                                  </span>
                                  <span className="mt-1 line-clamp-2 block break-words text-xs text-ink-soft [overflow-wrap:anywhere] sm:line-clamp-1">
                                    <WikiText
                                      text={object.descripcion}
                                      emptyText="Sin descripción"
                                      disableLinks
                                    />
                                  </span>
                                </button>
                              ))}
                            </div>
                            {visibleVersionOptions <
                            totalVersionOptionMatches ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setVisibleVersionOptions(
                                    (value) => value + 10
                                  )
                                }
                                className="theme-sheet-soft mt-3 w-full border px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-soft"
                              >
                                Cargar 10 más
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="theme-sheet-card border p-4 lg:col-span-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-soft">
                            Modificadores
                          </p>
                          <button
                            type="button"
                            onClick={addModifier}
                            className="theme-solid-button inline-flex w-full items-center justify-center gap-2 px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] sm:w-auto"
                          >
                            <Plus className="h-4 w-4" />
                            Añadir
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3">
                          {draft.modificadores.map((modifier, index) => (
                            <div
                              key={`${modifier.id || 'new'}-${index}`}
                              className="grid gap-3 md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
                            >
                              <input
                                type="number"
                                value={modifier.valor}
                                onChange={(event) =>
                                  updateModifier(index, {
                                    valor: event.target.value,
                                  })
                                }
                                className="archive-input rounded-none"
                              />
                              <select
                                value={modifier.tipoCodigo}
                                onChange={(event) =>
                                  updateModifier(index, {
                                    tipoCodigo: event.target.value,
                                  })
                                }
                                className="archive-input rounded-none"
                              >
                                {Object.entries(MODIFIER_LABELS).map(
                                  ([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  )
                                )}
                              </select>
                              <input
                                value={modifier.otro}
                                disabled={modifier.tipoCodigo !== 'otro'}
                                onChange={(event) =>
                                  updateModifier(index, {
                                    otro: event.target.value,
                                  })
                                }
                                className="archive-input rounded-none disabled:opacity-45"
                                placeholder="Solo si es Otro"
                              />
                              <button
                                type="button"
                                onClick={() => removeModifier(index)}
                                className="theme-sheet-soft flex h-11 items-center justify-center border px-3 text-danger md:h-auto"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          {!draft.modificadores.length ? (
                            <p className="text-sm text-ink-soft">
                              Este objeto no tiene modificadores.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  ) : !isPreviewMode ? (
                    <section className="theme-sheet-rule mt-8 grid gap-4 border-t pt-6 md:mt-10 md:grid-cols-2">
                      <div>
                        <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                          Campañas
                        </p>
                        <p className="mt-2 break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">
                          {viewCampaigns
                            .map((campaign) => campaign.nombre)
                            .join(', ') || 'Sin campaña'}
                        </p>
                      </div>
                      <div>
                        <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                          Privacidad
                        </p>
                        <p className="mt-2 break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">
                          {viewItem.ambitoVisibilidadCodigo ===
                          'campana_completo'
                            ? 'Publico'
                            : viewItem.ambitoVisibilidadCodigo ===
                                'campana_vista_previa'
                              ? 'Solo vista previa'
                              : viewItem.ambitoVisibilidadCodigo ===
                                  'usuarios_seleccionados'
                                ? 'Usuarios concretos'
                                : 'Privado'}
                        </p>
                      </div>
                    </section>
                  ) : null}

                  {!isPreviewMode ? (
                    <section className="mt-10 sm:mt-12">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="theme-sheet-heading min-w-0 break-words font-headline text-[1.55rem] font-black uppercase tracking-[0.18em] [overflow-wrap:anywhere] sm:text-[2rem] sm:tracking-[0.28em]">
                          Rasgos
                        </h2>
                        {isEditing ? (
                          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                            <button
                              type="button"
                              onClick={addTrait}
                              className="theme-solid-button inline-flex items-center justify-center gap-2 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em]"
                            >
                              <Plus className="h-4 w-4" />
                              Añadir rasgo
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="theme-sheet-divider mt-5 h-px w-full" />

                      <div className="mt-6 grid gap-4 sm:mt-7 sm:gap-6 lg:grid-cols-2">
                        {isEditing
                          ? viewTraits.map((trait, index) => {
                              const isSpellTrait = isSpellTraitTypeId(
                                trait.tipoRasgoId
                              )

                              return (
                                <div
                                  key={`${trait.id || 'new'}-${index}`}
                                  className={cn(
                                    'theme-sheet-card border p-3 sm:p-4',
                                    isSpellTrait && 'lg:col-span-2'
                                  )}
                                >
                                  <div className="grid gap-3">
                                    <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2 sm:flex">
                                      {isSpellTrait ? (
                                        <div className="archive-input flex items-center rounded-none font-bold">
                                          {spellTraitType?.nombre || 'Hechizos'}
                                        </div>
                                      ) : (
                                        <input
                                          value={trait.nombre}
                                          onChange={(event) =>
                                            updateTrait(index, {
                                              nombre: event.target.value,
                                            })
                                          }
                                          className="archive-input rounded-none font-bold"
                                          placeholder="Nombre del rasgo"
                                        />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => removeTrait(index)}
                                        className="theme-sheet-soft flex h-11 items-center justify-center border px-3 text-danger sm:h-auto"
                                        aria-label="Eliminar rasgo"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                    <select
                                      value={trait.tipoRasgoId}
                                      onChange={(event) =>
                                        updateTrait(index, {
                                          tipoRasgoId: event.target.value,
                                        })
                                      }
                                      className="archive-input rounded-none"
                                    >
                                      {(editorMeta?.tiposRasgo || []).map(
                                        (type) => (
                                          <option key={type.id} value={type.id}>
                                            {type.nombre}
                                          </option>
                                        )
                                      )}
                                    </select>
                                    {isSpellTrait ? (
                                      renderObjectSpellBlock({
                                        editable: true,
                                      })
                                    ) : (
                                      <WikiTextArea
                                        value={trait.descripcion}
                                        onChange={(event) =>
                                          updateTrait(index, {
                                            descripcion: event.target.value,
                                          })
                                        }
                                        className="archive-input min-h-28 rounded-none"
                                        placeholder="Descripcion"
                                      />
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          : traitGroups.map((group) => (
                              <div key={group.id} className="min-w-0">
                                <h3 className="theme-sheet-heading mb-4 break-words font-headline text-lg font-black uppercase tracking-[0.12em] [overflow-wrap:anywhere] sm:text-xl sm:tracking-[0.16em]">
                                  {group.nombre}
                                </h3>
                                <div className="space-y-3">
                                  {group.rasgos.map((trait) => (
                                    <div
                                      key={trait.id}
                                      className="theme-sheet-card border p-3 sm:p-4"
                                    >
                                      <h4 className="theme-sheet-copy-strong break-words font-bold [overflow-wrap:anywhere]">
                                        {trait.nombre}
                                      </h4>
                                      <p className="theme-sheet-copy mt-2 whitespace-pre-line break-words text-sm leading-7 [overflow-wrap:anywhere]">
                                        <WikiText text={trait.descripcion} />
                                      </p>
                                    </div>
                                  ))}
                                  {isSpellTraitName(group.nombre)
                                    ? renderObjectSpellBlock()
                                    : null}
                                </div>
                              </div>
                            ))}
                        {(
                          isEditing ? !viewTraits.length : !traitGroups.length
                        ) ? (
                          <p className="theme-sheet-copy text-sm">
                            Este objeto aun no tiene rasgos.
                          </p>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  {isEditing && draft ? (
                    <section className="theme-sheet-soft mt-10 border p-4 sm:mt-12 sm:p-5">
                      <h2 className="theme-sheet-heading break-words font-headline text-lg font-black uppercase tracking-[0.14em] [overflow-wrap:anywhere] sm:text-xl sm:tracking-[0.18em]">
                        Privacidad
                      </h2>
                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        {[
                          ['public', 'Totalmente público'],
                          ['private', 'Totalmente privado'],
                          ['preview', 'Solo vista previa'],
                          ['custom', 'Usuarios concretos'],
                        ].map(([value, label]) => (
                          <label
                            key={value}
                            className={cn(
                              'theme-sheet-card flex items-center gap-3 break-words border p-3 text-sm font-bold [overflow-wrap:anywhere] sm:p-4',
                              draft.privacidad.mode === value && 'border-brand'
                            )}
                          >
                            <input
                              type="radio"
                              checked={draft.privacidad.mode === value}
                              onChange={() => setPrivacyMode(value)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      {draft.privacidad.mode === 'custom' ? (
                        <div className="mt-5 grid gap-2">
                          {permissionUsers.map((user) => (
                            <div
                              key={user.id}
                              className="theme-sheet-card flex flex-wrap items-center justify-between gap-3 border p-3"
                            >
                              <span className="min-w-0 break-words text-sm font-bold text-ink [overflow-wrap:anywhere]">
                                {user.nombreUsuario}
                              </span>
                              <select
                                value={getUserPermission(user.id)}
                                onChange={(event) =>
                                  setUserPermission(user.id, event.target.value)
                                }
                                className="archive-input w-full rounded-none sm:max-w-xs"
                              >
                                <option value="hidden">Oculto</option>
                                <option value="preview">Vision parcial</option>
                                <option value="full">Vision total</option>
                              </select>
                            </div>
                          ))}
                          {!permissionUsers.length ? (
                            <p className="text-sm text-ink-soft">
                              No hay usuarios no administradores disponibles.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>

                <ObjectSheetActions
                  canEdit={Boolean(viewItem.puedeEditar)}
                  isPreviewMode={isPreviewMode}
                  isEditing={isEditing}
                  isSaving={saveMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                  createMode={createMode}
                  onStartEditing={startEditing}
                  onSaveEditing={() => saveMutation.mutate()}
                  onCancelEditing={discardEditing}
                  onDelete={() => setDeleteOpen(true)}
                  creator={createMode ? null : viewOwner}
                  creatorLabel="Propietario"
                />

                {saveError ? (
                  <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {saveError}
                  </div>
                ) : null}
              </div>

              <div />
            </div>
          </div>
        </article>
        {!createMode ? (
          <CommentsSection
            key={`comentarios-objeto-${viewItem.id}`}
            targetType="objeto"
            targetId={viewItem.id}
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
