import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  CalendarDays,
  Eye,
  MapPinned,
  Package,
  Save,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { useAuth } from '../features/auth/auth-context'
import {
  fetchMyPublicProfileEditor,
  saveMyPublicProfile,
} from './public-profile/api'
import {
  FeaturedCharacterCard,
  PublicProfileDescription,
  PublicProfileError,
  PublicProfileHeader,
  PublicProfileLoading,
} from './public-profile/components'

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function matchesCharacterSearch(item, rawSearch) {
  const normalizedSearch = normalizeSearch(rawSearch)

  if (!normalizedSearch) {
    return true
  }

  const terms = normalizedSearch.split(/\s+/).filter(Boolean)
  const haystack = normalizeSearch(`${item.nombre} ${item.titulo || ''}`)

  return terms.every((term) => haystack.includes(term))
}

function matchesObjectSearch(item, rawSearch) {
  const normalizedSearch = normalizeSearch(rawSearch)

  if (!normalizedSearch) {
    return true
  }

  const terms = normalizedSearch.split(/\s+/).filter(Boolean)
  const haystack = normalizeSearch(
    `${item.nombre} ${item.descripcion || ''} ${item.tier?.nombre || ''}`
  )

  return terms.every((term) => haystack.includes(term))
}

function matchesGenericSearch(item, rawSearch) {
  const normalizedSearch = normalizeSearch(rawSearch)

  if (!normalizedSearch) {
    return true
  }

  const terms = normalizedSearch.split(/\s+/).filter(Boolean)
  const haystack = normalizeSearch(
    `${item.nombre} ${item.descripcion || ''} ${item.escuela || ''} ${
      item.campana?.nombre || ''
    } ${item.tipo?.nombre || ''} ${(item.categorias || [])
      .map((category) => category.nombre)
      .join(' ')}`
  )

  return terms.every((term) => haystack.includes(term))
}

function levelLabel(level) {
  return Number(level) === 0 ? 'Truco' : `Nivel ${level}`
}

