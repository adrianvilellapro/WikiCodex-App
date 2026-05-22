import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCharacterEditor,
  deleteSavedTrait as deleteSavedTraitRequest,
  fetchCharacterDetail,
  saveCharacterEditor,
  signAndUploadImage,
} from './api'
import { validateImageFile } from '../../lib/image-upload'
import {
  abilityScoreEntries,
  CLASS_NAME_MAX_LENGTH,
  defaultEditorAnchor,
  defaultEditorTab,
  editorDismissStorageKey,
  MAX_CLASS_LEVEL,
  SUBCLASS_NAME_MAX_LENGTH,
} from './constants'
import { buildDefaultSkillTraits, isSkillTraitGroupName } from './skills'
import {
  createDefaultActionStatsTrait,
  ensureActionStatsTraitInGroup,
  isActionStatsTrait,
  isActionTraitGroupName,
} from './actions'
import {
  buildEmptyEditorDraft,
  buildEditorDraft,
  buildSavePayload,
  clearDraftReloadResume,
  consumeDraftReloadResume,
  deepClone,
  getDraftStorageKey,
  getDraftValidationErrors,
  getDisplayedPassiveScore,
  getSavingThrowProficiencyKey,
  isValidHttpUrl,
  markDraftReloadResume,
  normalizeLooseText,
  sanitizeIntegerInput,
} from './utils'

function getCharacterSaveErrorMessage(error) {
  const detailsCode = error?.response?.data?.details?.code

  if (detailsCode === 'CHARACTER_OWNER_TARGET_NOT_IN_CAMPAIGN') {
    return 'No se pudo cambiar el propietario: el usuario elegido no pertenece a la campaña de este personaje. Añádelo primero como jugador de esa campaña o elige otro usuario.'
  }

  return (
    error?.response?.data?.message ||
    error?.response?.data?.error?.message ||
    error?.message ||
    'No se pudieron guardar los cambios.'
  )
}

function isLostCharacterViewAccessError(error) {
  const message = getCharacterSaveErrorMessage(error)

  return (
    error?.response?.status === 403 &&
    /permiso(?:s)? para ver este personaje/i.test(message)
  )
}

