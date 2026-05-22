import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Network,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { CommentsSection } from '../components/comments/CommentsSection'
import { FavoriteStarButton } from '../components/ui/FavoriteStarButton'
import { PlacePreviewImage } from '../components/ui/PlacePreviewImage'
import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
import {
  CharacterDeleteModal,
  CharacterSheetHeader,
  CreatorBadge,
  ScrollTopButton,
} from './character-detail/components'
import { useIncrementalCardFeed } from '../hooks/useIncrementalCardFeed'
import { cn } from '../lib/cn'
import {
  ACCEPTED_IMAGE_INPUT_TYPES,
  validateImageFile,
} from '../lib/image-upload'
import { recordRecentActivity } from '../services/recent-activity'
import {
  createPlaceEditor,
  deletePlace,
  fetchOwnPlaceOptions,
  fetchOwnPlaceTrees,
  fetchPlaceCreationEditor,
  fetchPlaceDetail,
  fetchPlaceEditor,
  fetchPlaceGraph,
  fetchPlaceVersions,
  savePlaceEditor,
  signAndUploadPlaceImage,
} from './place-detail/api'

const PLACE_TABS = [
  { id: 'informacion', label: 'Informacion' },
  { id: 'galeria', label: 'Galeria' },
]

const NEW_PLACE_DRAFT_KEY = 'nuevo-lugar'

const emptyForm = {
  core: {
    campanaIds: [],
    tipoLugarId: '',
    lugarBaseId: '',
    lugarPadreId: '',
    nombre: '',
    descripcion: '',
    imagenPrincipalUrl: '',
  },
  galeria: [],
  privacidad: {
    mode: 'public',
    userPermissions: [],
  },
}

function cloneForm(value) {
  const source = value || {}

  return JSON.parse(
    JSON.stringify({
      ...emptyForm,
      ...source,
      core: {
        ...emptyForm.core,
        ...(source.core || {}),
      },
      galeria: Array.isArray(source.galeria) ? source.galeria : [],
      privacidad: {
        ...emptyForm.privacidad,
        ...(source.privacidad || {}),
        userPermissions: Array.isArray(source.privacidad?.userPermissions)
          ? source.privacidad.userPermissions
          : [],
      },
    })
  )
}

function getPlaceDraftStorageKey(placeKey) {
  return `wikicodex:place-editor-draft:${placeKey}`
}

function getPlaceDraftReloadStorageKey(placeKey) {
  return `wikicodex:place-editor-reload:${placeKey}`
}

function markPlaceDraftReloadResume(placeKey) {
  window.sessionStorage.setItem(
    getPlaceDraftReloadStorageKey(placeKey),
    JSON.stringify({ placeKey, createdAt: Date.now() })
  )
}

function clearPlaceDraftReloadResume(placeKey) {
  window.sessionStorage.removeItem(getPlaceDraftReloadStorageKey(placeKey))
}

function hasPlaceDraftReloadResume(placeKey) {
  return Boolean(
    placeKey &&
    window.sessionStorage.getItem(getPlaceDraftReloadStorageKey(placeKey))
  )
}

function consumePlaceDraftReloadResume(placeKey) {
  const storageKey = getPlaceDraftReloadStorageKey(placeKey)
  const storedValue = window.sessionStorage.getItem(storageKey)

  if (!storedValue) {
    return false
  }

  window.sessionStorage.removeItem(storageKey)

  try {
    const parsed = JSON.parse(storedValue)
    return parsed?.placeKey === placeKey
  } catch {
    return false
  }
}

function readStoredPlaceDraft(placeKey) {
  try {
    const storedValue = window.localStorage.getItem(
      getPlaceDraftStorageKey(placeKey)
    )

    if (!storedValue) {
      return null
    }

    const parsed = JSON.parse(storedValue)
    return parsed?.placeKey === placeKey && parsed?.form ? parsed : null
  } catch {
    return null
  }
}

function clearStoredPlaceDraft(placeKey) {
  window.localStorage.removeItem(getPlaceDraftStorageKey(placeKey))
  clearPlaceDraftReloadResume(placeKey)
}

function buildPlacePayload(form) {
  return {
    core: {
      ...form.core,
      tipoLugarId: form.core.tipoLugarId || null,
      lugarBaseId: form.core.lugarBaseId || null,
      lugarPadreId: form.core.lugarPadreId || null,
      descripcion: form.core.descripcion || null,
      imagenPrincipalUrl: form.core.imagenPrincipalUrl || null,
    },
    galeria: (form.galeria || []).filter((image) => image.imagenUrl?.trim()),
    privacidad: form.privacidad,
  }
}

function buildInitialForm(item, metadata) {
  if (!item) {
    return cloneForm({
      ...emptyForm,
      core: {
        ...emptyForm.core,
        tipoLugarId: metadata?.types?.[0]?.id || '',
      },
    })
  }

  return {
    core: {
      campanaIds: (item.campanas || []).map((campaign) => campaign.id),
      tipoLugarId: item.tipo?.id || '',
      lugarBaseId: item.lugarBaseId || '',
      lugarPadreId: item.lugarPadreId || '',
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      imagenPrincipalUrl: item.imagenPrincipalUrl || '',
    },
    galeria: item.galeria || [],
    privacidad: {
      mode:
        item.ambitoVisibilidadCodigo === 'campana_completo'
          ? 'public'
          : item.ambitoVisibilidadCodigo === 'campana_vista_previa'
            ? 'preview'
            : item.ambitoVisibilidadCodigo === 'usuarios_seleccionados'
              ? 'custom'
              : 'private',
      userPermissions: metadata?.currentPermissions || [],
    },
  }
}

function getPermissionForUser(form, userId) {
  return (
    form.privacidad.userPermissions.find(
      (permission) => permission.usuarioId === userId
    )?.nivelAccesoCodigo || 'hidden'
  )
}

function getTypeRank(typeId, metadata) {
  return (
    metadata.types?.find((type) => type.id === typeId)?.ordenVisualizacion ||
    metadata.types?.find((type) => type.id === typeId)?.rank ||
    null
  )
}

function canContainPlace(parent, childTypeId, metadata) {
  if (!parent || !childTypeId) {
    return true
  }

  const parentRank =
    parent.typeRank ||
    parent.tipo?.rank ||
    getTypeRank(parent.tipoLugarId, metadata)
  const childRank = getTypeRank(childTypeId, metadata)

  if (!parentRank || !childRank) {
    return true
  }

  return parentRank <= childRank
}