function FeaturedPicker({
  search,
  onSearchChange,
  placeholder,
  selectedId,
  onSelect,
  onClear,
  items,
  emptyText,
  getSubtitle,
}) {
  return (
    <div className="rounded-2xl border border-stroke/70 bg-surface-strong/30 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={placeholder}
            className="archive-input pl-11"
          />
        </label>
        {selectedId ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-full border border-stroke bg-white px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-danger hover:text-danger"
          >
            <X className="h-4 w-4" />
            Quitar
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid max-h-72 gap-3 overflow-y-auto pr-1">
        {items.length ? (
          items.map((item) => {
            const isSelected = item.id === selectedId

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex items-center gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                  isSelected
                    ? 'border-brand bg-brand/10 shadow-glow'
                    : 'border-stroke bg-white hover:border-brand/40'
                }`}
              >
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-strong">
                  {item.imagenPrincipalUrl || item.imagenUrl ? (
                    <CloudinaryImage
                      src={item.imagenPrincipalUrl || item.imagenUrl}
                      alt={item.nombre}
                      variant="avatar"
                      sizes="56px"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="theme-brand-radial flex h-full w-full items-center justify-center text-brand">
                      <BookOpen className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold tracking-[-0.04em] text-ink">
                    {item.nombre}
                  </p>
                  <p className="mt-1 truncate text-sm text-ink-soft">
                    {getSubtitle(item)}
                  </p>
                </div>
              </button>
            )
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-stroke bg-white/60 px-4 py-5 text-sm text-ink-soft">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  )
}

function SpellFeaturedPicker({
  search,
  onSearchChange,
  selectedId,
  onSelect,
  onClear,
  items,
  emptyText,
  classFilter,
  onClassFilterChange,
  levelFilter,
  onLevelFilterChange,
  classOptions,
  currentUserId,
}) {
  return (
    <div className="rounded-2xl border border-stroke/70 bg-surface-strong/30 p-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.48fr)_7rem]">
        <label className="relative block min-w-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar hechizo"
            className="archive-input pl-11"
          />
        </label>
        <select
          value={classFilter}
          onChange={(event) => onClassFilterChange(event.target.value)}
          className="archive-input"
        >
          <option value="">Todas las clases</option>
          {classOptions.map((className) => (
            <option key={className} value={className}>
              {className}
            </option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(event) => onLevelFilterChange(event.target.value)}
          className="archive-input"
        >
          <option value="">Nivel</option>
          {Array.from({ length: 11 }, (_, index) => (
            <option key={index} value={index}>
              {index === 0 ? 'Truco' : `N${index}`}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-6 text-ink-soft">
          Puedes destacar hechizos públicos creados por ti o guardados en tu
          repositorio personal.
        </p>
        {selectedId ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-full border border-stroke bg-white px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-danger hover:text-danger"
          >
            <X className="h-4 w-4" />
            Quitar
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1">
        {items.length ? (
          items.map((item) => {
            const isSelected = item.id === selectedId
            const sourceLabel =
              item.creadoPorUsuarioId === currentUserId
                ? 'Creado por ti'
                : 'Guardado'

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-xs transition ${
                  isSelected
                    ? 'border-brand bg-brand/10 shadow-glow'
                    : 'border-slate-200 bg-white hover:border-brand'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">
                    {item.nombre}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-ink-soft">
                    {item.escuela || 'Sin escuela'}
                    {item.clases?.length ? ` · ${item.clases.join(', ')}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
                    {levelLabel(item.nivel)}
                  </span>
                  <span className="rounded-full bg-brand/10 px-2 py-1 font-label text-[8px] font-black uppercase tracking-[0.12em] text-brand">
                    {sourceLabel}
                  </span>
                </span>
              </button>
            )
          })
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs font-semibold text-ink-soft">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  )
}

export function PublicProfileEditorPage() {
  const { user, normalizeApiError } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(null)
  const [search, setSearch] = useState('')
  const [objectSearch, setObjectSearch] = useState('')
  const [placeSearch, setPlaceSearch] = useState('')
  const [sessionSearch, setSessionSearch] = useState('')
  const [spellSearch, setSpellSearch] = useState('')
  const [powerSearch, setPowerSearch] = useState('')
  const [spellPickerClass, setSpellPickerClass] = useState('')
  const [spellPickerLevel, setSpellPickerLevel] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-public-profile-editor'],
    queryFn: fetchMyPublicProfileEditor,
    staleTime: 60 * 1000,
  })

  const availableCharacters = useMemo(
    () => data?.personajesDisponibles || [],
    [data?.personajesDisponibles]
  )
  const availableObjects = useMemo(
    () => data?.objetosDisponibles || [],
    [data?.objetosDisponibles]
  )
  const availablePlaces = useMemo(
    () => data?.lugaresDisponibles || [],
    [data?.lugaresDisponibles]
  )
  const availableSessions = useMemo(
    () => data?.partidasDisponibles || [],
    [data?.partidasDisponibles]
  )
  const availableSpells = useMemo(
    () => data?.hechizosDisponibles || [],
    [data?.hechizosDisponibles]
  )
  const availablePowers = useMemo(
    () => data?.poderesDisponibles || [],
    [data?.poderesDisponibles]
  )
  const baseDraft = useMemo(
    () => ({
      description: data?.item?.descripcion || '',
      selectedCharacterId: data?.item?.personajeDestacadoId || null,
      selectedObjectId: data?.item?.objetoDestacadoId || null,
      selectedPlaceId: data?.item?.lugarDestacadoId || null,
      selectedSessionId: data?.item?.partidaDestacadaId || null,
      selectedSpellId: data?.item?.hechizoDestacadoId || null,
      selectedPowerId: data?.item?.poderDestacadoId || null,
    }),
    [
      data?.item?.descripcion,
      data?.item?.hechizoDestacadoId,
      data?.item?.lugarDestacadoId,
      data?.item?.objetoDestacadoId,
      data?.item?.partidaDestacadaId,
      data?.item?.personajeDestacadoId,
      data?.item?.poderDestacadoId,
    ]
  )
  const activeDraft = draft || baseDraft
  const selectedCharacter =
    availableCharacters.find(
      (item) => item.id === activeDraft.selectedCharacterId
    ) || null
  const selectedObject =
    availableObjects.find((item) => item.id === activeDraft.selectedObjectId) ||
    null
  const selectedPlace =
    availablePlaces.find((item) => item.id === activeDraft.selectedPlaceId) ||
    null
  const selectedSession =
    availableSessions.find(
      (item) => item.id === activeDraft.selectedSessionId
    ) || null
  const selectedSpell =
    availableSpells.find((item) => item.id === activeDraft.selectedSpellId) ||
    null
  const selectedPower =
    availablePowers.find((item) => item.id === activeDraft.selectedPowerId) ||
    null
  const previewState = user?.id
    ? {
        publicProfilePreview: {
          userId: user.id,
          descripcion: activeDraft.description,
          personajeDestacado: selectedCharacter,
          objetoDestacado: selectedObject,
          lugarDestacado: selectedPlace,
          partidaDestacada: selectedSession,
          hechizoDestacado: selectedSpell,
          poderDestacado: selectedPower,
        },
      }
    : null

  const filteredCharacters = useMemo(() => {
    if (!search.trim()) {
      return availableCharacters.slice(0, 5)
    }

    return availableCharacters.filter((item) =>
      matchesCharacterSearch(item, search)
    )
  }, [availableCharacters, search])

  const filteredObjects = useMemo(() => {
    if (!objectSearch.trim()) {
      return availableObjects.slice(0, 5)
    }

    return availableObjects.filter((item) =>
      matchesObjectSearch(item, objectSearch)
    )
  }, [availableObjects, objectSearch])

  const filteredPlaces = useMemo(() => {
    if (!placeSearch.trim()) {
      return availablePlaces.slice(0, 5)
    }

    return availablePlaces.filter((item) =>
      matchesGenericSearch(item, placeSearch)
    )
  }, [availablePlaces, placeSearch])

  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) {
      return availableSessions.slice(0, 5)
    }

    return availableSessions.filter((item) =>
      matchesGenericSearch(item, sessionSearch)
    )
  }, [availableSessions, sessionSearch])

  const spellClassOptions = useMemo(() => {
    const options = new Set()

    for (const spell of availableSpells) {
      for (const className of spell.clases || []) {
        options.add(className)
      }
    }

    return [...options].sort((left, right) => left.localeCompare(right))
  }, [availableSpells])
  const filteredSpells = useMemo(() => {
    const filtered = availableSpells.filter((item) => {
      const matchesSearch = matchesGenericSearch(item, spellSearch)
      const matchesClass =
        !spellPickerClass || (item.clases || []).includes(spellPickerClass)
      const matchesLevel =
        spellPickerLevel === '' ||
        Number(item.nivel || 0) === Number(spellPickerLevel)

      return matchesSearch && matchesClass && matchesLevel
    })

    if (!spellSearch.trim() && !spellPickerClass && spellPickerLevel === '') {
      return filtered.slice(0, 8)
    }

    return filtered
  }, [availableSpells, spellPickerClass, spellPickerLevel, spellSearch])
  const filteredPowers = useMemo(() => {
    if (!powerSearch.trim()) {
      return availablePowers.slice(0, 5)
    }

    return availablePowers.filter((item) =>
      matchesGenericSearch(item, powerSearch)
    )
  }, [availablePowers, powerSearch])

  const saveMutation = useMutation({
    mutationFn: saveMyPublicProfile,
    onSuccess: async (item) => {
      setSaveError('')
      setSaveMessage('Ficha pública actualizada correctamente.')
      setDraft({
        description: item.descripcion || '',
        selectedCharacterId: item.personajeDestacadoId || null,
        selectedObjectId: item.objetoDestacadoId || null,
        selectedPlaceId: item.lugarDestacadoId || null,
        selectedSessionId: item.partidaDestacadaId || null,
        selectedSpellId: item.hechizoDestacadoId || null,
        selectedPowerId: item.poderDestacadoId || null,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['my-public-profile-editor'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['public-profile', user?.id],
        }),
      ])
      if (user?.id) {
        navigate(`/app/perfiles/${user.id}`)
      }
    },
    onError: (error) => {
      setSaveMessage('')
      setSaveError(
        normalizeApiError(error, 'No se pudo guardar la ficha pública.')
      )
    },
  })

  function handleSave() {
    setSaveMessage('')
    setSaveError('')

    saveMutation.mutate({
      descripcion: activeDraft.description.trim(),
      personajeDestacadoId: activeDraft.selectedCharacterId,
      objetoDestacadoId: activeDraft.selectedObjectId,
      lugarDestacadoId: activeDraft.selectedPlaceId,
      partidaDestacadaId: activeDraft.selectedSessionId,
      hechizoDestacadoId: activeDraft.selectedSpellId,
      poderDestacadoId: activeDraft.selectedPowerId,
    })
  }

  if (isLoading) {
    return <PublicProfileLoading />
  }

  if (isError || !data) {
    return <PublicProfileError />
  }

  return (
    <section className="grid gap-6">
      <article className="panel overflow-hidden">
        <PublicProfileHeader
          user={user}
          isOwnProfile
          backLink="/app/perfil"
          previewLink={user?.id ? `/app/perfiles/${user.id}` : null}
          rightActions={
            <div className="flex flex-wrap justify-end gap-2">
              {user?.id ? (
                <Link
                  to={`/app/perfiles/${user.id}`}
                  state={previewState}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white/80 transition hover:border-brand/50 hover:text-white"
                >
                  <Eye className="h-4 w-4" />
                  Ver preview
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="brand-button inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Guardando...' : 'Guardar ficha'}
              </button>
            </div>
          }
        />

        <div className="grid gap-6 px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-8 xl:px-8">
          <div className="grid gap-6 xl:grid-cols-2">
            <FeaturedCharacterCard
              character={selectedCharacter}
              title="Personaje destacado"
              emptyDescription="Elige uno de tus personajes completamente públicos para mostrarlo aquí."
            >
              <div className="rounded-2xl border border-stroke/70 bg-surface-strong/30 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="relative block min-w-[16rem] flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar entre tus personajes públicos..."
                      className="archive-input pl-11"
                    />
                  </label>
                  {activeDraft.selectedCharacterId ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...(current || baseDraft),
                          selectedCharacterId: null,
                        }))
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-stroke bg-white px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-danger hover:text-danger"
                    >
                      <X className="h-4 w-4" />
                      Quitar destacado
                    </button>
                  ) : null}
                </div>

                <p className="mt-3 text-xs leading-6 text-ink-soft">
                  Si no escribes nada, se muestran tus 5 personajes públicos más
                  recientes. Al buscar, se abre el resto dinámicamente.
                </p>

                <div className="mt-4 grid max-h-72 gap-3 overflow-y-auto pr-1">
                  {filteredCharacters.length ? (
                    filteredCharacters.map((item) => {
                      const isSelected =
                        item.id === activeDraft.selectedCharacterId

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...(current || baseDraft),
                              selectedCharacterId: item.id,
                            }))
                          }
                          className={`flex items-center gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? 'border-brand bg-brand/10 shadow-glow'
                              : 'border-stroke bg-white hover:border-brand/40'
                          }`}
                        >
                          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-strong">
                            {item.imagenPrincipalUrl ? (
                              <CloudinaryImage
                                src={item.imagenPrincipalUrl}
                                alt={item.nombre}
                                variant="avatar"
                                sizes="56px"
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-display text-lg font-bold tracking-[-0.04em] text-ink">
                              {item.nombre}
                            </p>
                            <p className="mt-1 truncate text-sm text-ink-soft">
                              {item.titulo || 'Sin titulo registrado'}
                            </p>
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stroke bg-white/60 px-4 py-5 text-sm text-ink-soft">
                      No hay personajes que encajen con esa búsqueda.
                    </div>
                  )}
                </div>
              </div>
            </FeaturedCharacterCard>

            <FeaturedCharacterCard
              character={selectedObject}
              title="Objeto destacado"
              emptyTitle="Todavía no hay objeto destacado"
              emptyDescription="Elige uno de tus objetos completamente públicos para mostrarlo aquí."
              actionLabel="Ver objeto"
              actionIcon={Package}
              getDetailPath={(item) => `/app/objetos/${item.id}`}
              getSubtitle={(item) =>
                item.tier?.nombre || item.descripcion || 'Objeto público.'
              }
            >
              <div className="rounded-2xl border border-stroke/70 bg-surface-strong/30 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="relative block min-w-[16rem] flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="text"
                      value={objectSearch}
                      onChange={(event) => setObjectSearch(event.target.value)}
                      placeholder="Buscar entre tus objetos públicos..."
                      className="archive-input pl-11"
                    />
                  </label>
                  {activeDraft.selectedObjectId ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...(current || baseDraft),
                          selectedObjectId: null,
                        }))
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-stroke bg-white px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-danger hover:text-danger"
                    >
                      <X className="h-4 w-4" />
                      Quitar destacado
                    </button>
                  ) : null}
                </div>

                <p className="mt-3 text-xs leading-6 text-ink-soft">
                  Solo aparecen objetos tuyos con privacidad completamente
                  pública.
                </p>

                <div className="mt-4 grid max-h-72 gap-3 overflow-y-auto pr-1">
                  {filteredObjects.length ? (
                    filteredObjects.map((item) => {
                      const isSelected =
                        item.id === activeDraft.selectedObjectId

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...(current || baseDraft),
                              selectedObjectId: item.id,
                            }))
                          }
                          className={`flex items-center gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? 'border-brand bg-brand/10 shadow-glow'
                              : 'border-stroke bg-white hover:border-brand/40'
                          }`}
                        >
                          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-strong">
                            {item.imagenPrincipalUrl ? (
                              <CloudinaryImage
                                src={item.imagenPrincipalUrl}
                                alt={item.nombre}
                                variant="avatar"
                                sizes="56px"
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-display text-lg font-bold tracking-[-0.04em] text-ink">
                              {item.nombre}
                            </p>
                            <p className="mt-1 truncate text-sm text-ink-soft">
                              {item.tier?.nombre || 'Objeto público'}
                            </p>
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stroke bg-white/60 px-4 py-5 text-sm text-ink-soft">
                      No hay objetos públicos que encajen con esa búsqueda.
                    </div>
                  )}
                </div>
              </div>
            </FeaturedCharacterCard>

            <FeaturedCharacterCard
              character={selectedPlace}
              title="Lugar destacado"
              emptyTitle="Todavía no hay lugar destacado"
              emptyDescription="Elige uno de tus lugares completamente públicos."
              actionLabel="Ver lugar"
              actionIcon={MapPinned}
              getDetailPath={(item) => `/app/lugares/${item.id}`}
              getSubtitle={(item) =>
                item.tipo?.nombre || item.descripcion || 'Lugar público.'
              }
            >
              <FeaturedPicker
                search={placeSearch}
                onSearchChange={setPlaceSearch}
                placeholder="Buscar entre tus lugares públicos..."
                selectedId={activeDraft.selectedPlaceId}
                onSelect={(id) =>
                  setDraft((current) => ({
                    ...(current || baseDraft),
                    selectedPlaceId: id,
                  }))
                }
                onClear={() =>
                  setDraft((current) => ({
                    ...(current || baseDraft),
                    selectedPlaceId: null,
                  }))
                }
                items={filteredPlaces}
                emptyText="No hay lugares públicos que encajen con esa búsqueda."
                getSubtitle={(item) => item.tipo?.nombre || 'Lugar público'}
              />
            </FeaturedCharacterCard>

            <FeaturedCharacterCard
              character={selectedSession}
              title="Partida destacada"
              emptyTitle="Todavía no hay partida destacada"
              emptyDescription="Elige una partida de una campaña en la que participes y puedas ver."
              actionLabel="Ver partida"
              actionIcon={CalendarDays}
              getDetailPath={(item) =>
                `/app/campanas/${item.campanaId}/partidas/${item.id}`
              }
              getSubtitle={(item) =>
                item.campana?.nombre ||
                (item.jugadaEn
                  ? new Date(item.jugadaEn).toLocaleDateString()
                  : 'Partida pública.')
              }
            >
              <FeaturedPicker
                search={sessionSearch}
                onSearchChange={setSessionSearch}
                placeholder="Buscar entre tus partidas visibles..."
                selectedId={activeDraft.selectedSessionId}
                onSelect={(id) =>
                  setDraft((current) => ({
                    ...(current || baseDraft),
                    selectedSessionId: id,
                  }))
                }
                onClear={() =>
                  setDraft((current) => ({
                    ...(current || baseDraft),
                    selectedSessionId: null,
                  }))
                }
                items={filteredSessions}
                emptyText="No hay partidas que encajen con esa búsqueda."
                getSubtitle={(item) => item.campana?.nombre || 'Partida'}
              />
            </FeaturedCharacterCard>

            <FeaturedCharacterCard
              character={selectedSpell}
              title="Hechizo destacado"
              emptyTitle="Todavía no hay hechizo destacado"
              emptyDescription="Elige uno de tus hechizos públicos para destacarlo."
              actionLabel="Ver hechizo"
              actionIcon={BookOpen}
              getDetailPath={(item) => `/app/poderes/hechizos/${item.id}`}
              getSubtitle={(item) =>
                `${Number(item.nivel) === 0 ? 'Truco' : `Nivel ${item.nivel}`}${
                  item.escuela ? ` · ${item.escuela}` : ''
                }`
              }
            >
              <SpellFeaturedPicker
                search={spellSearch}
                onSearchChange={setSpellSearch}
                selectedId={activeDraft.selectedSpellId}
                onSelect={(id) =>
                  setDraft((current) => ({
                    ...(current || baseDraft),
                    selectedSpellId: id,
                  }))
                }
                onClear={() =>
                  setDraft((current) => ({
                    ...(current || baseDraft),
                    selectedSpellId: null,
                  }))
                }
                items={filteredSpells}
                emptyText="No hay hechizos públicos que encajen con esa búsqueda."
                classFilter={spellPickerClass}
                onClassFilterChange={setSpellPickerClass}
                levelFilter={spellPickerLevel}
                onLevelFilterChange={setSpellPickerLevel}
                classOptions={spellClassOptions}
                currentUserId={user?.id}
              />
            </FeaturedCharacterCard>

            <FeaturedCharacterCard
              character={selectedPower}
              title="Poder destacado"
              emptyTitle="Todavía no hay poder destacado"
              emptyDescription="Elige uno de tus otros poderes completamente públicos para destacarlo."
              actionLabel="Ver poder"
              actionIcon={Sparkles}
              getDetailPath={(item) => `/app/poderes/otros/${item.id}`}
              getSubtitle={(item) =>
                item.categorias?.length
                  ? item.categorias
                      .map((category) => category.nombre)
                      .join(', ')
                  : item.descripcion || 'Poder público.'
              }
            >
              <FeaturedPicker
                search={powerSearch}
                onSearchChange={setPowerSearch}
                placeholder="Buscar entre tus poderes públicos..."
                selectedId={activeDraft.selectedPowerId}
                onSelect={(id) =>
                  setDraft((current) => ({
                    ...(current || baseDraft),
                    selectedPowerId: id,
                  }))
                }
                onClear={() =>
                  setDraft((current) => ({
                    ...(current || baseDraft),
                    selectedPowerId: null,
                  }))
                }
                items={filteredPowers}
                emptyText="No hay poderes públicos que encajen con esa búsqueda."
                getSubtitle={(item) =>
                  item.categorias?.length
                    ? item.categorias
                        .map((category) => category.nombre)
                        .join(', ')
                    : 'Poder público'
                }
              />
            </FeaturedCharacterCard>
          </div>

          <PublicProfileDescription
            editable
            description={activeDraft.description}
            value={activeDraft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...(current || baseDraft),
                description: event.target.value,
              }))
            }
          />

          {(saveMessage || saveError) && (
            <div
              className={`rounded-2xl border px-5 py-4 text-sm ${
                saveError
                  ? 'border-danger/20 bg-danger/10 text-danger'
                  : 'border-brand/20 bg-brand/10 text-brand'
              }`}
            >
              {saveError || saveMessage}
            </div>
          )}
        </div>
      </article>
    </section>
  )
}