export function useCharacterEditor({
  characterId,
  currentUserId,
  createMode = false,
  data,
  editorMeta,
  activeTabState,
  setActiveTabState,
  preserveCharacterEditor,
  onCreated,
  setSelectedGalleryImageState,
}) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editorHistory, setEditorHistory] = useState({
    past: [],
    present: null,
    future: [],
    presentAnchor: defaultEditorAnchor,
  })
  const [newTraitTypeId, setNewTraitTypeId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [skipDeletePromptToday, setSkipDeletePromptToday] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [categoryQuery, setCategoryQuery] = useState('')
  const [versionSearchQuery, setVersionSearchQuery] = useState('')
  const [copySearchQuery, setCopySearchQuery] = useState('')
  const [selectedCopyCharacterId, setSelectedCopyCharacterId] = useState('')
  const [copySections, setCopySections] = useState({
    estadisticas: true,
    poderesObjetos: false,
    informacion: false,
    musica: false,
    galeria: false,
  })
  const [copyFeedback, setCopyFeedback] = useState('')
  const [savedTraitQuery, setSavedTraitQuery] = useState('')
  const [savedTraitSourceFilter, setSavedTraitSourceFilter] = useState('all')
  const [savedTraitSourceEntityFilter, setSavedTraitSourceEntityFilter] =
    useState('all')
  const [showRecentSavedTraits, setShowRecentSavedTraits] = useState(false)
  const [showAllSavedTraits, setShowAllSavedTraits] = useState(false)
  const [hasDraftHydrated, setHasDraftHydrated] = useState(false)
  const [lastEditedAnchor, setLastEditedAnchor] = useState(defaultEditorAnchor)
  const [uploadState, setUploadState] = useState({
    gallery: false,
  })

  const hydratedDraftRef = useRef(null)
  const lastEditedAnchorRef = useRef(defaultEditorAnchor)
  const editSessionRef = useRef(null)
  const galleryInputRef = useRef(null)
  const editorHistoryRef = useRef(editorHistory)
  const draftCharacterIdRef = useRef(null)

  const { data: copySourceCharacter } = useQuery({
    queryKey: ['character', selectedCopyCharacterId],
    queryFn: () => fetchCharacterDetail(selectedCopyCharacterId),
    enabled: Boolean(isEditing && selectedCopyCharacterId),
    staleTime: 60 * 1000,
  })

  const baseDraft = useMemo(() => {
    if (createMode && editorMeta) {
      return buildEmptyEditorDraft(editorMeta, currentUserId)
    }

    if (!data || !editorMeta) {
      return null
    }

    return buildEditorDraft(data, editorMeta)
  }, [createMode, currentUserId, data, editorMeta])

  const draft = isEditing ? editorHistory.present : null
  const draftStorageId = characterId || 'nuevo-personaje'

  useEffect(() => {
    lastEditedAnchorRef.current = lastEditedAnchor
  }, [lastEditedAnchor])

  useEffect(() => {
    editorHistoryRef.current = editorHistory
  }, [editorHistory])

  useEffect(() => {
    hydratedDraftRef.current = null
    setHasDraftHydrated(false)
    setIsEditing(false)
    setEditorHistory({
      past: [],
      present: null,
      future: [],
      presentAnchor: defaultEditorAnchor,
    })
    draftCharacterIdRef.current = null
    setLastEditedAnchor(defaultEditorAnchor)
    lastEditedAnchorRef.current = defaultEditorAnchor
  }, [draftStorageId])

  useEffect(() => {
    if (!draftStorageId || !baseDraft) {
      return
    }

    if (hydratedDraftRef.current === draftStorageId) {
      return
    }

    hydratedDraftRef.current = draftStorageId

    const storageKey = getDraftStorageKey(draftStorageId)
    const storedValue = window.localStorage.getItem(storageKey)
    const shouldRestoreAfterReload = consumeDraftReloadResume(draftStorageId)
    const shouldHydrateStoredDraft =
      createMode || preserveCharacterEditor || shouldRestoreAfterReload

    if (!storedValue) {
      clearDraftReloadResume(draftStorageId)
      draftCharacterIdRef.current = draftStorageId
      setEditorHistory({
        past: [],
        present: baseDraft,
        future: [],
        presentAnchor: defaultEditorAnchor,
      })
      setIsEditing(createMode || preserveCharacterEditor)
      setActiveTabState({
        characterId: draftStorageId,
        tab: defaultEditorTab,
      })
      setHasDraftHydrated(true)
      setLastEditedAnchor(defaultEditorAnchor)
      lastEditedAnchorRef.current = defaultEditorAnchor
      return
    }

    if (!shouldHydrateStoredDraft) {
      window.localStorage.removeItem(storageKey)
      clearDraftReloadResume(draftStorageId)
      draftCharacterIdRef.current = draftStorageId
      setEditorHistory({
        past: [],
        present: baseDraft,
        future: [],
        presentAnchor: defaultEditorAnchor,
      })
      setIsEditing(false)
      setActiveTabState({
        characterId: draftStorageId,
        tab: defaultEditorTab,
      })
      setHasDraftHydrated(true)
      setLastEditedAnchor(defaultEditorAnchor)
      lastEditedAnchorRef.current = defaultEditorAnchor
      return
    }

    try {
      const parsed = JSON.parse(storedValue)

      if (parsed.characterId !== draftStorageId) {
        window.localStorage.removeItem(storageKey)
        clearDraftReloadResume(draftStorageId)
        draftCharacterIdRef.current = draftStorageId
        setEditorHistory({
          past: [],
          present: baseDraft,
          future: [],
          presentAnchor: defaultEditorAnchor,
        })
        setIsEditing(createMode)
        setLastEditedAnchor(defaultEditorAnchor)
        lastEditedAnchorRef.current = defaultEditorAnchor
        setHasDraftHydrated(true)
        return
      }

      draftCharacterIdRef.current = draftStorageId
      setEditorHistory({
        past: [],
        present: parsed.draft || baseDraft,
        future: [],
        presentAnchor: parsed.anchor || defaultEditorAnchor,
      })
      setIsEditing(true)
      setActiveTabState({
        characterId: draftStorageId,
        tab: parsed.activeTab || defaultEditorTab,
      })
      setLastEditedAnchor(parsed.anchor || defaultEditorAnchor)
      lastEditedAnchorRef.current = parsed.anchor || defaultEditorAnchor
      setHasDraftHydrated(true)
    } catch {
      window.localStorage.removeItem(storageKey)
      clearDraftReloadResume(draftStorageId)
      draftCharacterIdRef.current = draftStorageId
      setEditorHistory({
        past: [],
        present: baseDraft,
        future: [],
        presentAnchor: defaultEditorAnchor,
      })
      setIsEditing(createMode)
      setLastEditedAnchor(defaultEditorAnchor)
      lastEditedAnchorRef.current = defaultEditorAnchor
      setHasDraftHydrated(true)
    }
  }, [
    baseDraft,
    createMode,
    draftStorageId,
    preserveCharacterEditor,
    setActiveTabState,
  ])

  useEffect(() => {
    if (!draftStorageId || !hasDraftHydrated) {
      return
    }

    const storageKey = getDraftStorageKey(draftStorageId)

    if (isEditing && editorHistory.present) {
      if (draftCharacterIdRef.current !== draftStorageId) {
        return
      }

      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          characterId: draftStorageId,
          draft: editorHistory.present,
          anchor: editorHistory.presentAnchor,
          activeTab:
            activeTabState.characterId === draftStorageId
              ? activeTabState.tab
              : defaultEditorTab,
        })
      )
      return
    }

    window.localStorage.removeItem(storageKey)
    clearDraftReloadResume(draftStorageId)
  }, [
    activeTabState,
    draftStorageId,
    editorHistory.present,
    editorHistory.presentAnchor,
    hasDraftHydrated,
    isEditing,
  ])

  useEffect(() => {
    if (!draftStorageId || !isEditing || !editorHistory.present) {
      return undefined
    }

    function handleBeforeUnload() {
      window.localStorage.setItem(
        getDraftStorageKey(draftStorageId),
        JSON.stringify({
          characterId: draftStorageId,
          draft: editorHistoryRef.current.present,
          anchor:
            editorHistoryRef.current.presentAnchor ||
            lastEditedAnchorRef.current ||
            defaultEditorAnchor,
          activeTab:
            activeTabState.characterId === draftStorageId
              ? activeTabState.tab
              : defaultEditorTab,
        })
      )
      markDraftReloadResume(draftStorageId)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [activeTabState, draftStorageId, editorHistory.present, isEditing])

  const saveMutation = useMutation({
    mutationFn: async ({ currentCharacterId, currentDraft, versionIds }) => {
      const createValidationError = getDraftValidationErrors(currentDraft).at(0)

      if (createValidationError) {
        throw new Error(createValidationError)
      }

      if (createMode) {
        const createdItem = await createCharacterEditor(
          buildSavePayload(currentDraft)
        )

        return {
          currentItem: createdItem,
          savedIds: [draftStorageId],
        }
      }

      const draftsToSave = [
        { characterId: currentCharacterId, draft: currentDraft },
      ]

      for (const versionId of versionIds) {
        if (versionId === currentCharacterId) {
          continue
        }

        const storedValue = window.localStorage.getItem(
          getDraftStorageKey(versionId)
        )

        if (!storedValue) {
          continue
        }

        try {
          const parsed = JSON.parse(storedValue)

          if (parsed?.draft) {
            draftsToSave.push({
              characterId: versionId,
              draft: parsed.draft,
            })
          }
        } catch {
          window.localStorage.removeItem(getDraftStorageKey(versionId))
        }
      }

      const uniqueDrafts = draftsToSave.filter(
        (entry, index, array) =>
          array.findIndex((item) => item.characterId === entry.characterId) ===
          index
      )

      const validationError = uniqueDrafts
        .flatMap((entry) => getDraftValidationErrors(entry.draft))
        .at(0)

      if (validationError) {
        throw new Error(validationError)
      }

      const savedItems = []

      for (const entry of uniqueDrafts) {
        const savedItem = await saveCharacterEditor(
          entry.characterId,
          buildSavePayload(entry.draft)
        )
        savedItems.push(savedItem)
      }

      return {
        currentItem:
          savedItems.find((item) => item.id === currentCharacterId) ||
          savedItems[0],
        savedIds: uniqueDrafts.map((entry) => entry.characterId),
      }
    },
    onSuccess: ({ currentItem: item, savedIds }) => {
      queryClient.setQueryData(['character', item.id || characterId], item)
      queryClient.invalidateQueries({ queryKey: ['character'] })
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      queryClient.invalidateQueries({ queryKey: ['character-versions'] })
      queryClient.invalidateQueries({ queryKey: ['characters', 'recent'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-characters'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-detail'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-session-detail'] })
      setEditorHistory({
        past: [],
        present: baseDraft ? buildEditorDraft(item, editorMeta) : null,
        future: [],
        presentAnchor: defaultEditorAnchor,
      })
      draftCharacterIdRef.current = item.id || draftStorageId
      setIsEditing(false)
      setSaveError('')
      setLastEditedAnchor(defaultEditorAnchor)
      lastEditedAnchorRef.current = defaultEditorAnchor
      for (const savedId of savedIds) {
        window.localStorage.removeItem(getDraftStorageKey(savedId))
        clearDraftReloadResume(savedId)
      }
      clearDraftReloadResume(item.id || draftStorageId)
      onCreated?.(item)
    },
    onError: (error) => {
      if (!createMode && isLostCharacterViewAccessError(error)) {
        setEditorHistory({
          past: [],
          present: null,
          future: [],
          presentAnchor: defaultEditorAnchor,
        })
        draftCharacterIdRef.current = null
        setIsEditing(false)
        setSaveError('')
        setLastEditedAnchor(defaultEditorAnchor)
        lastEditedAnchorRef.current = defaultEditorAnchor
        window.localStorage.removeItem(getDraftStorageKey(draftStorageId))
        clearDraftReloadResume(draftStorageId)
        queryClient.setQueryData(['character', characterId], null)
        queryClient.invalidateQueries({ queryKey: ['character', characterId] })
        queryClient.invalidateQueries({ queryKey: ['characters', 'recent'] })
        queryClient.invalidateQueries({ queryKey: ['campaign-characters'] })
        queryClient.invalidateQueries({ queryKey: ['campaign-detail'] })
        return
      }

      setSaveError(getCharacterSaveErrorMessage(error))
    },
  })

  const deleteSavedTraitMutation = useMutation({
    mutationFn: deleteSavedTraitRequest,
    onSuccess: (_, traitId) => {
      queryClient.invalidateQueries({ queryKey: ['character-editor'] })
      updateDraft((current) => {
        for (const group of current.rasgosAgrupados || []) {
          for (const trait of group.rasgos || []) {
            if (trait.id === traitId) {
              trait.esReutilizable = false
            }
          }
        }

        return current
      })
    },
  })

  const currentItem = useMemo(() => {
    if (isEditing && draft) {
      const draftItem = {
        ...(data || {}),
        puedeEditar: true,
        modoVista: 'full',
        nombre: draft.core.nombre,
        titulo: draft.core.titulo,
        descripcion: draft.core.descripcion,
        lore: draft.core.lore,
        partidaAparicionId: draft.core.partidaAparicionId,
        partidaDefuncionId: draft.core.partidaDefuncionId,
        imagenPrincipalUrl: draft.core.imagenPrincipalUrl,
        personajeBaseId: draft.core.personajeBaseId,
        esVersion: Boolean(draft.core.personajeBaseId),
        puntosGolpe: draft.core.puntosGolpe,
        claseArmadura: draft.core.claseArmadura,
        velocidadPies: draft.core.velocidadPies,
        velocidadMetros: draft.core.velocidadMetros,
        bonificadorCompetencia: draft.core.bonificadorCompetencia,
        iniciativa: draft.core.iniciativa,
        percepcionPasiva: draft.core.percepcionPasiva,
        investigacionPasiva: draft.core.investigacionPasiva,
        puntosExperiencia: draft.core.puntosExperiencia,
        fuerza: draft.core.fuerza,
        destreza: draft.core.destreza,
        constitucion: draft.core.constitucion,
        inteligencia: draft.core.inteligencia,
        sabiduria: draft.core.sabiduria,
        carisma: draft.core.carisma,
        salvacionFuerza: draft.core.salvacionFuerza,
        salvacionDestreza: draft.core.salvacionDestreza,
        salvacionConstitucion: draft.core.salvacionConstitucion,
        salvacionInteligencia: draft.core.salvacionInteligencia,
        salvacionSabiduria: draft.core.salvacionSabiduria,
        salvacionCarisma: draft.core.salvacionCarisma,
        competenciaSalvacionFuerza: draft.core.competenciaSalvacionFuerza,
        competenciaSalvacionDestreza: draft.core.competenciaSalvacionDestreza,
        competenciaSalvacionConstitucion:
          draft.core.competenciaSalvacionConstitucion,
        competenciaSalvacionInteligencia:
          draft.core.competenciaSalvacionInteligencia,
        competenciaSalvacionSabiduria: draft.core.competenciaSalvacionSabiduria,
        competenciaSalvacionCarisma: draft.core.competenciaSalvacionCarisma,
        edad: draft.core.edad,
        alturaMetros: draft.core.alturaMetros,
        pesoKg: draft.core.pesoKg,
        esCriatura: draft.core.esCriatura,
        tier:
          editorMeta?.tiers?.find((item) => item.id === draft.core.tierId) ||
          null,
        estado:
          editorMeta?.estados?.find(
            (item) => item.id === draft.core.estadoId
          ) || null,
        campana:
          editorMeta?.campanas?.find(
            (item) => item.id === draft.core.campanaId
          ) || null,
        aventura:
          editorMeta?.campanas
            ?.flatMap((campaign) => campaign.aventuras)
            .find((item) => item.id === draft.core.aventuraId) || null,
        partidaAparicion:
          editorMeta?.campanas
            ?.flatMap((campaign) => campaign.partidas || [])
            .find((item) => item.id === draft.core.partidaAparicionId) || null,
        partidaDefuncion:
          editorMeta?.campanas
            ?.flatMap((campaign) => campaign.partidas || [])
            .find((item) => item.id === draft.core.partidaDefuncionId) || null,
        categorias: (draft.categorias || []).map((category, index) => ({
          id: category.id || `categoria-${index}`,
          nombre: category.nombre,
        })),
        clases: draft.clases.map((entry) => ({
          nivelClase: entry.nivelClase,
          clase: entry.claseNombre
            ? {
                id: null,
                nombre: entry.claseNombre,
              }
            : null,
          subclase: entry.subclaseNombre
            ? {
                id: null,
                nombre: entry.subclaseNombre,
              }
            : null,
          claseNombre: entry.claseNombre,
          subclaseNombre: entry.subclaseNombre,
        })),
        rasgosAgrupados: draft.rasgosAgrupados.map((group) => ({
          ...group,
          id: group.tipoRasgoId,
          nombre:
            editorMeta?.tiposRasgo?.find(
              (item) => item.id === group.tipoRasgoId
            )?.nombre || group.nombre,
          rasgos: group.rasgos.map((trait, index) => ({
            ...trait,
            id: trait.id || `${group.tipoRasgoId}-${index}`,
          })),
        })),
        hechizos: draft.hechizos || [],
        hechizosSlots: draft.hechizosSlots || {},
        poderes: draft.poderes || [],
        objetos: draft.objetos || [],
        temasMusicales: draft.temasMusicales.map((item, index) => ({
          ...item,
          id: item.id || `music-${index}`,
        })),
        galeriaImagenes: draft.galeriaImagenes.map((item, index) => ({
          ...item,
          id: item.id || `gallery-${index}`,
        })),
      }
      const selectedOwner =
        editorMeta?.usuarios?.find(
          (item) => item.id === draft.core.propietarioUsuarioId
        ) ||
        data?.propietario ||
        data?.creadoPor ||
        null

      return {
        ...draftItem,
        propietario: selectedOwner,
        percepcionPasiva: getDisplayedPassiveScore(
          draftItem,
          'percepcionPasiva'
        ),
        investigacionPasiva: getDisplayedPassiveScore(
          draftItem,
          'investigacionPasiva'
        ),
      }
    }

    return data
      ? {
          ...data,
          percepcionPasiva: getDisplayedPassiveScore(data, 'percepcionPasiva'),
          investigacionPasiva: getDisplayedPassiveScore(
            data,
            'investigacionPasiva'
          ),
        }
      : data
  }, [data, draft, editorMeta, isEditing])

  const availableTraitTypes = useMemo(() => {
    if (!editorMeta?.tiposRasgo || !draft) {
      return []
    }

    const existingIds = new Set(
      draft.rasgosAgrupados.map((group) => group.tipoRasgoId)
    )

    return editorMeta.tiposRasgo.filter((item) => !existingIds.has(item.id))
  }, [draft, editorMeta?.tiposRasgo])

  const filteredCategorySuggestions = useMemo(() => {
    if (!draft || !editorMeta?.categorias) {
      return []
    }

    const query = normalizeLooseText(categoryQuery)
    const selectedNames = new Set(
      (draft.categorias || []).map((item) => normalizeLooseText(item.nombre))
    )

    return editorMeta.categorias.filter((category) => {
      const normalizedName = normalizeLooseText(category.nombre)

      if (selectedNames.has(normalizedName)) {
        return false
      }

      if (!query) {
        return true
      }

      return normalizedName.includes(query)
    })
  }, [categoryQuery, draft, editorMeta?.categorias])

  const canManageSavedTraits =
    Boolean(currentUserId) &&
    draft?.core?.propietarioUsuarioId === currentUserId

  const filteredSavedTraits = useMemo(() => {
    if (!canManageSavedTraits || !editorMeta?.rasgosGuardados) {
      return []
    }

    const query = normalizeLooseText(savedTraitQuery)

    return editorMeta.rasgosGuardados
      .filter((trait) => {
        const sourceType = trait.origenTipo || 'usuario'
        const sourceEntityKey = `${sourceType}:${
          trait.origenEntidadId || trait.origenGrupoId || ''
        }`

        if (savedTraitSourceFilter === 'user' && sourceType !== 'usuario') {
          return false
        }

        if (
          savedTraitSourceFilter === 'class' &&
          !['clase', 'subclase'].includes(sourceType)
        ) {
          return false
        }

        if (
          savedTraitSourceFilter === 'class' &&
          savedTraitSourceEntityFilter !== 'all' &&
          sourceEntityKey !== savedTraitSourceEntityFilter
        ) {
          return false
        }

        if (savedTraitSourceFilter === 'feat' && sourceType !== 'dote') {
          return false
        }

        if (!query) {
          return true
        }

        return (
          normalizeLooseText(trait.nombre).includes(query) ||
          normalizeLooseText(trait.descripcion).includes(query) ||
          normalizeLooseText(trait.tipoRasgo?.nombre).includes(query) ||
          normalizeLooseText(trait.origenEntidadNombre).includes(query) ||
          normalizeLooseText(trait.origenRasgoNombre).includes(query)
        )
      })
      .sort(
        (left, right) =>
          new Date(right.actualizadoEn || right.creadoEn || 0).getTime() -
          new Date(left.actualizadoEn || left.creadoEn || 0).getTime()
      )
  }, [
    canManageSavedTraits,
    editorMeta?.rasgosGuardados,
    savedTraitQuery,
    savedTraitSourceEntityFilter,
    savedTraitSourceFilter,
  ])

  const savedTraitClassSourceOptions = useMemo(() => {
    const map = new Map()

    for (const trait of editorMeta?.rasgosGuardados || []) {
      const sourceType = trait.origenTipo || 'usuario'

      if (!['clase', 'subclase'].includes(sourceType)) {
        continue
      }

      const key = `${sourceType}:${
        trait.origenEntidadId || trait.origenGrupoId || ''
      }`
      const typeLabel = sourceType === 'subclase' ? 'Subclase' : 'Clase'
      const label = trait.origenEntidadNombre
        ? `${typeLabel} · ${trait.origenEntidadNombre}`
        : typeLabel

      if (!map.has(key)) {
        map.set(key, { key, label })
      }
    }

    return Array.from(map.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    )
  }, [editorMeta?.rasgosGuardados])

  const visibleSavedTraits = useMemo(
    () =>
      savedTraitQuery ||
      savedTraitSourceFilter !== 'all' ||
      savedTraitSourceEntityFilter !== 'all'
        ? filteredSavedTraits
        : showRecentSavedTraits
          ? showAllSavedTraits
            ? filteredSavedTraits
            : filteredSavedTraits.slice(0, 4)
          : [],
    [
      filteredSavedTraits,
      savedTraitQuery,
      savedTraitSourceEntityFilter,
      savedTraitSourceFilter,
      showAllSavedTraits,
      showRecentSavedTraits,
    ]
  )

  const ownedCharacterOptions = useMemo(
    () =>
      (editorMeta?.personajesPropios || [])
        .filter((item) => item.id !== characterId)
        .sort((left, right) => left.nombre.localeCompare(right.nombre)),
    [characterId, editorMeta?.personajesPropios]
  )

  const filteredVersionBaseOptions = useMemo(() => {
    const query = normalizeLooseText(versionSearchQuery)

    return ownedCharacterOptions
      .filter((item) => {
        if (item.id === draft?.core.personajeBaseId) {
          return false
        }

        if (!query) {
          return true
        }

        return normalizeLooseText(item.nombre).includes(query)
      })
      .slice(0, 8)
  }, [draft?.core.personajeBaseId, ownedCharacterOptions, versionSearchQuery])

  const filteredCopySourceOptions = useMemo(() => {
    const query = normalizeLooseText(copySearchQuery)

    return ownedCharacterOptions
      .filter((item) => {
        if (item.id === selectedCopyCharacterId) {
          return false
        }

        if (!query) {
          return true
        }

        return normalizeLooseText(item.nombre).includes(query)
      })
      .slice(0, 8)
  }, [copySearchQuery, ownedCharacterOptions, selectedCopyCharacterId])

  const selectedVersionBase = useMemo(
    () =>
      (editorMeta?.personajesPropios || []).find(
        (item) => item.id === draft?.core.personajeBaseId
      ) || null,
    [draft?.core.personajeBaseId, editorMeta?.personajesPropios]
  )

  const selectedCopySource = useMemo(
    () =>
      (editorMeta?.personajesPropios || []).find(
        (item) => item.id === selectedCopyCharacterId
      ) || null,
    [editorMeta?.personajesPropios, selectedCopyCharacterId]
  )

  const musicUrlErrors = useMemo(
    () =>
      (draft?.temasMusicales || []).map((entry) =>
        entry.musicaUrl?.trim() && !isValidHttpUrl(entry.musicaUrl)
          ? 'Introduce una URL valida (http o https).'
          : ''
      ),
    [draft?.temasMusicales]
  )

  function markEditedAnchor(anchorId) {
    lastEditedAnchorRef.current = anchorId
    setLastEditedAnchor(anchorId)
  }

  function persistEditorSnapshot({
    snapshotCharacterId = draftStorageId,
    snapshotDraft = editorHistoryRef.current.present,
    snapshotAnchor = lastEditedAnchorRef.current ||
      editorHistoryRef.current.presentAnchor ||
      defaultEditorAnchor,
    snapshotTab = activeTabState.characterId === draftStorageId
      ? activeTabState.tab
      : defaultEditorTab,
  } = {}) {
    if (!snapshotCharacterId || !snapshotDraft || !isEditing) {
      return
    }

    if (draftCharacterIdRef.current !== snapshotCharacterId) {
      return
    }

    window.localStorage.setItem(
      getDraftStorageKey(snapshotCharacterId),
      JSON.stringify({
        characterId: snapshotCharacterId,
        draft: snapshotDraft,
        anchor: snapshotAnchor || defaultEditorAnchor,
        activeTab: snapshotTab,
      })
    )
  }

  function persistCurrentEditorSnapshot(snapshotTab) {
    persistEditorSnapshot({
      snapshotCharacterId: draftStorageId,
      snapshotDraft: editorHistoryRef.current.present,
      snapshotAnchor:
        editorHistoryRef.current.presentAnchor ||
        lastEditedAnchorRef.current ||
        defaultEditorAnchor,
      snapshotTab,
    })
  }

  function discardEditing(versionIds = []) {
    if (!isEditing) {
      return
    }

    for (const versionId of versionIds) {
      window.localStorage.removeItem(getDraftStorageKey(versionId))
      clearDraftReloadResume(versionId)
    }
    window.localStorage.removeItem(getDraftStorageKey(draftStorageId))
    clearDraftReloadResume(draftStorageId)
    editSessionRef.current = null
    setIsEditing(false)
  }

  function scrollToEditorAnchor(anchorId = lastEditedAnchorRef.current) {
    if (!anchorId) {
      return
    }

    requestAnimationFrame(() => {
      document
        .querySelector(`[data-editor-anchor="${anchorId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function getEditorAnchorFromElement(element) {
    return (
      element
        ?.closest?.('[data-editor-anchor]')
        ?.getAttribute('data-editor-anchor') || lastEditedAnchorRef.current
    )
  }

  function handleEditorFieldFocus(event) {
    const target = event.target
    const tagName = target?.tagName?.toLowerCase()

    if (
      !isEditing ||
      !editorHistory.present ||
      !['input', 'textarea', 'select'].includes(tagName)
    ) {
      return
    }

    if (editSessionRef.current) {
      commitEditorFieldSession()
    }

    editSessionRef.current = {
      draft: deepClone(editorHistory.present),
      anchor: getEditorAnchorFromElement(target) || defaultEditorAnchor,
    }
  }

  function commitEditorFieldSession() {
    const session = editSessionRef.current

    if (!session) {
      return
    }

    editSessionRef.current = null
    setEditorHistory((current) => {
      if (!current.present) {
        return current
      }

      if (JSON.stringify(session.draft) === JSON.stringify(current.present)) {
        return current
      }

      const anchor =
        session.anchor || current.presentAnchor || defaultEditorAnchor
      lastEditedAnchorRef.current = anchor
      setLastEditedAnchor(anchor)

      return {
        past: [
          ...current.past.slice(-59),
          {
            draft: session.draft,
            anchor,
            tab:
              activeTabState.characterId === draftStorageId
                ? activeTabState.tab
                : defaultEditorTab,
          },
        ],
        present: current.present,
        future: [],
        presentAnchor: anchor,
      }
    })
  }

  function handleEditorFieldBlur() {
    window.setTimeout(commitEditorFieldSession, 0)
  }

  function updateDraft(updater) {
    setEditorHistory((current) => {
      if (!current.present) {
        return current
      }

      const nextPresent =
        typeof updater === 'function'
          ? updater(deepClone(current.present))
          : updater

      if (editSessionRef.current) {
        return {
          ...current,
          present: nextPresent,
          presentAnchor:
            editSessionRef.current.anchor ||
            lastEditedAnchorRef.current ||
            defaultEditorAnchor,
        }
      }

      return {
        past: [
          ...current.past.slice(-59),
          {
            draft: deepClone(current.present),
            anchor: current.presentAnchor || defaultEditorAnchor,
            tab:
              activeTabState.characterId === draftStorageId
                ? activeTabState.tab
                : defaultEditorTab,
          },
        ],
        present: nextPresent,
        future: [],
        presentAnchor: lastEditedAnchorRef.current || defaultEditorAnchor,
      }
    })
  }

  function undoDraft() {
    commitEditorFieldSession()
    let targetAnchor = defaultEditorAnchor
    setEditorHistory((current) => {
      if (!current.past.length || !current.present) {
        return current
      }

      const previous = current.past[current.past.length - 1]
      targetAnchor = previous.anchor || defaultEditorAnchor
      if (previous.tab) {
        setActiveTabState({ characterId: draftStorageId, tab: previous.tab })
      }
      return {
        past: current.past.slice(0, -1),
        present: previous.draft,
        future: [
          {
            draft: deepClone(current.present),
            anchor: current.presentAnchor || defaultEditorAnchor,
            tab:
              activeTabState.characterId === draftStorageId
                ? activeTabState.tab
                : defaultEditorTab,
          },
          ...current.future,
        ],
        presentAnchor: targetAnchor,
      }
    })
    lastEditedAnchorRef.current = targetAnchor
    setLastEditedAnchor(targetAnchor)
    window.setTimeout(() => scrollToEditorAnchor(targetAnchor), 0)
  }

  function redoDraft() {
    commitEditorFieldSession()
    let targetAnchor = defaultEditorAnchor
    setEditorHistory((current) => {
      if (!current.future.length || !current.present) {
        return current
      }

      const [next, ...rest] = current.future
      targetAnchor = next.anchor || defaultEditorAnchor
      if (next.tab) {
        setActiveTabState({ characterId: draftStorageId, tab: next.tab })
      }
      return {
        past: [
          ...current.past,
          {
            draft: deepClone(current.present),
            anchor: current.presentAnchor || defaultEditorAnchor,
            tab:
              activeTabState.characterId === draftStorageId
                ? activeTabState.tab
                : defaultEditorTab,
          },
        ],
        present: next.draft,
        future: rest,
        presentAnchor: targetAnchor,
      }
    })
    lastEditedAnchorRef.current = targetAnchor
    setLastEditedAnchor(targetAnchor)
    window.setTimeout(() => scrollToEditorAnchor(targetAnchor), 0)
  }

  function handleStartEditing() {
    if (!baseDraft) {
      return
    }

    setEditorHistory({
      past: [],
      present: deepClone(baseDraft),
      future: [],
      presentAnchor: defaultEditorAnchor,
    })
    draftCharacterIdRef.current = draftStorageId
    setIsEditing(true)
    setSaveError('')
    setCategoryQuery('')
    clearDraftReloadResume(draftStorageId)
    setLastEditedAnchor(defaultEditorAnchor)
    lastEditedAnchorRef.current = defaultEditorAnchor
  }

  function handleCancelEditing() {
    if (!baseDraft) {
      return
    }

    setEditorHistory({
      past: [],
      present: deepClone(baseDraft),
      future: [],
      presentAnchor: defaultEditorAnchor,
    })
    draftCharacterIdRef.current = draftStorageId
    setIsEditing(false)
    setSaveError('')
    setCategoryQuery('')
    window.localStorage.removeItem(getDraftStorageKey(draftStorageId))
    clearDraftReloadResume(draftStorageId)
    setLastEditedAnchor(defaultEditorAnchor)
    lastEditedAnchorRef.current = defaultEditorAnchor
  }

  function handleSaveEditing(versionIds = []) {
    if (!draft) {
      return
    }

    commitEditorFieldSession()
    saveMutation.mutate({
      currentCharacterId: draftStorageId,
      currentDraft: draft,
      versionIds,
    })
  }

  function updateCoreField(fieldName, value, anchorId = 'info-general') {
    markEditedAnchor(anchorId)
    updateDraft((current) => {
      current.core[fieldName] = value

      if (fieldName === 'bonificadorCompetencia') {
        for (const ability of abilityScoreEntries) {
          if (!current.saveBehavior?.[ability.key]?.manual) {
            current.core[ability.saveKey] = null
          }
        }
      }

      return current
    })
  }

  function updateAbilityField(abilityKey, type, value) {
    const entry = abilityScoreEntries.find((item) => item.key === abilityKey)

    if (!entry) {
      return
    }

    markEditedAnchor('ability-grid')
    updateDraft((current) => {
      if (type === 'score') {
        current.core[abilityKey] = value
        if (!current.saveBehavior?.[abilityKey]?.manual) {
          current.core[entry.saveKey] = null
        }
      } else {
        current.core[entry.saveKey] = value
        current.saveBehavior[abilityKey].manual = true
      }

      return current
    })
  }

  function toggleSavingThrowProficiency(abilityKey, checked) {
    markEditedAnchor('ability-grid')
    updateDraft((current) => {
      const proficiencyKey = getSavingThrowProficiencyKey(abilityKey)
      const saveKey = abilityScoreEntries.find(
        (item) => item.key === abilityKey
      )?.saveKey

      current.core[proficiencyKey] = checked
      current.saveBehavior[abilityKey].competent = checked
      current.saveBehavior[abilityKey].manual = false

      if (saveKey) {
        current.core[saveKey] = null
      }

      return current
    })
  }

  function addCategoryFromEntry(entry) {
    const trimmedName = entry?.nombre?.trim()

    if (!trimmedName) {
      return
    }

    markEditedAnchor('info-categories')
    updateDraft((current) => {
      const alreadyExists = current.categorias.some(
        (item) =>
          normalizeLooseText(item.nombre) === normalizeLooseText(trimmedName)
      )

      if (!alreadyExists) {
        current.categorias.push({
          id: entry.id || null,
          nombre: trimmedName,
        })
      }

      return current
    })
    setCategoryQuery('')
  }

  function removeCategory(categoryName) {
    markEditedAnchor('info-categories')
    updateDraft((current) => {
      current.categorias = current.categorias.filter(
        (item) =>
          normalizeLooseText(item.nombre) !== normalizeLooseText(categoryName)
      )
      return current
    })
  }

  function addClassEntry() {
    markEditedAnchor('class-editor')
    updateDraft((current) => {
      current.clases.push({
        claseNombre: '',
        subclaseNombre: '',
        nivelClase: 1,
      })
      return current
    })
  }

  function updateClassEntry(index, fieldName, value) {
    markEditedAnchor('class-editor')
    updateDraft((current) => {
      if (fieldName === 'claseNombre') {
        current.clases[index][fieldName] = String(value || '').slice(
          0,
          CLASS_NAME_MAX_LENGTH
        )
      } else if (fieldName === 'subclaseNombre') {
        current.clases[index][fieldName] = String(value || '').slice(
          0,
          SUBCLASS_NAME_MAX_LENGTH
        )
      } else if (fieldName === 'nivelClase') {
        current.clases[index][fieldName] =
          String(value || '').trim() === ''
            ? ''
            : sanitizeIntegerInput(value, MAX_CLASS_LEVEL)
      } else {
        current.clases[index][fieldName] = value
      }
      return current
    })
  }

  function removeClassEntry(index) {
    markEditedAnchor('class-editor')
    updateDraft((current) => {
      current.clases.splice(index, 1)
      return current
    })
  }

  function addTraitGroup() {
    if (!newTraitTypeId) {
      return
    }

    const traitType = editorMeta?.tiposRasgo?.find(
      (item) => item.id === newTraitTypeId
    )

    if (!traitType) {
      return
    }

    markEditedAnchor('traits-editor')
    updateDraft((current) => {
      current.rasgosAgrupados.push({
        tipoRasgoId: traitType.id,
        nombre: traitType.nombre,
        ordenVisualizacion: traitType.ordenVisualizacion,
        rasgos: isSkillTraitGroupName(traitType.nombre)
          ? buildDefaultSkillTraits()
          : isActionTraitGroupName(traitType.nombre)
            ? [createDefaultActionStatsTrait()]
            : [],
      })
      return current
    })

    setNewTraitTypeId('')
  }

  function addTraitToGroup(groupIndex) {
    markEditedAnchor('traits-editor')
    updateDraft((current) => {
      current.rasgosAgrupados[groupIndex].rasgos.push({
        id: null,
        nombre: '',
        descripcion: '',
        esReutilizable: false,
      })
      return current
    })
  }

  function updateTrait(groupIndex, traitIndex, fieldName, value) {
    markEditedAnchor('traits-editor')
    updateDraft((current) => {
      current.rasgosAgrupados[groupIndex].rasgos[traitIndex][fieldName] = value
      return current
    })
  }

  function moveTraitWithinGroup(groupIndex, traitIndex, direction) {
    markEditedAnchor('traits-editor')
    updateDraft((current) => {
      const traits = current.rasgosAgrupados?.[groupIndex]?.rasgos
      const nextIndex = traitIndex + direction

      if (
        !Array.isArray(traits) ||
        traitIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= traits.length ||
        isActionStatsTrait(traits[traitIndex]) ||
        isActionStatsTrait(traits[nextIndex])
      ) {
        return current
      }

      const [trait] = traits.splice(traitIndex, 1)
      traits.splice(nextIndex, 0, trait)
      return current
    })
  }

  function addSavedTraitToDraft(trait) {
    if (!trait?.tipoRasgoId) {
      return
    }

    const traitType = editorMeta?.tiposRasgo?.find(
      (item) => item.id === trait.tipoRasgoId
    )

    if (!traitType) {
      return
    }

    markEditedAnchor('traits-editor')
    updateDraft((current) => {
      let group = current.rasgosAgrupados.find(
        (item) => item.tipoRasgoId === trait.tipoRasgoId
      )

      if (!group) {
        group = {
          tipoRasgoId: traitType.id,
          nombre: traitType.nombre,
          ordenVisualizacion: traitType.ordenVisualizacion,
          rasgos: isActionTraitGroupName(traitType.nombre)
            ? [createDefaultActionStatsTrait()]
            : [],
        }
        current.rasgosAgrupados.push(group)
      }

      ensureActionStatsTraitInGroup(group)
      const normalizedTraitName = normalizeLooseText(trait.nombre)
      const normalizedTraitDescription = normalizeLooseText(trait.descripcion)
      const alreadyAttached = group.rasgos.some(
        (item) =>
          item.id === trait.id ||
          (normalizeLooseText(item.nombre) === normalizedTraitName &&
            normalizeLooseText(item.descripcion) === normalizedTraitDescription)
      )

      if (!alreadyAttached) {
        group.rasgos.push({
          id: trait.id,
          nombre: trait.nombre,
          descripcion: trait.descripcion || '',
          esReutilizable: true,
        })
      }

      return current
    })
  }

  function moveTraitToGroup(sourceGroupIndex, traitIndex, targetTraitTypeId) {
    if (!targetTraitTypeId) {
      return
    }

    markEditedAnchor('traits-editor')
    updateDraft((current) => {
      const sourceGroup = current.rasgosAgrupados[sourceGroupIndex]
      const trait = sourceGroup?.rasgos?.[traitIndex]

      if (
        !sourceGroup ||
        !trait ||
        sourceGroup.tipoRasgoId === targetTraitTypeId
      ) {
        return current
      }

      const traitType = editorMeta?.tiposRasgo?.find(
        (item) => item.id === targetTraitTypeId
      )

      if (!traitType) {
        return current
      }

      sourceGroup.rasgos.splice(traitIndex, 1)

      let targetGroup = current.rasgosAgrupados.find(
        (group) => group.tipoRasgoId === targetTraitTypeId
      )

      if (!targetGroup) {
        targetGroup = {
          tipoRasgoId: traitType.id,
          nombre: traitType.nombre,
          ordenVisualizacion: traitType.ordenVisualizacion,
          rasgos: isActionTraitGroupName(traitType.nombre)
            ? [createDefaultActionStatsTrait()]
            : [],
        }
        current.rasgosAgrupados.push(targetGroup)
      }

      ensureActionStatsTraitInGroup(targetGroup)
      targetGroup.rasgos.push(trait)
      current.rasgosAgrupados = current.rasgosAgrupados.filter(
        (group) => group.rasgos.length
      )

      return current
    })
  }

  function removeTraitGroup(groupIndex) {
    markEditedAnchor('traits-editor')
    updateDraft((current) => {
      const targetGroup = current.rasgosAgrupados[groupIndex]
      current.rasgosAgrupados.splice(groupIndex, 1)
      if (normalizeLooseText(targetGroup?.nombre) === 'hechizos') {
        current.hechizos = []
        current.hechizosSlots = {}
      }
      return current
    })
  }

  function confirmTraitDelete(groupIndex, traitIndex) {
    const skipUntil = Number(
      window.localStorage.getItem(editorDismissStorageKey) || 0
    )
    if (skipUntil > Date.now()) {
      updateDraft((current) => {
        current.rasgosAgrupados[groupIndex].rasgos.splice(traitIndex, 1)
        return current
      })
      return
    }

    setDeleteTarget({ groupIndex, traitIndex })
  }

  function handleDeleteTraitConfirmed() {
    if (!deleteTarget) {
      return
    }

    if (skipDeletePromptToday) {
      window.localStorage.setItem(
        editorDismissStorageKey,
        String(Date.now() + 24 * 60 * 60 * 1000)
      )
    }

    updateDraft((current) => {
      current.rasgosAgrupados[deleteTarget.groupIndex].rasgos.splice(
        deleteTarget.traitIndex,
        1
      )
      return current
    })
    markEditedAnchor('traits-editor')

    setDeleteTarget(null)
    setSkipDeletePromptToday(false)
  }

  function addMusicEntry() {
    markEditedAnchor('music-section')
    updateDraft((current) => {
      current.temasMusicales.push({
        id: null,
        titulo: '',
        musicaUrl: '',
      })
      return current
    })
  }

  function updateMusicEntry(index, fieldName, value) {
    markEditedAnchor('music-section')
    updateDraft((current) => {
      current.temasMusicales[index][fieldName] = value
      return current
    })
  }

  function removeMusicEntry(index) {
    markEditedAnchor('music-section')
    updateDraft((current) => {
      current.temasMusicales.splice(index, 1)
      return current
    })
  }

  function setPrivacyMode(mode) {
    markEditedAnchor('info-privacy')
    updateDraft((current) => {
      current.privacidad.mode = mode
      if (mode !== 'custom') {
        current.privacidad.userPermissions = []
      }
      return current
    })
  }

  function setPermissionLevel(userId, level) {
    markEditedAnchor('info-privacy')
    updateDraft((current) => {
      current.privacidad.userPermissions =
        current.privacidad.userPermissions.filter(
          (item) => item.usuarioId !== userId
        )

      if (level !== 'sin_acceso') {
        current.privacidad.userPermissions.push({
          usuarioId: userId,
          nivelAccesoCodigo: level,
        })
      }

      return current
    })
  }

  function setVersionBase(baseCharacterId) {
    markEditedAnchor('info-versioning')
    updateCoreField(
      'personajeBaseId',
      baseCharacterId || null,
      'info-versioning'
    )
    setVersionSearchQuery('')
  }

  function toggleCopySection(sectionName) {
    setCopySections((current) => ({
      ...current,
      [sectionName]: !current[sectionName],
    }))
    setCopyFeedback('')
  }

  function applyCopiedSectionsFromSource() {
    if (!copySourceCharacter || !editorMeta) {
      setCopyFeedback('Selecciona primero un personaje origen.')
      return
    }

    const enabledSections = Object.entries(copySections)
      .filter(([, isEnabled]) => isEnabled)
      .map(([sectionName]) => sectionName)

    if (!enabledSections.length) {
      setCopyFeedback('Marca al menos una seccion para copiar.')
      return
    }

    const sourceDraft = buildEditorDraft(copySourceCharacter, editorMeta)

    markEditedAnchor('info-versioning')
    updateDraft((current) => {
      if (copySections.estadisticas) {
        const statFields = [
          'puntosGolpe',
          'claseArmadura',
          'velocidadPies',
          'velocidadMetros',
          'bonificadorCompetencia',
          'iniciativa',
          'percepcionPasiva',
          'investigacionPasiva',
          'puntosExperiencia',
          'fuerza',
          'destreza',
          'constitucion',
          'inteligencia',
          'sabiduria',
          'carisma',
          'salvacionFuerza',
          'salvacionDestreza',
          'salvacionConstitucion',
          'salvacionInteligencia',
          'salvacionSabiduria',
          'salvacionCarisma',
          'competenciaSalvacionFuerza',
          'competenciaSalvacionDestreza',
          'competenciaSalvacionConstitucion',
          'competenciaSalvacionInteligencia',
          'competenciaSalvacionSabiduria',
          'competenciaSalvacionCarisma',
        ]

        for (const field of statFields) {
          current.core[field] = sourceDraft.core[field]
        }

        current.clases = deepClone(sourceDraft.clases)
        current.rasgosAgrupados = deepClone(sourceDraft.rasgosAgrupados)
        current.hechizos = deepClone(sourceDraft.hechizos || [])
        current.hechizosSlots = deepClone(sourceDraft.hechizosSlots || {})
        current.saveBehavior = deepClone(sourceDraft.saveBehavior)
      }

      if (copySections.poderesObjetos) {
        current.poderes = deepClone(sourceDraft.poderes || [])
        current.objetos = deepClone(sourceDraft.objetos || [])
      }

      if (copySections.informacion) {
        const infoFields = [
          'titulo',
          'descripcion',
          'lore',
          'partidaAparicionId',
          'partidaDefuncionId',
          'edad',
          'alturaMetros',
          'pesoKg',
          'esCriatura',
          'tierId',
          'estadoId',
        ]

        for (const field of infoFields) {
          current.core[field] = sourceDraft.core[field]
        }

        current.categorias = deepClone(sourceDraft.categorias)
      }

      if (copySections.musica) {
        current.temasMusicales = deepClone(sourceDraft.temasMusicales)
      }

      if (copySections.galeria) {
        current.core.imagenPrincipalUrl = sourceDraft.core.imagenPrincipalUrl
        current.galeriaImagenes = deepClone(sourceDraft.galeriaImagenes)
      }

      return current
    })

    setCopyFeedback(
      `Se copiaron las secciones seleccionadas desde ${copySourceCharacter.nombre}.`
    )
  }

  async function handleGalleryUpload(event) {
    const files = Array.from(event.target.files || [])

    if (!files.length || !draft) {
      return
    }

    setUploadError('')
    setUploadState((current) => ({ ...current, gallery: true }))

    try {
      await Promise.all(files.map((file) => validateImageFile(file)))

      const uploadedUrls = []

      for (const file of files) {
        const imageUrl = await signAndUploadImage({
          file,
          campaignId: draft.core.campanaId,
          characterId: characterId || draftStorageId,
          entityType: 'character-gallery',
        })
        uploadedUrls.push(imageUrl)
      }

      updateDraft((current) => {
        current.galeriaImagenes.push(
          ...uploadedUrls.map((imageUrl) => ({
            id: null,
            imagenUrl: imageUrl,
          }))
        )
        return current
      })
      markEditedAnchor('gallery-section')

      setSelectedGalleryImageState({
        characterId: draftStorageId,
        imageUrl: uploadedUrls[uploadedUrls.length - 1],
      })
    } catch (error) {
      setUploadError(error.message || 'No se pudieron subir las imagenes.')
    } finally {
      setUploadState((current) => ({ ...current, gallery: false }))
      event.target.value = ''
    }
  }

  async function handleMainImageUpload(event) {
    const file = event.target.files?.[0]

    if (!file || !draft) {
      return
    }

    setUploadError('')
    setUploadState((current) => ({ ...current, gallery: true }))

    try {
      const imageUrl = await signAndUploadImage({
        file,
        campaignId: draft.core.campanaId,
        characterId: characterId || draftStorageId,
        entityType: 'character-gallery',
      })

      updateDraft((current) => {
        const previousMain = current.core.imagenPrincipalUrl

        if (
          previousMain &&
          previousMain !== imageUrl &&
          !current.galeriaImagenes.some(
            (item) => item.imagenUrl === previousMain
          )
        ) {
          current.galeriaImagenes.unshift({
            id: null,
            imagenUrl: previousMain,
          })
        }

        current.galeriaImagenes = current.galeriaImagenes.filter(
          (item) => item.imagenUrl !== imageUrl
        )
        current.core.imagenPrincipalUrl = imageUrl
        return current
      })
      markEditedAnchor('gallery-section')

      setSelectedGalleryImageState({
        characterId: draftStorageId,
        imageUrl,
      })
    } catch (error) {
      setUploadError(error.message || 'No se pudo subir la imagen.')
    } finally {
      setUploadState((current) => ({ ...current, gallery: false }))
      event.target.value = ''
    }
  }

  function removeGalleryImage(imageUrl) {
    markEditedAnchor('gallery-section')
    updateDraft((current) => {
      current.galeriaImagenes = current.galeriaImagenes.filter(
        (item) => item.imagenUrl !== imageUrl
      )

      if (current.core.imagenPrincipalUrl === imageUrl) {
        current.core.imagenPrincipalUrl =
          current.galeriaImagenes[0]?.imagenUrl || ''
      }

      return current
    })
  }

  function promoteGalleryImageToMain(imageUrl) {
    markEditedAnchor('gallery-section')
    updateDraft((current) => {
      const previousMain = current.core.imagenPrincipalUrl
      current.galeriaImagenes = current.galeriaImagenes.filter(
        (item) => item.imagenUrl !== imageUrl
      )

      if (
        previousMain &&
        previousMain !== imageUrl &&
        !current.galeriaImagenes.some((item) => item.imagenUrl === previousMain)
      ) {
        current.galeriaImagenes.unshift({
          id: null,
          imagenUrl: previousMain,
        })
      }

      current.core.imagenPrincipalUrl = imageUrl
      return current
    })

    setSelectedGalleryImageState({
      characterId: draftStorageId,
      imageUrl,
    })
  }

  return {
    addCategoryFromEntry,
    addClassEntry,
    addMusicEntry,
    addSavedTraitToDraft,
    addTraitGroup,
    addTraitToGroup,
    applyCopiedSectionsFromSource,
    availableTraitTypes,
    canManageSavedTraits,
    categoryQuery,
    confirmTraitDelete,
    copyFeedback,
    copySearchQuery,
    copySections,
    copySourceCharacter,
    currentItem,
    deleteTarget,
    deleteSavedTrait: deleteSavedTraitMutation.mutate,
    deleteSavedTraitPendingId: deleteSavedTraitMutation.variables || null,
    discardEditing,
    draft,
    editorHistory,
    filteredCategorySuggestions,
    filteredCopySourceOptions,
    filteredSavedTraits,
    filteredVersionBaseOptions,
    galleryInputRef,
    handleCancelEditing,
    handleDeleteTraitConfirmed,
    handleEditorFieldBlur,
    handleEditorFieldFocus,
    handleGalleryUpload,
    handleMainImageUpload,
    handleSaveEditing,
    handleStartEditing,
    isEditing,
    lastEditedAnchor,
    musicUrlErrors,
    moveTraitToGroup,
    moveTraitWithinGroup,
    newTraitTypeId,
    persistCurrentEditorSnapshot,
    promoteGalleryImageToMain,
    removeGalleryImage,
    saveError,
    saveMutation,
    selectedCopyCharacterId,
    selectedCopySource,
    selectedVersionBase,
    setCategoryQuery,
    setCopyFeedback,
    setCopySearchQuery,
    setDeleteTarget,
    setNewTraitTypeId,
    setPermissionLevel,
    setPrivacyMode,
    setSavedTraitQuery,
    setSavedTraitSourceEntityFilter,
    setSavedTraitSourceFilter,
    setSelectedCopyCharacterId,
    setShowAllSavedTraits,
    setShowRecentSavedTraits,
    setSkipDeletePromptToday,
    setVersionBase,
    savedTraitQuery,
    savedTraitClassSourceOptions,
    savedTraitSourceEntityFilter,
    savedTraitSourceFilter,
    showAllSavedTraits,
    showRecentSavedTraits,
    skipDeletePromptToday,
    toggleCopySection,
    toggleSavingThrowProficiency,
    undoDraft,
    updateAbilityField,
    updateClassEntry,
    updateCoreField,
    updateDraft,
    updateMusicEntry,
    updateTrait,
    uploadError,
    uploadState,
    versionSearchQuery,
    visibleSavedTraits,
    redoDraft,
    removeCategory,
    removeClassEntry,
    removeMusicEntry,
    removeTraitGroup,
    setVersionSearchQuery,
  }
}
