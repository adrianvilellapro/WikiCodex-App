import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Music,
  Pencil,
  Save,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { CommentsSection } from '../components/comments/CommentsSection'
import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
import {
  CharacterSheetHeader,
  ScrollTopButton,
} from './character-detail/components'
import {
  fetchCampaignCharacters,
  fetchCampaignSessionDetail,
  signAndUploadCampaignImage,
  updateCampaignSessionDetail,
} from './campaign-detail/api'
import { SessionCombatList } from './CombatManagerPage'
import {
  ACCEPTED_IMAGE_INPUT_TYPES,
  validateImageFile,
} from '../lib/image-upload'
import { recordRecentActivity } from '../services/recent-activity'

const SESSION_TABS = [
  { id: 'informacion', label: 'Información' },
  { id: 'personajes', label: 'Personajes' },
  { id: 'combates', label: 'Combates' },
  { id: 'musica', label: 'Música' },
  { id: 'galeria', label: 'Galería' },
]

const SESSION_DRAFT_PREFIX = 'wikicodex:campaign-session-editor:draft'
const SESSION_RELOAD_PREFIX = 'wikicodex:campaign-session-editor:reload'

function getSessionDraftKey(campaignId, sessionId) {
  return `${SESSION_DRAFT_PREFIX}:${campaignId || 'campana'}:${sessionId || 'partida'}`
}

function getSessionReloadKey(campaignId, sessionId) {
  return `${SESSION_RELOAD_PREFIX}:${campaignId || 'campana'}:${sessionId || 'partida'}`
}

function readStoredDraft(campaignId, sessionId) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(
      getSessionDraftKey(campaignId, sessionId)
    )
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStoredDraft(campaignId, sessionId, draft) {
  if (typeof window === 'undefined' || !draft) {
    return
  }

  window.localStorage.setItem(
    getSessionDraftKey(campaignId, sessionId),
    JSON.stringify(draft)
  )
}

function clearStoredDraft(campaignId, sessionId) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(getSessionDraftKey(campaignId, sessionId))
  window.sessionStorage.removeItem(getSessionReloadKey(campaignId, sessionId))
}

function markSessionReload(campaignId, sessionId) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(getSessionReloadKey(campaignId, sessionId), '1')
}

function consumeSessionReload(campaignId, sessionId) {
  if (typeof window === 'undefined') {
    return false
  }

  const key = getSessionReloadKey(campaignId, sessionId)
  const shouldResume = window.sessionStorage.getItem(key) === '1'
  window.sessionStorage.removeItem(key)
  return shouldResume
}

function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : ''
}