function PlaceGraphView({
  places,
  edges = [],
  currentId,
  selectedParentId,
  onSelectParent,
  onNodeClick,
  currentTypeId,
  metadata,
  readonly = false,
}) {
  const nodes = places || []
  const childrenByParent = new Map()
  const nodeIds = new Set(nodes.map((node) => node.id))

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      continue
    }

    const children = childrenByParent.get(edge.from) || []
    children.push(edge.to)
    childrenByParent.set(edge.from, children)
  }

  if (!edges.length) {
    for (const node of nodes) {
      if (!node.lugarPadreId || !nodeIds.has(node.lugarPadreId)) {
        continue
      }

      const children = childrenByParent.get(node.lugarPadreId) || []
      children.push(node.id)
      childrenByParent.set(node.lugarPadreId, children)
    }
  }

  const roots = nodes.filter(
    (node) => !node.lugarPadreId || !nodeIds.has(node.lugarPadreId)
  )

  function renderNode(node, depth = 0) {
    const isPrivateBridge = Boolean(node.esNodoPrivado)
    const isSelected = selectedParentId === node.id
    const isCurrent = currentId === node.id
    const invalidContainment =
      !readonly &&
      !isPrivateBridge &&
      !canContainPlace(node, currentTypeId, metadata)
    const disabled =
      isPrivateBridge ||
      (!readonly &&
        (isCurrent || invalidContainment || node.disabledAsContainer))

    return (
      <div key={node.id} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (isPrivateBridge) {
              return
            }

            if (readonly) {
              onNodeClick?.(node)
              return
            }

            onSelectParent?.(node)
          }}
          className={cn(
            'w-full rounded-xl border px-4 py-3 text-left transition',
            isPrivateBridge
              ? 'cursor-default border-dashed border-stroke bg-surface-strong/55 text-ink-muted'
              : isSelected
                ? 'border-brand bg-brand/10 text-brand'
                : isCurrent
                  ? 'border-brand/60 bg-brand/5 text-ink'
                  : 'border-stroke bg-surface-strong text-ink-soft hover:border-brand hover:text-brand',
            disabled &&
              !readonly &&
              !isPrivateBridge &&
              'cursor-not-allowed opacity-55'
          )}
          style={{ marginLeft: `${Math.min(depth, 4) * 1.25}rem` }}
        >
          <span
            className={cn(
              'font-label text-[9px] font-black uppercase tracking-[0.18em]',
              isPrivateBridge ? 'text-ink-muted' : 'text-brand'
            )}
          >
            {isPrivateBridge ? 'Privado' : node.tipo?.nombre || 'Lugar'}
          </span>
          <span
            className={cn(
              'mt-1 block font-display text-lg font-black tracking-[-0.04em]',
              isPrivateBridge ? 'text-ink-soft' : 'text-ink'
            )}
          >
            {node.nombre}
          </span>
          {invalidContainment ? (
            <span className="mt-1 block text-xs text-danger">
              No puede contener un lugar de mayor nivel.
            </span>
          ) : null}
          {!invalidContainment && node.disabledReason ? (
            <span className="mt-1 block text-xs text-danger">
              {node.disabledReason}
            </span>
          ) : null}
        </button>

        {(childrenByParent.get(node.id) || [])
          .map((childId) => nodes.find((item) => item.id === childId))
          .filter(Boolean)
          .map((child) => (
            <div key={child.id} className="mt-3 border-l border-brand/20 pl-3">
              {renderNode(child, depth + 1)}
            </div>
          ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {roots.length ? (
        roots.map((node) => renderNode(node))
      ) : (
        <p className="rounded-xl border border-dashed border-stroke bg-surface-strong/45 px-4 py-5 text-sm text-ink-soft">
          No hay lugares disponibles para dibujar el grafo.
        </p>
      )}
    </div>
  )
}

export function PlaceDetailPage({ createMode = false }) {
  const { placeId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const hydratedDraftKeyRef = useRef(null)
  const placeDraftKey = createMode ? NEW_PLACE_DRAFT_KEY : placeId
  const placeFormId = `place-editor-form-${placeDraftKey || 'new'}`
  const forceDetailView = Boolean(location.state?.forcePlaceDetailView)
  const [isEditing, setIsEditing] = useState(
    () =>
      !forceDetailView &&
      (createMode ||
        Boolean(location.state?.preservePlaceEditor) ||
        hasPlaceDraftReloadResume(placeDraftKey))
  )
  const [form, setForm] = useState(emptyForm)
  const [activeTab, setActiveTab] = useState('informacion')
  const [selectedGalleryImage, setSelectedGalleryImage] = useState('')
  const [isVersionSearchOpen, setIsVersionSearchOpen] = useState(false)
  const [isContainmentGraphOpen, setIsContainmentGraphOpen] = useState(false)
  const [placeSearch, setPlaceSearch] = useState('')
  const [treeSearch, setTreeSearch] = useState('')
  const [expandedTreeIds, setExpandedTreeIds] = useState([])
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const shouldPreservePlaceEditor = Boolean(location.state?.preservePlaceEditor)

  const detailQuery = useQuery({
    queryKey: ['place', placeId],
    queryFn: () => fetchPlaceDetail(placeId),
    enabled: Boolean(placeId) && !createMode,
  })
  const editorQuery = useQuery({
    queryKey: ['place-editor', createMode ? 'new' : placeId],
    queryFn: () =>
      createMode ? fetchPlaceCreationEditor() : fetchPlaceEditor(placeId),
    enabled: createMode || (Boolean(placeId) && isEditing),
  })
  const versionsQuery = useQuery({
    queryKey: ['place-versions', placeId],
    queryFn: () => fetchPlaceVersions(placeId),
    enabled: Boolean(placeId) && !createMode,
  })
  const graphQuery = useQuery({
    queryKey: ['place-graph', placeId],
    queryFn: () => fetchPlaceGraph(placeId),
    enabled: Boolean(placeId) && !createMode,
  })
  const ownPlacesQuery = useQuery({
    queryKey: ['place-editor-own-places', placeId || 'new', placeSearch],
    queryFn: () =>
      fetchOwnPlaceOptions({
        limit: 5,
        search: placeSearch,
        excludePlaceId: placeId || null,
      }),
    enabled: isEditing,
    staleTime: 30 * 1000,
  })
  const ownPlacesFeed = useIncrementalCardFeed({
    seedKey: `own-places:${placeId || 'new'}:${placeSearch}:${ownPlacesQuery.data?.meta?.totalVisible || 0}:${ownPlacesQuery.data?.meta?.nextCursor || 'end'}`,
    initialItems: ownPlacesQuery.data?.items || [],
    initialTotal: ownPlacesQuery.data?.meta?.totalVisible || 0,
    initialNextCursor: ownPlacesQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    initialShownCount: 5,
    fetchPage: ({ limit, cursor }) =>
      fetchOwnPlaceOptions({
        limit,
        cursor,
        search: placeSearch,
        excludePlaceId: placeId || null,
      }),
  })
  const ownPlaceTreesQuery = useQuery({
    queryKey: ['place-editor-own-place-trees', placeId || 'new', treeSearch],
    queryFn: () =>
      fetchOwnPlaceTrees({
        limit: 4,
        search: treeSearch,
        placeId: placeId || null,
      }),
    enabled: isEditing,
    staleTime: 30 * 1000,
  })
  const ownPlaceTreesFeed = useIncrementalCardFeed({
    seedKey: `own-place-trees:${placeId || 'new'}:${treeSearch}:${ownPlaceTreesQuery.data?.meta?.totalVisible || 0}:${ownPlaceTreesQuery.data?.meta?.nextCursor || 'end'}`,
    initialItems: ownPlaceTreesQuery.data?.items || [],
    initialTotal: ownPlaceTreesQuery.data?.meta?.totalVisible || 0,
    initialNextCursor: ownPlaceTreesQuery.data?.meta?.nextCursor || null,
    pageSize: 4,
    initialShownCount: 4,
    fetchPage: ({ limit, cursor }) =>
      fetchOwnPlaceTrees({
        limit,
        cursor,
        search: treeSearch,
        placeId: placeId || null,
      }),
  })

  const item = detailQuery.data
  const metadata = editorQuery.data?.metadata || {}
  const visibleItem = isEditing ? editorQuery.data?.item || item : item
  const canEditPlace = createMode || Boolean(visibleItem?.puedeEditar)
  const canDeletePlace = !createMode && Boolean(visibleItem?.puedeBorrar)

  useEffect(() => {
    if (!forceDetailView || createMode) {
      return
    }

    setIsEditing(false)
    navigate(location.pathname, { replace: true, state: null })
  }, [createMode, forceDetailView, location.pathname, navigate])

  useEffect(() => {
    if (!createMode && item && !item.puedeEditar && isEditing) {
      setIsEditing(false)
    }
  }, [createMode, isEditing, item])

  useEffect(() => {
    if (!editorQuery.data || !placeDraftKey) {
      return
    }

    const baseForm = buildInitialForm(
      editorQuery.data.item,
      editorQuery.data.metadata
    )
    const shouldRestoreAfterReload =
      consumePlaceDraftReloadResume(placeDraftKey)
    const storedDraft = readStoredPlaceDraft(placeDraftKey)
    const shouldRestoreStoredDraft =
      Boolean(storedDraft) &&
      (createMode || shouldRestoreAfterReload || shouldPreservePlaceEditor)

    hydratedDraftKeyRef.current = placeDraftKey

    if (shouldRestoreStoredDraft) {
      setForm(cloneForm(storedDraft.form))
      setActiveTab(storedDraft.activeTab || 'informacion')
      setIsEditing(true)
      return
    }

    if (!createMode && !shouldPreservePlaceEditor) {
      clearStoredPlaceDraft(placeDraftKey)
    }

    setForm(baseForm)

    if (createMode) {
      setIsEditing(true)
    }
  }, [
    createMode,
    editorQuery.data,
    isEditing,
    placeDraftKey,
    shouldPreservePlaceEditor,
  ])

  useEffect(() => {
    if (!isEditing || !placeDraftKey) {
      return
    }

    window.localStorage.setItem(
      getPlaceDraftStorageKey(placeDraftKey),
      JSON.stringify({
        placeKey: placeDraftKey,
        form: cloneForm(form),
        activeTab,
        updatedAt: Date.now(),
      })
    )
  }, [activeTab, form, isEditing, placeDraftKey])

  useEffect(() => {
    if (!isEditing || !placeDraftKey) {
      return undefined
    }

    function handleBeforeUnload() {
      window.localStorage.setItem(
        getPlaceDraftStorageKey(placeDraftKey),
        JSON.stringify({
          placeKey: placeDraftKey,
          form: cloneForm(form),
          activeTab,
          updatedAt: Date.now(),
        })
      )
      markPlaceDraftReloadResume(placeDraftKey)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [activeTab, form, isEditing, placeDraftKey])

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 520)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (createMode || !item?.id) {
      return
    }

    recordRecentActivity({
      entityType: 'place',
      entityId: item.id,
      nombre: item.nombre,
      subtitulo: item.tipo?.nombre || 'Lugar',
      imagenUrl: item.imagenPrincipalUrl,
      urlDestino: `/app/lugares/${item.id}`,
      modoVista: item.modoVista,
    })
  }, [
    createMode,
    item?.id,
    item?.imagenPrincipalUrl,
    item?.modoVista,
    item?.nombre,
    item?.tipo?.nombre,
  ])

  const saveMutation = useMutation({
    mutationFn: async ({ currentForm, versionIds = [] }) => {
      if (createMode) {
        const created = await createPlaceEditor(buildPlacePayload(currentForm))
        return { item: created, savedIds: [NEW_PLACE_DRAFT_KEY] }
      }

      const draftsToSave = [
        { placeId, form: currentForm },
        ...versionIds
          .filter((versionId) => versionId && versionId !== placeId)
          .map((versionId) => {
            const storedDraft = readStoredPlaceDraft(versionId)
            return storedDraft?.form
              ? { placeId: versionId, form: storedDraft.form }
              : null
          })
          .filter(Boolean),
      ]
      const uniqueDrafts = draftsToSave.filter(
        (entry, index, entries) =>
          entries.findIndex((item) => item.placeId === entry.placeId) === index
      )
      let currentSaved = null

      for (const entry of uniqueDrafts) {
        const saved = await savePlaceEditor(
          entry.placeId,
          buildPlacePayload(entry.form)
        )

        if (entry.placeId === placeId) {
          currentSaved = saved
        }
      }

      return {
        item: currentSaved,
        savedIds: uniqueDrafts.map((entry) => entry.placeId),
      }
    },
    onSuccess: ({ item: saved, savedIds }) => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['places'] })
      queryClient.invalidateQueries({ queryKey: ['place-versions'] })
      queryClient.invalidateQueries({ queryKey: ['place-graph'] })

      for (const savedId of savedIds || []) {
        clearStoredPlaceDraft(savedId)
      }

      if (saved?.id) {
        setIsEditing(false)
        setActiveTab('informacion')
        queryClient.invalidateQueries({ queryKey: ['place', saved.id] })
        navigate(`/app/lugares/${saved.id}`, {
          replace: true,
          state: { forcePlaceDetailView: true },
        })
        return
      }

      queryClient.invalidateQueries({ queryKey: ['place', placeId] })
      setIsEditing(false)
    },
    onError: (mutationError) => {
      setError(
        mutationError?.response?.data?.message ||
          mutationError?.message ||
          'No se pudo guardar el lugar.'
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deletePlace(placeId),
    onSuccess: () => {
      setDeleteOpen(false)
      setDeleteConfirm('')
      setDeleteError('')
      queryClient.invalidateQueries({ queryKey: ['places'] })
      navigate(location.state?.returnTo?.pathname || '/app/lugares')
    },
    onError: (mutationError) => {
      setDeleteError(
        mutationError?.response?.data?.message ||
          mutationError?.message ||
          'No se pudo borrar el lugar.'
      )
    },
  })

  function updateCore(nextCore) {
    setForm((current) => ({
      ...current,
      core: {
        ...current.core,
        ...nextCore,
      },
    }))
  }

  function persistPlaceDraftSnapshot() {
    if (!isEditing || !placeDraftKey) {
      return
    }

    window.localStorage.setItem(
      getPlaceDraftStorageKey(placeDraftKey),
      JSON.stringify({
        placeKey: placeDraftKey,
        form: cloneForm(form),
        activeTab,
        updatedAt: Date.now(),
      })
    )
  }

  function discardPlaceEditing(versionIds = []) {
    const idsToClear = new Set([placeDraftKey, ...versionIds].filter(Boolean))

    for (const draftKey of idsToClear) {
      clearStoredPlaceDraft(draftKey)
    }

    if (editorQuery.data) {
      setForm(
        buildInitialForm(editorQuery.data.item, editorQuery.data.metadata)
      )
    }

    if (createMode) {
      navigate('/app/lugares', { replace: true })
      return
    }

    setIsEditing(false)
  }

  function toggleCampaign(campaignId) {
    const currentIds = form.core.campanaIds || []
    updateCore({
      campanaIds: currentIds.includes(campaignId)
        ? currentIds.filter((id) => id !== campaignId)
        : [...currentIds, campaignId],
    })
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setIsUploading(true)
    setError('')

    try {
      const url = await signAndUploadPlaceImage({
        file,
        campaignId: form.core.campanaIds?.[0] || null,
        placeId,
      })
      updateCore({ imagenPrincipalUrl: url })
    } catch (uploadError) {
      setError(uploadError.message || 'No se pudo subir la imagen.')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  async function handleGalleryUpload(event) {
    const files = Array.from(event.target.files || [])

    if (!files.length) {
      return
    }

    setIsUploading(true)
    setError('')

    try {
      await Promise.all(files.map((file) => validateImageFile(file)))

      const uploaded = []

      for (const file of files) {
        const url = await signAndUploadPlaceImage({
          file,
          campaignId: form.core.campanaIds?.[0] || null,
          placeId,
        })
        uploaded.push({
          imagenUrl: url,
          titulo: file.name?.replace(/\.[^.]+$/u, '') || '',
        })
      }

      setForm((current) => ({
        ...current,
        galeria: [...(current.galeria || []), ...uploaded],
      }))
      setSelectedGalleryImage(uploaded[uploaded.length - 1]?.imagenUrl || '')
    } catch (uploadError) {
      setError(uploadError.message || 'No se pudo subir la galería.')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  function removeGalleryImage(imageUrl) {
    setForm((current) => ({
      ...current,
      galeria: (current.galeria || []).filter(
        (image) => image.imagenUrl !== imageUrl
      ),
    }))
  }

  function promoteGalleryImageToMain(imageUrl) {
    setForm((current) => {
      const previousMain = current.core.imagenPrincipalUrl
      const nextGallery = (current.galeria || []).filter(
        (image) => image.imagenUrl !== imageUrl
      )

      if (
        previousMain &&
        previousMain !== imageUrl &&
        !nextGallery.some((image) => image.imagenUrl === previousMain)
      ) {
        nextGallery.unshift({
          id: null,
          imagenUrl: previousMain,
          titulo: 'Portada anterior',
        })
      }

      return {
        ...current,
        core: {
          ...current.core,
          imagenPrincipalUrl: imageUrl,
        },
        galeria: nextGallery,
      }
    })
    setSelectedGalleryImage(imageUrl)
  }

  function submitForm(event) {
    event.preventDefault()
    saveMutation.mutate({
      currentForm: form,
      versionIds: (versionsQuery.data?.versiones || []).map(
        (version) => version.id
      ),
    })
  }

  function goBack() {
    if (isEditing) {
      discardPlaceEditing(
        (versionsQuery.data?.versiones || []).map((version) => version.id)
      )

      if (createMode) {
        return
      }
    }

    const returnTo = location.state?.returnTo

    if (returnTo?.pathname) {
      navigate(returnTo.pathname)
      return
    }

    navigate('/app/lugares')
  }

  const viewName = isEditing
    ? form.core.nombre || 'Nuevo lugar'
    : visibleItem?.nombre || 'Lugar'
  const ownPlaceOptions = ownPlacesFeed.items || []
  const ownPlaceTrees = ownPlaceTreesFeed.items || []
  const ownTreeNodes = ownPlaceTrees.flatMap((tree) => tree.nodes || [])
  const selectedParent =
    ownPlaceOptions.find((place) => place.id === form.core.lugarPadreId) ||
    ownTreeNodes.find((place) => place.id === form.core.lugarPadreId)
  const currentTypeId = form.core.tipoLugarId || visibleItem?.tipo?.id || ''
  const graphNodes = graphQuery.data?.nodes || []
  const graphEdges = graphQuery.data?.edges || []
  const placeVersions = versionsQuery.data?.versiones || []
  const gallerySource = isEditing
    ? {
        nombre: form.core.nombre || 'Lugar',
        imagenPrincipalUrl: form.core.imagenPrincipalUrl,
        galeria: form.galeria || [],
      }
    : visibleItem
  const galleryImages = useMemo(() => {
    const mainImage = gallerySource?.imagenPrincipalUrl
    const secondaryImages = gallerySource?.galeria || []
    const images = []

    if (mainImage) {
      images.push({
        id: 'principal',
        imagenUrl: mainImage,
        titulo: 'Portada',
        isPrincipal: true,
      })
    }

    for (const image of secondaryImages) {
      if (!image?.imagenUrl || image.imagenUrl === mainImage) {
        continue
      }

      images.push({
        ...image,
        id: image.id || image.imagenUrl,
        isPrincipal: false,
      })
    }

    return images
  }, [gallerySource?.galeria, gallerySource?.imagenPrincipalUrl])
  const selectedGalleryIndex = Math.max(
    0,
    galleryImages.findIndex((image) => image.imagenUrl === selectedGalleryImage)
  )
  const selectedGalleryEntry = galleryImages[selectedGalleryIndex] || null

  useEffect(() => {
    if (!galleryImages.length) {
      setSelectedGalleryImage('')
      return
    }

    if (
      !selectedGalleryImage ||
      !galleryImages.some((image) => image.imagenUrl === selectedGalleryImage)
    ) {
      setSelectedGalleryImage(galleryImages[0].imagenUrl)
    }
  }, [galleryImages, selectedGalleryImage])

  function renderPlaceGallery() {
    return (
      <div className="space-y-6" data-editor-anchor="place-gallery-section">
        {isEditing ? (
          <div className="flex flex-wrap justify-end gap-3">
            <input
              ref={galleryInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_INPUT_TYPES}
              multiple
              className="hidden"
              onChange={handleGalleryUpload}
            />
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={isUploading}
              className="theme-solid-button inline-flex items-center gap-2 rounded-md px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {isUploading ? 'Subiendo galeria...' : 'Añadir imágenes'}
            </button>
          </div>
        ) : null}

        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!galleryImages.length) {
                  return
                }

                const nextIndex =
                  selectedGalleryIndex <= 0
                    ? galleryImages.length - 1
                    : selectedGalleryIndex - 1
                setSelectedGalleryImage(galleryImages[nextIndex].imagenUrl)
              }}
              disabled={galleryImages.length <= 1}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-surface-strong text-ink-soft shadow-sm transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex min-h-[340px] items-center justify-center overflow-hidden border border-stroke bg-surface-strong/55 p-4 sm:min-h-[460px] xl:min-h-[560px]">
              {selectedGalleryEntry ? (
                <CloudinaryImage
                  src={selectedGalleryEntry.imagenUrl}
                  alt={`${gallerySource?.nombre || 'Lugar'} - imagen destacada`}
                  variant="detail"
                  sizes="(max-width: 768px) 100vw, 1100px"
                  className="h-full max-h-[300px] w-full object-contain sm:max-h-[420px] xl:max-h-[520px]"
                />
              ) : (
                <div className="flex h-[300px] w-full items-center justify-center bg-surface-strong text-sm text-ink-muted sm:h-[420px] xl:h-[520px]">
                  Sin imágenes
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (!galleryImages.length) {
                  return
                }

                const nextIndex =
                  selectedGalleryIndex >= galleryImages.length - 1
                    ? 0
                    : selectedGalleryIndex + 1
                setSelectedGalleryImage(galleryImages[nextIndex].imagenUrl)
              }}
              disabled={galleryImages.length <= 1}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stroke bg-surface-strong text-ink-soft shadow-sm transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Siguiente imagen"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 text-center font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
            {galleryImages.length
              ? `${selectedGalleryIndex + 1} / ${galleryImages.length}`
              : 'Sin imágenes'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {galleryImages.length ? (
            galleryImages.map((image, index) => {
              const isSelected = selectedGalleryImage === image.imagenUrl
              const isPrincipal =
                image.imagenUrl === gallerySource?.imagenPrincipalUrl

              return (
                <div
                  key={`${image.id || image.imagenUrl}-${index}`}
                  className={cn(
                    'overflow-hidden border bg-surface transition',
                    isSelected
                      ? 'border-brand theme-brand-outline'
                      : 'border-stroke hover:border-brand/60'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedGalleryImage(image.imagenUrl)}
                    className="block w-full"
                  >
                    <CloudinaryImage
                      src={image.imagenUrl}
                      alt={`${gallerySource?.nombre || 'Lugar'} - galeria ${index + 1}`}
                      variant="card"
                      sizes="(max-width: 768px) 50vw, 220px"
                      className="h-28 w-full object-cover sm:h-32"
                    />
                  </button>

                  {isEditing ? (
                    <div className="grid gap-2 border-t border-stroke p-2">
                      {!isPrincipal ? (
                        <button
                          type="button"
                          onClick={() =>
                            promoteGalleryImageToMain(image.imagenUrl)
                          }
                          className="border border-stroke bg-surface-strong px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
                        >
                          Usar de portada
                        </button>
                      ) : (
                        <span className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                          Portada actual
                        </span>
                      )}

                      {!isPrincipal ? (
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(image.imagenUrl)}
                          className="border border-danger/30 bg-danger/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-danger"
                        >
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })
          ) : (
            <div className="col-span-full border border-stroke bg-surface-strong/45 px-6 py-6">
              <p className="text-sm text-ink-soft">
                Este lugar todavía no tiene imágenes en galería.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (detailQuery.isLoading || editorQuery.isLoading) {
    return (
      <div className="theme-sheet-card border p-8 text-sm text-ink-soft shadow-card">
        Cargando lugar...
      </div>
    )
  }

  if (!createMode && detailQuery.isError) {
    return (
      <div className="theme-sheet-card border border-danger/40 p-8 text-sm font-semibold text-danger shadow-card">
        No se pudo cargar el lugar.
      </div>
    )
  }

  return (
    <>
      <CharacterDeleteModal
        open={deleteOpen}
        characterName={visibleItem?.nombre || 'este lugar'}
        entityLabel="lugar"
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
        <article className="entity-sheet entity-sheet--place theme-sheet-shell overflow-hidden shadow-card">
          <CharacterSheetHeader
            tabs={PLACE_TABS}
            activeTab={activeTab}
            characterId={placeDraftKey}
            characterName={viewName}
            onTabChange={({ tab }) => setActiveTab(tab)}
            onBack={goBack}
          />

          <div className="mx-auto w-full max-w-[84rem] px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-8 xl:px-6">
            {!createMode && item?.id ? (
              <div className="mb-3 flex justify-end gap-2">
                <FavoriteStarButton entityType="place" entityId={item.id} />
                {item.puedeEditar && !isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-white text-ink-soft shadow-card transition hover:border-brand hover:text-brand"
                    aria-label="Editar lugar"
                    title="Editar lugar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[1.8rem,minmax(0,1fr),1.8rem] xl:gap-3 2xl:grid-cols-[2rem,minmax(0,1fr),2rem]">
              <div />

              <div className="mx-auto w-full max-w-[40rem] sm:max-w-[44rem] md:max-w-none">
                <div
                  className={`theme-sheet-frame border px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8 xl:px-10 xl:py-10 ${
                    isEditing
                      ? 'border-brand/50 theme-brand-outline-soft'
                      : 'border-slate-200'
                  }`}
                >
                  {placeVersions.length > 1 ? (
                    <div className="mb-5 flex flex-wrap gap-2">
                      {placeVersions.map((version) => (
                        <Link
                          key={version.id}
                          to={`/app/lugares/${version.id}`}
                          state={{
                            ...(location.state || {}),
                            preservePlaceEditor: isEditing,
                          }}
                          onClick={() => {
                            if (isEditing) {
                              persistPlaceDraftSnapshot()
                            }
                          }}
                          className={`min-w-0 break-words rounded-md border px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.14em] transition [overflow-wrap:anywhere] sm:tracking-[0.16em] ${
                            version.id === placeId
                              ? 'border-brand bg-brand/10 text-brand'
                              : 'border-stroke bg-surface-strong text-ink-soft hover:border-brand hover:text-brand'
                          }`}
                        >
                          {version.nombre}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {isEditing ? (
                    <form
                      id={placeFormId}
                      onSubmit={submitForm}
                      className="grid gap-6"
                    >
                      {activeTab === 'informacion' ? (
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                          <div className="grid gap-4">
                            <input
                              value={form.core.nombre}
                              onChange={(event) =>
                                updateCore({ nombre: event.target.value })
                              }
                              placeholder="Nombre del lugar"
                              className="archive-input font-display text-3xl font-black tracking-normal sm:tracking-[-0.04em]"
                              required
                            />
                            <WikiTextArea
                              value={form.core.descripcion || ''}
                              onChange={(event) =>
                                updateCore({ descripcion: event.target.value })
                              }
                              placeholder="Descripción del lugar"
                              rows={8}
                              className="archive-input resize-y"
                            />

                            <div className="grid gap-3">
                              <select
                                value={form.core.tipoLugarId}
                                onChange={(event) =>
                                  updateCore({
                                    tipoLugarId: event.target.value,
                                  })
                                }
                                className="archive-input"
                              >
                                <option value="">Clasificación</option>
                                {(metadata.types || []).map((type) => (
                                  <option key={type.id} value={type.id}>
                                    {type.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="theme-sheet-card border p-4">
                              <button
                                type="button"
                                onClick={() =>
                                  setIsVersionSearchOpen((current) => !current)
                                }
                                className="flex w-full items-center justify-between gap-3 text-left"
                              >
                                <span className="min-w-0">
                                  <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                                    Versiones
                                  </span>
                                  <span className="mt-1 block break-words text-sm text-ink-soft [overflow-wrap:anywhere]">
                                    {form.core.lugarBaseId
                                      ? `Version de ${
                                          ownPlaceOptions.find(
                                            (place) =>
                                              place.id === form.core.lugarBaseId
                                          )?.nombre || 'otro lugar'
                                        }`
                                      : 'Este lugar no es version de otro.'}
                                  </span>
                                </span>
                                <ChevronDown
                                  className={`h-5 w-5 text-ink-muted transition ${
                                    isVersionSearchOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              {isVersionSearchOpen ? (
                                <div className="mt-4 grid gap-3">
                                  <input
                                    type="search"
                                    value={placeSearch}
                                    onChange={(event) =>
                                      setPlaceSearch(event.target.value)
                                    }
                                    placeholder="Buscar entre tus lugares..."
                                    className="archive-input"
                                  />

                                  {form.core.lugarBaseId ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCore({ lugarBaseId: '' })
                                      }
                                      className="inline-flex w-fit items-center gap-2 rounded-md border border-danger/40 px-3 py-2 text-xs font-bold text-danger"
                                    >
                                      <X className="h-4 w-4" />
                                      Quitar version
                                    </button>
                                  ) : null}

                                  <div className="grid gap-2">
                                    {ownPlaceOptions.map((place) => (
                                      <button
                                        type="button"
                                        key={place.id}
                                        disabled={place.disabledAsVersion}
                                        onClick={() =>
                                          updateCore({ lugarBaseId: place.id })
                                        }
                                        className={cn(
                                          'theme-sheet-soft min-w-0 border px-4 py-3 text-left transition hover:border-brand/50',
                                          form.core.lugarBaseId === place.id &&
                                            'border-brand text-brand',
                                          place.disabledAsVersion &&
                                            'cursor-not-allowed opacity-45'
                                        )}
                                      >
                                        <span className="break-words font-display text-base font-bold text-ink [overflow-wrap:anywhere]">
                                          {place.nombre}
                                        </span>
                                        <span className="mt-1 block break-words text-xs text-ink-soft [overflow-wrap:anywhere]">
                                          {place.tipo?.nombre || 'Lugar'}
                                          {place.disabledReason
                                            ? ` · ${place.disabledReason}`
                                            : ''}
                                        </span>
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={ownPlacesFeed.loadMore}
                                      disabled={
                                        !ownPlacesFeed.canLoadMore ||
                                        ownPlacesFeed.isFetchingMore
                                      }
                                      className="inline-flex items-center gap-2 rounded-md border border-stroke bg-surface-strong px-3 py-2 text-xs font-bold text-ink-soft disabled:opacity-45"
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                      Cargar 10 mas
                                    </button>
                                    <button
                                      type="button"
                                      onClick={ownPlacesFeed.loadAll}
                                      disabled={
                                        !ownPlacesFeed.canLoadMore ||
                                        ownPlacesFeed.isFetchingMore
                                      }
                                      className="theme-solid-button rounded-md px-3 py-2 text-xs font-bold"
                                    >
                                      Cargar todos
                                    </button>
                                    <button
                                      type="button"
                                      onClick={ownPlacesFeed.showRecent}
                                      disabled={!ownPlacesFeed.canLoadLess}
                                      className="inline-flex items-center gap-2 rounded-md bg-surface-strong px-3 py-2 text-xs font-bold text-ink-soft disabled:opacity-45"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                      Inicio
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="theme-sheet-card border p-4">
                              <button
                                type="button"
                                onClick={() =>
                                  setIsContainmentGraphOpen(
                                    (current) => !current
                                  )
                                }
                                className="flex w-full items-center justify-between gap-3 text-left"
                              >
                                <span className="min-w-0">
                                  <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                                    Contencion visual
                                  </span>
                                  <span className="mt-1 block break-words text-sm text-ink-soft [overflow-wrap:anywhere]">
                                    {selectedParent
                                      ? `Dentro de ${selectedParent.nombre}`
                                      : 'Selecciona graficamente el lugar contenedor.'}
                                  </span>
                                </span>
                                <Network className="h-5 w-5 text-brand" />
                              </button>

                              {isContainmentGraphOpen ? (
                                <div className="mt-4 grid gap-3">
                                  <input
                                    type="search"
                                    value={treeSearch}
                                    onChange={(event) =>
                                      setTreeSearch(event.target.value)
                                    }
                                    placeholder="Buscar arboles por lugar..."
                                    className="archive-input"
                                  />
                                  {form.core.lugarPadreId ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCore({ lugarPadreId: '' })
                                      }
                                      className="inline-flex w-fit items-center gap-2 rounded-md border border-stroke bg-surface-strong px-3 py-2 text-xs font-bold text-ink-soft"
                                    >
                                      <X className="h-4 w-4" />
                                      Quitar contenedor
                                    </button>
                                  ) : null}

                                  <div className="grid gap-3">
                                    {ownPlaceTrees.map((tree) => {
                                      const isExpanded =
                                        expandedTreeIds.includes(tree.id)

                                      return (
                                        <div
                                          key={tree.id}
                                          className="rounded-xl border border-stroke bg-surface-strong/45 p-3"
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedTreeIds((current) =>
                                                current.includes(tree.id)
                                                  ? current.filter(
                                                      (treeId) =>
                                                        treeId !== tree.id
                                                    )
                                                  : [...current, tree.id]
                                              )
                                            }
                                            className="flex w-full items-center justify-between gap-3 text-left"
                                          >
                                            <span className="min-w-0">
                                              <span className="font-display text-base font-bold text-ink">
                                                {tree.root?.nombre || 'Arbol'}
                                              </span>
                                              <span className="mt-1 block break-words text-xs text-ink-soft [overflow-wrap:anywhere]">
                                                {tree.root?.tipo?.nombre ||
                                                  'Lugar'}{' '}
                                                · {tree.totalPlaces} lugares
                                                contenidos
                                              </span>
                                            </span>
                                            <ChevronDown
                                              className={cn(
                                                'h-5 w-5 text-ink-muted transition',
                                                isExpanded && 'rotate-180'
                                              )}
                                            />
                                          </button>

                                          {isExpanded ? (
                                            <div className="mt-3">
                                              <PlaceGraphView
                                                places={tree.nodes || []}
                                                currentId={placeId}
                                                selectedParentId={
                                                  form.core.lugarPadreId
                                                }
                                                onSelectParent={(place) =>
                                                  updateCore({
                                                    lugarPadreId: place.id,
                                                  })
                                                }
                                                currentTypeId={currentTypeId}
                                                metadata={metadata}
                                              />
                                            </div>
                                          ) : null}
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {!ownPlaceTrees.length ? (
                                    <p className="rounded-xl border border-dashed border-stroke bg-surface-strong/45 px-4 py-5 text-sm text-ink-soft">
                                      No hay arboles de lugares disponibles con
                                      ese filtro.
                                    </p>
                                  ) : null}

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={ownPlaceTreesFeed.loadMore}
                                      disabled={
                                        !ownPlaceTreesFeed.canLoadMore ||
                                        ownPlaceTreesFeed.isFetchingMore
                                      }
                                      className="inline-flex items-center gap-2 rounded-md border border-stroke bg-surface-strong px-3 py-2 text-xs font-bold text-ink-soft disabled:opacity-45"
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                      Cargar mas
                                    </button>
                                    <button
                                      type="button"
                                      onClick={ownPlaceTreesFeed.loadLess}
                                      disabled={
                                        !ownPlaceTreesFeed.canLoadLess ||
                                        ownPlaceTreesFeed.isFetchingMore
                                      }
                                      className="inline-flex items-center gap-2 rounded-md border border-stroke bg-surface-strong px-3 py-2 text-xs font-bold text-ink-soft disabled:opacity-45"
                                    >
                                      Cargar menos
                                    </button>
                                    <button
                                      type="button"
                                      onClick={ownPlaceTreesFeed.showRecent}
                                      disabled={!ownPlaceTreesFeed.canLoadLess}
                                      className="inline-flex items-center gap-2 rounded-md bg-surface-strong px-3 py-2 text-xs font-bold text-ink-soft disabled:opacity-45"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                      Inicio
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="theme-sheet-card border p-4">
                              <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                                Campañas
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(metadata.campaigns || []).map((campaign) => (
                                  <button
                                    type="button"
                                    key={campaign.id}
                                    onClick={() => toggleCampaign(campaign.id)}
                                    className={`max-w-full break-words rounded-full border px-4 py-2 text-xs font-bold transition [overflow-wrap:anywhere] ${
                                      form.core.campanaIds?.includes(
                                        campaign.id
                                      )
                                        ? 'border-brand bg-brand/10 text-brand'
                                        : 'border-stroke bg-surface-strong text-ink-soft'
                                    }`}
                                  >
                                    {campaign.nombre}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="theme-sheet-card border p-4">
                              <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                                Privacidad
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                {[
                                  ['public', 'Público'],
                                  ['private', 'Privado'],
                                  ['preview', 'Solo vista previa'],
                                  ['custom', 'Usuarios concretos'],
                                ].map(([value, label]) => (
                                  <button
                                    type="button"
                                    key={value}
                                    onClick={() =>
                                      setForm((current) => ({
                                        ...current,
                                        privacidad: {
                                          ...current.privacidad,
                                          mode: value,
                                        },
                                      }))
                                    }
                                    className={`rounded-md border px-4 py-3 text-sm font-bold transition ${
                                      form.privacidad.mode === value
                                        ? 'border-brand bg-brand/10 text-brand'
                                        : 'border-stroke bg-surface-strong text-ink-soft'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                              {form.privacidad.mode === 'custom' ? (
                                <div className="mt-4 grid gap-3">
                                  {(metadata.users || []).map((user) => (
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
                                            getPermissionForUser(
                                              form,
                                              user.id
                                            ) === value

                                          return (
                                            <button
                                              type="button"
                                              key={value}
                                              onClick={() =>
                                                setForm((current) => {
                                                  const rest =
                                                    current.privacidad.userPermissions.filter(
                                                      (permission) =>
                                                        permission.usuarioId !==
                                                        user.id
                                                    )
                                                  return {
                                                    ...current,
                                                    privacidad: {
                                                      ...current.privacidad,
                                                      userPermissions:
                                                        value === 'hidden'
                                                          ? rest
                                                          : [
                                                              ...rest,
                                                              {
                                                                usuarioId:
                                                                  user.id,
                                                                nivelAccesoCodigo:
                                                                  value,
                                                              },
                                                            ],
                                                    },
                                                  }
                                                })
                                              }
                                              className={`rounded-md border px-3 py-2 text-xs font-bold transition ${
                                                selected
                                                  ? 'border-brand bg-brand/10 text-brand'
                                                  : 'border-stroke bg-surface-strong text-ink-soft'
                                              }`}
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

                          <aside className="order-first grid w-full max-w-[16rem] content-start gap-4 justify-self-center lg:order-none lg:max-w-none lg:justify-self-auto">
                            <PlacePreviewImage
                              src={form.core.imagenPrincipalUrl}
                              alt={form.core.nombre || 'Lugar'}
                              className="aspect-[3/4] rounded-xl"
                              sizes="360px"
                            />
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept={ACCEPTED_IMAGE_INPUT_TYPES}
                              onChange={handleUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                              className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                            >
                              <Upload className="h-4 w-4" />
                              {isUploading ? 'Subiendo...' : 'Subir imagen'}
                            </button>
                          </aside>
                        </div>
                      ) : (
                        renderPlaceGallery()
                      )}

                      {error ? (
                        <p className="rounded-md bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                          {error}
                        </p>
                      ) : null}
                    </form>
                  ) : activeTab === 'informacion' ? (
                    <div>
                      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-7">
                        <div>
                          <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                            {visibleItem?.tipo?.nombre || 'Lugar'}
                          </p>
                          <h1 className="mt-3 break-words font-display text-3xl font-black tracking-normal text-ink [overflow-wrap:anywhere] sm:text-5xl sm:tracking-[-0.06em]">
                            {visibleItem?.nombre}
                          </h1>
                          <p className="mt-5 whitespace-pre-line break-words text-base leading-8 text-ink-soft [overflow-wrap:anywhere]">
                            <WikiText
                              text={visibleItem?.descripcion}
                              emptyText="Sin descripción registrada."
                            />
                          </p>
                          {visibleItem?.lugarPadre ? (
                            <p className="mt-5 break-words text-sm text-ink-soft [overflow-wrap:anywhere]">
                              Dentro de{' '}
                              <Link
                                to={`/app/lugares/${visibleItem.lugarPadre.id}`}
                                className="font-bold text-brand"
                              >
                                {visibleItem.lugarPadre.nombre}
                              </Link>
                            </p>
                          ) : null}
                        </div>
                        <PlacePreviewImage
                          src={visibleItem?.imagenPrincipalUrl}
                          alt={visibleItem?.nombre}
                          className="order-first aspect-[3/4] w-full max-w-[16rem] justify-self-center rounded-xl lg:order-none lg:max-w-none lg:justify-self-auto"
                          sizes="360px"
                        />
                      </div>

                      {graphNodes.length ? (
                        <div className="mt-8 border-t border-stroke pt-6">
                          <div className="mb-4 flex items-center gap-2">
                            <GitBranch className="h-5 w-5 text-brand" />
                            <h2 className="font-display text-2xl font-black text-ink">
                              Arbol de contencion visible
                            </h2>
                          </div>
                          <PlaceGraphView
                            places={graphNodes}
                            edges={graphEdges}
                            currentId={placeId}
                            metadata={metadata}
                            onNodeClick={(node) =>
                              navigate(`/app/lugares/${node.id}`)
                            }
                            readonly
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    renderPlaceGallery()
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid gap-3 sm:flex sm:flex-wrap sm:justify-start">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            discardPlaceEditing(
                              placeVersions.map((version) => version.id)
                            )
                          }
                          disabled={saveMutation.isPending}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-stroke bg-surface-strong px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <X className="h-4 w-4" />
                          {createMode ? 'Descartar lugar' : 'Cancelar edición'}
                        </button>
                        <button
                          type="submit"
                          form={placeFormId}
                          disabled={saveMutation.isPending}
                          className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Save className="h-4 w-4" />
                          {saveMutation.isPending
                            ? 'Guardando...'
                            : 'Guardar lugar'}
                        </button>
                      </>
                    ) : canEditPlace ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        {canDeletePlace ? (
                          <button
                            type="button"
                            onClick={() => setDeleteOpen(true)}
                            disabled={deleteMutation.isPending}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-danger/40 px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:border-danger/60 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deleteMutation.isPending
                              ? 'Eliminando...'
                              : 'Eliminar'}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  {!createMode ? (
                    <CreatorBadge creator={visibleItem?.creadoPor} />
                  ) : null}
                </div>
              </div>

              <div />
            </div>
          </div>
        </article>
        {!createMode ? (
          <CommentsSection
            key={`comentarios-lugar-${visibleItem.id}`}
            targetType="lugar"
            targetId={visibleItem.id}
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