function isValidHttpUrl(value) {
  if (!value?.trim()) {
    return true
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getMusicTitle(item, index) {
  if (item?.titulo?.trim()) {
    return item.titulo.trim()
  }

  try {
    const url = new URL(item.musicaUrl)
    const hostname = url.hostname.replace(/^www\./u, '')
    return `Tema ${String(index + 1).padStart(2, '0')} · ${hostname}`
  } catch {
    return `Tema ${String(index + 1).padStart(2, '0')}`
  }
}

function sessionToDraft(item) {
  return {
    nombre: item?.nombre || '',
    descripcion: item?.descripcion || '',
    imagenUrl: item?.imagenUrl || '',
    jugadaEn:
      dateInputValue(item?.jugadaEn) || new Date().toISOString().slice(0, 10),
    aventuraId: item?.aventuraId || '',
    arcoId: item?.arcoId || '',
    personajeIds: (item?.personajes || []).map((character) => character.id),
    temasMusicales: item?.temasMusicales || [],
    galeriaImagenes: item?.galeriaImagenes || [],
  }
}

function normalizeSessionDetailPayload(draft) {
  return {
    nombre: draft.nombre,
    descripcion: draft.descripcion || null,
    imagenUrl: draft.imagenUrl || null,
    jugadaEn: draft.jugadaEn,
    aventuraId: draft.aventuraId || null,
    arcoId: draft.arcoId || null,
    personajeIds: draft.personajeIds || [],
    temasMusicales: (draft.temasMusicales || [])
      .filter((item) => item.musicaUrl?.trim())
      .map((item) => ({
        titulo: item.titulo || null,
        musicaUrl: item.musicaUrl.trim(),
      })),
    galeriaImagenes: (draft.galeriaImagenes || [])
      .filter((item) => item.imagenUrl)
      .map((item) => ({
        imagenUrl: item.imagenUrl,
        titulo: item.titulo || null,
      })),
  }
}

function useScrollTopVisible() {
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

export function CampaignSessionDetailPage() {
  const { campaignId, sessionId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const requestedTab = searchParams.get('tab')
  const activeTab = SESSION_TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : 'informacion'
  const [resumeFromReload] = useState(() =>
    consumeSessionReload(campaignId, sessionId)
  )
  const [initialStoredDraft] = useState(() =>
    resumeFromReload ? readStoredDraft(campaignId, sessionId) : null
  )
  const [isEditing, setIsEditing] = useState(Boolean(initialStoredDraft))
  const [draft, setDraft] = useState(initialStoredDraft)
  const [characterSearch, setCharacterSearch] = useState('')
  const deferredCharacterSearch = useDeferredValue(characterSearch)
  const [selectedGalleryImage, setSelectedGalleryImage] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const didReloadRef = useRef(false)
  const showScrollTop = useScrollTopVisible()

  function handleTabChange(tab) {
    setSearchParams(tab === 'informacion' ? {} : { tab }, { replace: true })
  }

  const sessionQuery = useQuery({
    queryKey: ['campaign-session-detail', campaignId, sessionId],
    queryFn: () => fetchCampaignSessionDetail(campaignId, sessionId),
  })

  const charactersQuery = useQuery({
    queryKey: [
      'campaign-session-characters',
      campaignId,
      deferredCharacterSearch,
    ],
    queryFn: () =>
      fetchCampaignCharacters(campaignId, {
        limit: 10,
        q: deferredCharacterSearch,
      }),
    enabled: Boolean(campaignId && sessionQuery.data?.puedeGestionar),
  })

  const session = sessionQuery.data
  const currentDraft = draft || sessionToDraft(session)
  const canManage = Boolean(session?.puedeGestionar)
  const characterOptions = useMemo(
    () => charactersQuery.data?.items || [],
    [charactersQuery.data?.items]
  )

  useEffect(() => {
    if (!session?.id || !campaignId) {
      return
    }

    recordRecentActivity({
      entityType: 'session',
      entityId: session.id,
      nombre: session.nombre,
      subtitulo: session.campana?.nombre || 'Partida',
      imagenUrl: session.imagenUrl,
      urlDestino: `/app/campanas/${campaignId}/partidas/${session.id}`,
      modoVista: 'full',
    })
  }, [
    campaignId,
    session?.campana?.nombre,
    session?.id,
    session?.imagenUrl,
    session?.nombre,
  ])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCampaignSessionDetail(
        campaignId,
        sessionId,
        normalizeSessionDetailPayload(currentDraft)
      ),
    onSuccess: (item) => {
      setSaveError('')
      clearStoredDraft(campaignId, sessionId)
      setDraft(sessionToDraft(item))
      setIsEditing(false)
      queryClient.invalidateQueries({
        queryKey: ['campaign-session-detail', campaignId, sessionId],
      })
      queryClient.invalidateQueries({
        queryKey: ['campaign-detail', campaignId],
      })
    },
    onError: (error) => {
      setSaveError(
        error?.response?.data?.message ||
          error?.message ||
          'No se pudo guardar la partida.'
      )
    },
  })

  const selectedCharacters = useMemo(() => {
    const byId = new Map(characterOptions.map((item) => [item.id, item]))
    return (currentDraft.personajeIds || [])
      .map(
        (id) =>
          byId.get(id) || session?.personajes?.find((item) => item.id === id)
      )
      .filter(Boolean)
  }, [characterOptions, currentDraft.personajeIds, session?.personajes])

  const galleryImages = useMemo(() => {
    const allImages = [
      ...(currentDraft.imagenUrl
        ? [
            {
              id: 'principal',
              imagenUrl: currentDraft.imagenUrl,
              titulo: '',
              esPrincipal: true,
            },
          ]
        : []),
      ...(currentDraft.galeriaImagenes || []).map((item) => ({
        ...item,
        esPrincipal: false,
      })),
    ]
    const seen = new Set()

    return allImages.filter((item) => {
      if (!item.imagenUrl || seen.has(item.imagenUrl)) {
        return false
      }

      seen.add(item.imagenUrl)
      return true
    })
  }, [currentDraft.galeriaImagenes, currentDraft.imagenUrl])

  const selectedGalleryIndex = Math.max(
    0,
    galleryImages.findIndex((image) => image.imagenUrl === selectedGalleryImage)
  )
  const activeGalleryImage =
    galleryImages[selectedGalleryIndex]?.imagenUrl ||
    galleryImages[0]?.imagenUrl ||
    ''

  const musicUrlErrors = useMemo(
    () =>
      (currentDraft.temasMusicales || []).map((item, index) =>
        item.musicaUrl?.trim() && !isValidHttpUrl(item.musicaUrl)
          ? `El enlace musical ${index + 1} debe ser una URL válida con http o https.`
          : ''
      ),
    [currentDraft.temasMusicales]
  )
  const hasMusicUrlErrors = musicUrlErrors.some(Boolean)

  useEffect(() => {
    if (isEditing && currentDraft) {
      writeStoredDraft(campaignId, sessionId, currentDraft)
    }
  }, [campaignId, currentDraft, isEditing, sessionId])

  useEffect(() => {
    if (!isEditing) {
      return undefined
    }

    function handleBeforeUnload() {
      didReloadRef.current = true
      markSessionReload(campaignId, sessionId)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)

      if (!didReloadRef.current) {
        clearStoredDraft(campaignId, sessionId)
      }
    }
  }, [campaignId, isEditing, sessionId])

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...sessionToDraft(session),
      ...current,
      [field]: value,
    }))
  }

  async function uploadImages(files) {
    setUploadError('')
    const selectedFiles = Array.from(files || [])

    try {
      await Promise.all(selectedFiles.map((file) => validateImageFile(file)))

      const uploaded = []
      for (const file of selectedFiles) {
        const url = await signAndUploadCampaignImage({
          file,
          campaignId,
          entityType: 'partida',
          tags: ['partida', sessionId],
        })
        uploaded.push({ imagenUrl: url, titulo: '' })
      }

      updateDraft('galeriaImagenes', [
        ...(currentDraft.galeriaImagenes || []),
        ...uploaded,
      ])
      if (!currentDraft.imagenUrl && uploaded[0]?.imagenUrl) {
        updateDraft('imagenUrl', uploaded[0].imagenUrl)
      }
      if (uploaded.at(-1)?.imagenUrl) {
        setSelectedGalleryImage(uploaded.at(-1).imagenUrl)
      }
    } catch (error) {
      setUploadError(error.message || 'No se pudieron subir las imagenes.')
    }
  }

  function removeGalleryImage(imageUrl) {
    updateDraft(
      'galeriaImagenes',
      (currentDraft.galeriaImagenes || []).filter(
        (image) => image.imagenUrl !== imageUrl
      )
    )

    if (currentDraft.imagenUrl === imageUrl) {
      const nextImage = (currentDraft.galeriaImagenes || []).find(
        (image) => image.imagenUrl !== imageUrl
      )
      updateDraft('imagenUrl', nextImage?.imagenUrl || '')
    }
  }

  function promoteGalleryImageToMain(imageUrl) {
    const previousMain = currentDraft.imagenUrl
    const nextGallery = (currentDraft.galeriaImagenes || []).filter(
      (image) => image.imagenUrl !== imageUrl
    )

    if (
      previousMain &&
      previousMain !== imageUrl &&
      !nextGallery.some((image) => image.imagenUrl === previousMain)
    ) {
      nextGallery.unshift({ imagenUrl: previousMain, titulo: '' })
    }

    updateDraft('imagenUrl', imageUrl)
    updateDraft('galeriaImagenes', nextGallery)
    setSelectedGalleryImage(imageUrl)
  }

  function handleStartEditing() {
    setIsEditing(true)

    if (hasMusicUrlErrors) {
      handleTabChange('musica')
      setSaveError(
        'Hay enlaces musicales con formato incorrecto. Puedes editar la partida, pero corrige esos enlaces antes de guardar.'
      )
    }
  }

  function handleSaveEditing() {
    if (hasMusicUrlErrors) {
      handleTabChange('musica')
      setSaveError(
        'Corrige los enlaces musicales marcados antes de guardar la partida.'
      )
      return
    }

    setSaveError('')
    saveMutation.mutate()
  }

  if (sessionQuery.isLoading) {
    return <div className="panel h-80 animate-pulse bg-white/70" />
  }

  if (sessionQuery.isError || !session) {
    return (
      <div className="panel p-8 text-sm font-semibold text-danger">
        No se pudo cargar la partida.
      </div>
    )
  }

  return (
    <section className="grid gap-6">
      <article className="theme-sheet-shell overflow-hidden shadow-card">
        <CharacterSheetHeader
          tabs={SESSION_TABS}
          activeTab={activeTab}
          characterId={sessionId}
          characterName={session.nombre}
          onTabChange={({ tab }) => handleTabChange(tab)}
          onBack={() => navigate(`/app/campanas/${campaignId}`)}
        />
        <div className="mx-auto w-full max-w-[84rem] px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-8 xl:px-6">
          <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[1.8rem,minmax(0,1fr),1.8rem] xl:gap-3 2xl:grid-cols-[2rem,minmax(0,1fr),2rem]">
            <div />

            <div>
              <div
                className={`theme-sheet-frame mx-auto max-w-[40rem] border px-4 py-5 sm:max-w-[44rem] sm:px-6 sm:py-6 md:max-w-none md:px-8 md:py-8 xl:px-10 xl:py-10 ${
                  isEditing
                    ? 'border-brand/50 theme-brand-outline-soft'
                    : 'border-slate-200'
                }`}
              >
                {activeTab === 'informacion' ? (
                  <div className="grid gap-7">
                    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
                      <div>
                        {isEditing ? (
                          <div className="grid gap-4">
                            <input
                              value={currentDraft.nombre}
                              onChange={(event) =>
                                updateDraft('nombre', event.target.value)
                              }
                              className="archive-input rounded-lg font-display text-3xl font-black"
                            />
                            <input
                              type="date"
                              value={currentDraft.jugadaEn}
                              onChange={(event) =>
                                updateDraft('jugadaEn', event.target.value)
                              }
                              className="archive-input rounded-lg"
                            />
                          </div>
                        ) : (
                          <>
                            <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                              {dateInputValue(session.jugadaEn) || 'Sin fecha'}
                            </p>
                            <h1 className="mt-3 font-display text-5xl font-black tracking-[-0.06em] text-ink">
                              {session.nombre}
                            </h1>
                          </>
                        )}
                      </div>
                      <div className="overflow-hidden rounded-xl border border-stroke bg-surface-strong lg:justify-self-end">
                        {currentDraft.imagenUrl ? (
                          <CloudinaryImage
                            src={currentDraft.imagenUrl}
                            alt={currentDraft.nombre}
                            variant="detail"
                            sizes="360px"
                            className="aspect-[3/4] w-full object-cover lg:w-[22rem]"
                          />
                        ) : (
                          <div className="theme-brand-gradient flex aspect-[3/4] w-full items-center justify-center text-brand lg:w-[22rem]">
                            <CalendarDays className="h-12 w-12" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      {isEditing ? (
                        <WikiTextArea
                          value={currentDraft.descripcion}
                          onChange={(event) =>
                            updateDraft('descripcion', event.target.value)
                          }
                          className="archive-input min-h-56 rounded-lg"
                          placeholder="Descripción de la partida"
                        />
                      ) : (
                        <p className="whitespace-pre-line text-base leading-8 text-ink-soft">
                          <WikiText
                            text={session.descripcion}
                            emptyText="Sin descripción registrada."
                          />
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                {activeTab === 'personajes' ? (
                  <div className="grid gap-4">
                    {isEditing ? (
                      <div className="grid gap-4">
                        <div className="theme-sheet-soft rounded-xl border border-stroke p-4">
                          <label className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                            Buscar personajes de la campaña
                          </label>
                          <input
                            value={characterSearch}
                            onChange={(event) =>
                              setCharacterSearch(event.target.value)
                            }
                            placeholder="Busca por nombre o título"
                            className="archive-input mt-2 rounded-lg"
                          />
                          <p className="mt-2 text-xs text-ink-soft">
                            {characterSearch.trim()
                              ? 'Mostrando los 10 primeros resultados de la búsqueda.'
                              : 'Mostrando los últimos 10 personajes de la campaña.'}
                          </p>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {characterOptions.map((character) => {
                            const selected = currentDraft.personajeIds.includes(
                              character.id
                            )
                            return (
                              <button
                                key={character.id}
                                type="button"
                                onClick={() =>
                                  updateDraft(
                                    'personajeIds',
                                    selected
                                      ? currentDraft.personajeIds.filter(
                                          (id) => id !== character.id
                                        )
                                      : [
                                          ...currentDraft.personajeIds,
                                          character.id,
                                        ]
                                  )
                                }
                                className={`rounded-xl border p-3 text-left transition ${
                                  selected
                                    ? 'border-brand bg-brand/10'
                                    : 'border-stroke bg-surface'
                                }`}
                              >
                                <span className="font-display text-lg font-bold text-ink">
                                  {character.nombre}
                                </span>
                                <span className="mt-1 block text-xs text-ink-soft">
                                  {character.titulo || 'Personaje'}
                                </span>
                              </button>
                            )
                          })}
                        </div>

                        {!characterOptions.length ? (
                          <p className="rounded-xl border border-stroke bg-surface-strong p-4 text-sm text-ink-soft">
                            No hay personajes disponibles con ese filtro.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedCharacters.map((character) => (
                        <Link
                          key={character.id}
                          to={`/app/personajes/${character.id}`}
                          className="theme-sheet-soft flex items-center gap-3 rounded-xl border p-3 transition hover:border-brand"
                        >
                          <div className="h-14 w-14 overflow-hidden rounded-lg bg-surface-strong">
                            {character.imagenPrincipalUrl ? (
                              <CloudinaryImage
                                src={character.imagenPrincipalUrl}
                                alt={character.nombre}
                                variant="avatar"
                                sizes="56px"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
                                <UserRound className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-display text-lg font-bold text-ink">
                              {character.nombre}
                            </p>
                            <p className="text-xs text-ink-soft">
                              {character.titulo || 'Personaje'}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {activeTab === 'combates' ? (
                  <SessionCombatList
                    session={session}
                    canManage={canManage && isEditing}
                    campaignId={campaignId}
                    sessionId={sessionId}
                  />
                ) : null}

                {activeTab === 'musica' ? (
                  <div className="grid gap-4">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft('temasMusicales', [
                            ...(currentDraft.temasMusicales || []),
                            { titulo: '', musicaUrl: '' },
                          ])
                        }
                        className="theme-solid-button w-fit rounded-md px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                      >
                        Añadir tema
                      </button>
                    ) : null}
                    {(currentDraft.temasMusicales || []).map((item, index) => (
                      <div
                        key={index}
                        className="theme-sheet-soft rounded-xl border p-4"
                      >
                        {isEditing ? (
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)_auto]">
                            <input
                              value={item.titulo || ''}
                              placeholder="Título"
                              onChange={(event) => {
                                const next = [...currentDraft.temasMusicales]
                                next[index] = {
                                  ...item,
                                  titulo: event.target.value,
                                }
                                updateDraft('temasMusicales', next)
                              }}
                              className="archive-input rounded-lg"
                            />
                            <input
                              value={item.musicaUrl || ''}
                              placeholder="URL de música"
                              onChange={(event) => {
                                const next = [...currentDraft.temasMusicales]
                                next[index] = {
                                  ...item,
                                  musicaUrl: event.target.value,
                                }
                                updateDraft('temasMusicales', next)
                              }}
                              className="archive-input rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...currentDraft.temasMusicales]
                                next.splice(index, 1)
                                updateDraft('temasMusicales', next)
                              }}
                              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 transition hover:border-red-300 hover:bg-red-100"
                              aria-label="Eliminar tema musical"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {musicUrlErrors[index] ? (
                              <p className="text-sm font-semibold text-danger sm:col-span-3">
                                {musicUrlErrors[index]}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-display text-lg font-bold text-ink">
                                {getMusicTitle(item, index)}
                              </p>
                              <p className="mt-1 truncate text-sm text-ink-soft">
                                {item.musicaUrl}
                              </p>
                            </div>

                            <a
                              href={item.musicaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="theme-solid-button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em]"
                            >
                              <Music className="h-4 w-4" />
                              Abrir video
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

                {activeTab === 'galeria' ? (
                  <div
                    className="space-y-6"
                    data-editor-anchor="gallery-section"
                  >
                    {isEditing ? (
                      <div className="flex flex-wrap justify-end gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPTED_IMAGE_INPUT_TYPES}
                          multiple
                          onChange={(event) => uploadImages(event.target.files)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="theme-solid-button w-fit rounded-md px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                        >
                          <ImagePlus className="mr-2 inline h-4 w-4" />
                          Añadir imágenes
                        </button>
                      </div>
                    ) : null}
                    {uploadError ? (
                      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {uploadError}
                      </div>
                    ) : null}
                    <div className="mx-auto max-w-4xl">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!galleryImages.length) return
                            const nextIndex =
                              selectedGalleryIndex <= 0
                                ? galleryImages.length - 1
                                : selectedGalleryIndex - 1

                            setSelectedGalleryImage(
                              galleryImages[nextIndex].imagenUrl
                            )
                          }}
                          disabled={galleryImages.length <= 1}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Imagen anterior"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>

                        <div className="flex min-h-[340px] items-center justify-center overflow-hidden border border-slate-200 bg-slate-50/60 p-4 sm:min-h-[460px] xl:min-h-[560px]">
                          {activeGalleryImage ? (
                            <CloudinaryImage
                              src={activeGalleryImage}
                              alt={`${session.nombre} - imagen destacada`}
                              variant="detail"
                              sizes="(max-width: 768px) 100vw, 1100px"
                              className="h-full max-h-[300px] w-full object-contain sm:max-h-[420px] xl:max-h-[520px]"
                            />
                          ) : (
                            <div className="h-[300px] w-full bg-slate-100 sm:h-[420px] xl:h-[520px]" />
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!galleryImages.length) return
                            const nextIndex =
                              selectedGalleryIndex >= galleryImages.length - 1
                                ? 0
                                : selectedGalleryIndex + 1

                            setSelectedGalleryImage(
                              galleryImages[nextIndex].imagenUrl
                            )
                          }}
                          disabled={galleryImages.length <= 1}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Siguiente imagen"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mt-3 text-center font-label text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        {galleryImages.length
                          ? `${selectedGalleryIndex + 1} / ${galleryImages.length}`
                          : 'Sin imágenes'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {galleryImages.length ? (
                        galleryImages.map((image, index) => {
                          const isSelected =
                            activeGalleryImage === image.imagenUrl
                          const isPrincipal =
                            image.imagenUrl === currentDraft.imagenUrl

                          return (
                            <div
                              key={image.id || image.imagenUrl}
                              className={`overflow-hidden border bg-white transition ${
                                isSelected
                                  ? 'border-brand theme-brand-outline'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedGalleryImage(image.imagenUrl)
                                }
                                className="block w-full"
                              >
                                <CloudinaryImage
                                  src={image.imagenUrl}
                                  alt={`${session.nombre} - galeria ${index + 1}`}
                                  variant="card"
                                  sizes="(max-width: 768px) 50vw, 220px"
                                  className="h-28 w-full object-cover sm:h-32"
                                />
                              </button>

                              {isEditing ? (
                                <div className="grid gap-2 border-t border-slate-100 p-2">
                                  {!isPrincipal ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        promoteGalleryImageToMain(
                                          image.imagenUrl
                                        )
                                      }
                                      className="border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700"
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
                                      onClick={() =>
                                        removeGalleryImage(image.imagenUrl)
                                      }
                                      className="border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-700"
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
                        <div className="col-span-full border border-slate-100 bg-slate-50/50 px-6 py-6">
                          <p className="text-sm text-slate-600">
                            Esta partida todavía no tiene imágenes en galería.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
                {canManage ? (
                  <div className="flex flex-wrap gap-3">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveEditing}
                          disabled={
                            saveMutation.isPending ||
                            !currentDraft.nombre.trim()
                          }
                          className="theme-solid-button inline-flex items-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Save className="h-4 w-4" />
                          {saveMutation.isPending
                            ? 'Guardando...'
                            : 'Guardar cambios'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            clearStoredDraft(campaignId, sessionId)
                            setDraft(sessionToDraft(session))
                            setIsEditing(false)
                          }}
                          className="inline-flex items-center gap-2 rounded-md border border-stroke bg-surface-strong px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <X className="h-4 w-4" />
                          Cancelar edición
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartEditing}
                        className="theme-solid-button inline-flex items-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em]"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar partida
                      </button>
                    )}
                  </div>
                ) : (
                  <div />
                )}
              </div>

              {saveError ? (
                <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {saveError}
                </div>
              ) : null}
            </div>

            <div />
          </div>
        </div>
      </article>

      <CommentsSection
        key={`comentarios-partida-${session.id}`}
        targetType="partida"
        targetId={session.id}
      />

      <ScrollTopButton
        show={showScrollTop}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </section>
  )
}
