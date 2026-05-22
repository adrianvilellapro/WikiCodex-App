import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Footprints,
  Gauge,
  HeartPulse,
  ImagePlus,
  Info,
  Music,
  Package,
  Pencil,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { CommentsSection } from '../components/comments/CommentsSection'
import { FavoriteStarButton } from '../components/ui/FavoriteStarButton'
import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
import { useAuth } from '../features/auth/auth-context'
import { ACCEPTED_IMAGE_INPUT_TYPES } from '../lib/image-upload'
import { recordRecentActivity } from '../services/recent-activity'
import {
  deleteCharacter,
  fetchCharacterDetail,
  fetchCharacterCreationEditor,
  fetchCharacterEditor,
  fetchCharacterVersions,
  searchLinkableCharacterObjects,
  searchLinkableCharacterPowers,
  updateCharacterObjectTraitDisplay,
} from './character-detail/api'
import {
  AbilityScoreBlock,
  CharacterDeleteModal,
  ConfirmDeleteModal,
  CharacterDetailError,
  CharacterDetailLoading,
  CharacterSheetActions,
  CharacterSheetHeader,
  CharacterVersionButtons,
  EditableField,
  EditorModeBanner,
  PreviewModeNotice,
  ScrollTopButton,
} from './character-detail/components'
import {
  abilityScoreEntries,
  CHARACTER_NAME_MAX_LENGTH,
  CHARACTER_TITLE_MAX_LENGTH,
  CLASS_NAME_MAX_LENGTH,
  defaultEditorTab,
  MAX_ABILITY_SCORE,
  MAX_CLASS_LEVEL,
  MAX_DECIMAL_GENERAL,
  MAX_SAVING_THROW,
  MAX_SHEET_COMPETENCE,
  MAX_SHEET_GENERAL_INTEGER,
  MAX_SHEET_SPEED_INTEGER,
  SUBCLASS_NAME_MAX_LENGTH,
  tabs,
} from './character-detail/constants'
import {
  buildTraitColumns,
  formatDecimalCommaValue,
  getAbilityModifier,
  formatModifier,
  formatSheetModifier,
  formatSheetNumber,
  getCharacterSkillTotal,
  getCharacterClassSummary,
  getDisplayedSavingThrow,
  getObjectTraitOverrideKey,
  getMetersFromFeet,
  getMovementSummary,
  getMusicTitle,
  getPermissionCode,
  getSavingThrowProficiencyKey,
  getSelectedGalleryImage,
  ensureObjectTraitDrafts,
  isObjectDerivedTrait,
  normalizeLooseText,
  removeObjectTraitDrafts,
  sanitizeDecimalCommaInput,
  sanitizeIntegerInput,
} from './character-detail/utils'
import {
  createSkillTrait,
  baseSkillDefinitions,
  getSkillAbilityOption,
  isSkillTraitGroupName,
  parseSkillTrait,
  serializeSkillDescription,
  skillAbilityOptions,
  SKILL_TOTAL_LIMIT,
} from './character-detail/skills'
import {
  actionStatFields,
  ACTION_STATS_TRAIT_NAME,
  createDefaultActionStatsTrait,
  ensureActionStatsTraitInGroup,
  getActionStatsTraitEntry,
  getVisibleActionStats,
  getVisibleActionStatTokens,
  isActionStatsTrait,
  isActionTraitGroupName,
  parseActionStatsTrait,
  serializeActionStats,
} from './character-detail/actions'
import { useCharacterEditor } from './character-detail/useCharacterEditor'

function isSpellTraitGroupName(name) {
  return normalizeLooseText(name) === 'hechizos'
}

function isObjectTraitGroupName(name) {
  return normalizeLooseText(name) === 'objetos'
}

const spellActionStatKeys = new Set(['ataqueMagico', 'danoMagico', 'cd'])

const sheetAbilityInlineTokenDefinitions = [
  { token: '{Fue}', label: 'Fue', key: 'fuerza' },
  { token: '{Des}', label: 'Des', key: 'destreza' },
  { token: '{Con}', label: 'Con', key: 'constitucion' },
  { token: '{Int}', label: 'Int', key: 'inteligencia' },
  { token: '{Sab}', label: 'Sab', key: 'sabiduria' },
  { token: '{Car}', label: 'Car', key: 'carisma' },
]

const savingThrowInlineTokenDefinitions = [
  { token: '{Salvacion Fue}', label: 'Salvación de Fue', key: 'fuerza' },
  { token: '{Salvacion Des}', label: 'Salvación de Des', key: 'destreza' },
  { token: '{Salvacion Con}', label: 'Salvación de Con', key: 'constitucion' },
  {
    token: '{Salvacion Int}',
    label: 'Salvación de Int',
    key: 'inteligencia',
  },
  { token: '{Salvacion Sab}', label: 'Salvación de Sab', key: 'sabiduria' },
  { token: '{Salvacion Car}', label: 'Salvación de Car', key: 'carisma' },
]

function createInlineToken(token, label, value) {
  return {
    key: token,
    token,
    label,
    value: value === null || value === undefined || value === '' ? '-' : value,
  }
}

function getSkillInlineTokenName(skillName) {
  return `{${String(skillName || '').trim()}}`
}

function getLinkedObjectTraitGroups(object) {
  const existingGroups = (object.rasgosAgrupados || [])
    .map((group) => ({
      ...group,
      rasgos: [...(group.rasgos || [])],
    }))
    .filter((group) => group.rasgos.length)

  if (existingGroups.length) {
    return existingGroups.sort(
      (left, right) =>
        Number(left.ordenVisualizacion ?? 999) -
          Number(right.ordenVisualizacion ?? 999) ||
        String(left.nombre || '').localeCompare(String(right.nombre || ''))
    )
  }

  const groups = new Map()

  for (const trait of object.rasgos || []) {
    const name = trait.tipoRasgoNombre || 'Rasgos'
    const key = normalizeLooseText(name) || 'rasgos'

    if (!groups.has(key)) {
      groups.set(key, {
        id: trait.tipoRasgoId || key,
        nombre: name,
        ordenVisualizacion: trait.tipoRasgoOrden ?? 999,
        rasgos: [],
      })
    }

    groups.get(key).rasgos.push(trait)
  }

  return [...groups.values()].sort(
    (left, right) =>
      Number(left.ordenVisualizacion ?? 999) -
        Number(right.ordenVisualizacion ?? 999) ||
      String(left.nombre || '').localeCompare(String(right.nombre || ''))
  )
}

function formatSessionOptionLabel(session) {
  if (!session) {
    return '-'
  }

  const playedAt = session.jugadaEn
    ? new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(session.jugadaEn))
    : null

  return playedAt ? `${session.nombre} · ${playedAt}` : session.nombre
}

const editorIndexIcons = {
  estadisticas: Gauge,
  'poderes-objetos': Sparkles,
  informacion: Info,
  musica: Music,
  galeria: ImagePlus,
}

function CharacterEditorIndex({
  tabs,
  activeTab,
  characterId,
  collapsed,
  onCollapsedChange,
  onTabChange,
}) {
  if (collapsed) {
    return (
      <div className="character-editor-index character-editor-index--collapsed sticky top-[5rem] z-20 flex justify-center lg:top-20">
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          className="character-editor-index-button character-editor-index-button--control character-editor-index-button--collapsed group relative inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-card backdrop-blur transition"
          aria-label="Mostrar índice de ficha"
          title="Mostrar índice"
        >
          <ChevronDown className="h-4 w-4" />
          <span className="character-editor-index-tooltip pointer-events-none absolute left-1/2 top-[-2.25rem] -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 font-label text-[10px] font-bold uppercase tracking-[0.12em] opacity-0 shadow-card transition group-hover:opacity-100 lg:left-full lg:top-1/2 lg:ml-2 lg:-translate-x-0 lg:-translate-y-1/2">
            Mostrar índice
          </span>
        </button>
      </div>
    )
  }

  return (
    <nav
      className="character-editor-index theme-sheet-soft sticky top-[5rem] z-20 w-fit rounded-full border border-brand/20 p-1.5 shadow-card backdrop-blur lg:top-20 lg:rounded-xl lg:p-2"
      aria-label="Índice de edición de personaje"
    >
      <div className="flex items-center gap-1 lg:grid">
        <button
          type="button"
          onClick={() => onCollapsedChange(true)}
          className="character-editor-index-button character-editor-index-button--control group relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
          aria-label="Plegar índice de ficha"
          title="Plegar índice"
        >
          <ChevronUp className="h-4 w-4" />
          <span className="character-editor-index-tooltip pointer-events-none absolute left-1/2 top-[-2.25rem] -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 font-label text-[10px] font-bold uppercase tracking-[0.12em] opacity-0 shadow-card transition group-hover:opacity-100 lg:left-full lg:top-1/2 lg:ml-2 lg:-translate-x-0 lg:-translate-y-1/2">
            Plegar índice
          </span>
        </button>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = editorIndexIcons[tab.id] || Gauge

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange({ characterId, tab: tab.id })}
              className={clsx(
                'group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition',
                isActive
                  ? 'character-editor-index-button--active shadow-card'
                  : 'character-editor-index-button'
              )}
              aria-label={`Ir a ${tab.label}`}
              title={tab.label}
            >
              <Icon className="h-4 w-4" />
              <span className="character-editor-index-tooltip pointer-events-none absolute left-1/2 top-[-2.25rem] -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 font-label text-[10px] font-bold uppercase tracking-[0.12em] opacity-0 shadow-card transition group-hover:opacity-100 lg:left-full lg:top-1/2 lg:ml-2 lg:-translate-x-0 lg:-translate-y-1/2">
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function CharacterDetailPage({ createMode = false }) {
  const { characterId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isCharacterDeleteOpen, setIsCharacterDeleteOpen] = useState(false)
  const [characterDeleteText, setCharacterDeleteText] = useState('')
  const [deletingCharacterId, setDeletingCharacterId] = useState(null)
  const [activeTabState, setActiveTabState] = useState({
    characterId: null,
    tab: defaultEditorTab,
  })
  const [selectedGalleryImageState, setSelectedGalleryImageState] = useState({
    characterId: null,
    imageUrl: null,
  })
  const [spellPickerQuery, setSpellPickerQuery] = useState('')
  const [spellPickerClass, setSpellPickerClass] = useState('')
  const [spellPickerLevel, setSpellPickerLevel] = useState('')
  const [mobileSingleTraitMode, setMobileSingleTraitMode] = useState(false)
  const [mobileTraitGroupId, setMobileTraitGroupId] = useState('')
  const [skillManualInputs, setSkillManualInputs] = useState({})
  const [collapsedSkillTables, setCollapsedSkillTables] = useState({})
  const [collapsedTraitGroups, setCollapsedTraitGroups] = useState({})
  const [traitsToolsOpen, setTraitsToolsOpen] = useState(true)
  const [isEditorIndexCollapsed, setIsEditorIndexCollapsed] = useState(false)
  const [heightInputValue, setHeightInputValue] = useState(null)
  const [powerLinkQuery, setPowerLinkQuery] = useState('')
  const [objectLinkQuery, setObjectLinkQuery] = useState('')
  const [expandedLinkedObjects, setExpandedLinkedObjects] = useState({})
  const mainImageInputRef = useRef(null)
  const isDeletingCurrentCharacter = deletingCharacterId === characterId

  const { data, isLoading, isError } = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => fetchCharacterDetail(characterId),
    enabled: Boolean(!createMode && characterId && !isDeletingCurrentCharacter),
    staleTime: 60 * 1000,
  })

  const { data: versionsResponse } = useQuery({
    queryKey: ['character-versions', characterId],
    queryFn: () => fetchCharacterVersions(characterId),
    enabled: Boolean(!createMode && characterId && !isDeletingCurrentCharacter),
    staleTime: 60 * 1000,
  })

  const {
    data: editorResponse,
    isLoading: isEditorLoading,
    isError: isEditorError,
  } = useQuery({
    queryKey: createMode
      ? ['character-editor', 'new']
      : ['character-editor', characterId],
    queryFn: () =>
      createMode
        ? fetchCharacterCreationEditor()
        : fetchCharacterEditor(characterId),
    enabled: Boolean(
      createMode ||
      (characterId && data?.puedeEditar && !isDeletingCurrentCharacter)
    ),
    staleTime: 60 * 1000,
  })

  const editorMeta = editorResponse?.editor || null
  const preserveCharacterEditor = Boolean(
    location.state?.preserveCharacterEditor
  )

  const {
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
    currentItem,
    deleteSavedTrait,
    deleteSavedTraitPendingId,
    deleteTarget,
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
    musicUrlErrors,
    moveTraitToGroup,
    moveTraitWithinGroup,
    newTraitTypeId,
    persistCurrentEditorSnapshot,
    promoteGalleryImageToMain,
    redoDraft,
    removeCategory,
    removeClassEntry,
    removeGalleryImage,
    removeMusicEntry,
    removeTraitGroup,
    saveError,
    saveMutation,
    selectedCopyCharacterId,
    selectedCopySource,
    selectedVersionBase,
    setCategoryQuery,
    setCopySearchQuery,
    setCopyFeedback,
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
    setVersionSearchQuery,
    skipDeletePromptToday,
    savedTraitQuery,
    savedTraitClassSourceOptions,
    savedTraitSourceEntityFilter,
    savedTraitSourceFilter,
    showAllSavedTraits,
    showRecentSavedTraits,
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
  } = useCharacterEditor({
    characterId,
    currentUserId: user?.id,
    createMode,
    data,
    editorMeta,
    activeTabState,
    setActiveTabState,
    preserveCharacterEditor,
    onCreated: (item) => navigate(`/app/personajes/${item.id}`),
    setSelectedGalleryImageState,
  })

  useEffect(() => {
    if (!isEditing) {
      const frameId = window.requestAnimationFrame(() => {
        setHeightInputValue(null)
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    return undefined
  }, [isEditing])

  const objectTraitDisplayMutation = useMutation({
    mutationFn: ({ objectId, mostrarRasgosEnFicha }) =>
      updateCharacterObjectTraitDisplay(
        currentItem?.id || characterId,
        objectId,
        mostrarRasgosEnFicha
      ),
    onSuccess: (item) => {
      queryClient.setQueryData(['character', item.id], item)
      queryClient.invalidateQueries({ queryKey: ['character', item.id] })
    },
  })

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
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [characterId])

  useEffect(() => {
    if (createMode || !currentItem?.id) {
      return
    }

    recordRecentActivity({
      entityType: 'character',
      entityId: currentItem.id,
      nombre: currentItem.nombre,
      subtitulo:
        currentItem.titulo || currentItem.campana?.nombre || 'Personaje',
      imagenUrl: currentItem.imagenPrincipalUrl,
      urlDestino: `/app/personajes/${currentItem.id}`,
      modoVista: currentItem.modoVista,
    })
  }, [
    createMode,
    currentItem?.campana?.nombre,
    currentItem?.id,
    currentItem?.imagenPrincipalUrl,
    currentItem?.modoVista,
    currentItem?.nombre,
    currentItem?.titulo,
  ])

  const activeCharacterKey = characterId || 'nuevo-personaje'
  const activeTab =
    activeTabState.characterId === activeCharacterKey
      ? activeTabState.tab
      : defaultEditorTab
  const showEditorIndex = createMode || isEditing

  const handleCharacterTabChange = (nextTabState) => {
    setActiveTabState(nextTabState)
  }

  const selectedDraftCampaignId = draft?.core.campanaId
  const linkedPowers = useMemo(
    () => (isEditing ? draft?.poderes || [] : currentItem?.poderes || []),
    [currentItem?.poderes, draft?.poderes, isEditing]
  )
  const linkedObjects = useMemo(
    () => (isEditing ? draft?.objetos || [] : currentItem?.objetos || []),
    [currentItem?.objetos, draft?.objetos, isEditing]
  )
  const selectedLinkedPowerIds = useMemo(
    () => new Set(linkedPowers.map((item) => item.poderId || item.id)),
    [linkedPowers]
  )
  const selectedLinkedObjectIds = useMemo(
    () => new Set(linkedObjects.map((item) => item.objetoId || item.id)),
    [linkedObjects]
  )
  const powerSearchQuery = useQuery({
    queryKey: ['character-linkable-powers', powerLinkQuery],
    queryFn: () => searchLinkableCharacterPowers(powerLinkQuery, 20),
    enabled: Boolean(isEditing && activeTab === 'poderes-objetos'),
    staleTime: 45 * 1000,
  })
  const objectSearchQuery = useQuery({
    queryKey: ['character-linkable-objects', objectLinkQuery],
    queryFn: () => searchLinkableCharacterObjects(objectLinkQuery, 20),
    enabled: Boolean(isEditing && activeTab === 'poderes-objetos'),
    staleTime: 45 * 1000,
  })

  const classSummary = getCharacterClassSummary(currentItem)
  const selectedCampaignSessions = useMemo(() => {
    if (!selectedDraftCampaignId) {
      return []
    }

    return (
      editorMeta?.campanas?.find(
        (campaign) => campaign.id === selectedDraftCampaignId
      )?.partidas || []
    )
  }, [editorMeta?.campanas, selectedDraftCampaignId])

  function updateDraftCampaign(nextCampaignId) {
    updateDraft((current) => {
      current.core.campanaId = nextCampaignId
      const selectedCampaign = editorMeta?.campanas?.find(
        (campaign) => campaign.id === nextCampaignId
      )
      const adventureStillExists = selectedCampaign?.aventuras?.some(
        (adventure) => adventure.id === current.core.aventuraId
      )

      if (!adventureStillExists) {
        current.core.aventuraId = null
      }

      const nextSessionIds = new Set(
        (selectedCampaign?.partidas || []).map((session) => session.id)
      )

      if (!nextSessionIds.has(current.core.partidaAparicionId)) {
        current.core.partidaAparicionId = null
      }

      if (!nextSessionIds.has(current.core.partidaDefuncionId)) {
        current.core.partidaDefuncionId = null
      }

      return current
    })
  }

  const galleryImages = useMemo(() => {
    if (!currentItem) {
      return []
    }

    const allImages = [
      ...(currentItem.imagenPrincipalUrl
        ? [
            {
              id: 'principal',
              imagenUrl: currentItem.imagenPrincipalUrl,
              esPrincipal: true,
            },
          ]
        : []),
      ...(currentItem.galeriaImagenes || []).map((item) => ({
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
  }, [currentItem])

  const savedSpellMap = useMemo(
    () =>
      new Map(
        (editorMeta?.hechizosGuardados || []).map((spell) => [spell.id, spell])
      ),
    [editorMeta?.hechizosGuardados]
  )
  const characterSpells = useMemo(() => {
    const source = isEditing
      ? draft?.hechizos || []
      : currentItem?.hechizos || []

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
          (left.nivel || 0) - (right.nivel || 0) ||
          String(left.nombre || '').localeCompare(String(right.nombre || ''))
      )
  }, [currentItem?.hechizos, draft?.hechizos, isEditing, savedSpellMap])
  const selectedSpellIds = useMemo(
    () => new Set(characterSpells.map((spell) => spell.id)),
    [characterSpells]
  )
  const shouldRenderStandaloneSpellBlock = false
  const spellSlots = useMemo(
    () => (isEditing ? draft?.hechizosSlots : currentItem?.hechizosSlots) || {},
    [currentItem?.hechizosSlots, draft?.hechizosSlots, isEditing]
  )
  const groupedCharacterSpells = useMemo(() => {
    const groups = new Map([[0, []]])
    const highestSlotLevel = Math.max(
      0,
      ...Object.entries(spellSlots || {})
        .map(([level]) => Number(level))
        .filter((level) => Number.isFinite(level))
    )
    const highestSpellLevel = Math.max(
      0,
      ...characterSpells.map((spell) => Number(spell.nivel || 0))
    )
    const highestLevel = Math.max(highestSlotLevel, highestSpellLevel)

    for (let level = 1; level <= highestLevel; level += 1) {
      groups.set(level, [])
    }

    for (const spell of characterSpells) {
      const level = Number(spell.nivel || 0)

      if (!groups.has(level)) {
        groups.set(level, [])
      }

      groups.get(level).push(spell)
    }

    return [...groups.entries()]
      .sort(([leftLevel], [rightLevel]) => leftLevel - rightLevel)
      .map(([level, spells]) => ({
        level,
        label: level === 0 ? 'Trucos' : `NV${level}`,
        slots: level === 0 ? null : Number(spellSlots?.[level] || 0),
        spells: spells.sort((left, right) =>
          String(left.nombre || '').localeCompare(String(right.nombre || ''))
        ),
      }))
  }, [characterSpells, spellSlots])
  const objectSpellGroups = useMemo(() => {
    return linkedObjects
      .filter(
        (object) =>
          object.mostrarRasgosEnFicha &&
          ((object.hechizos || []).length ||
            Object.keys(object.hechizosSlots || {}).length)
      )
      .map((object) => {
        const groups = new Map()
        const slots = object.hechizosSlots || {}
        const highestSlotLevel = Math.max(
          0,
          ...Object.keys(slots)
            .map((level) => Number(level))
            .filter((level) => Number.isFinite(level))
        )
        const highestSpellLevel = Math.max(
          0,
          ...(object.hechizos || []).map((spell) => Number(spell.nivel || 0))
        )

        for (
          let level = 0;
          level <= Math.max(highestSlotLevel, highestSpellLevel);
          level += 1
        ) {
          groups.set(level, [])
        }

        for (const spell of object.hechizos || []) {
          const level = Number(spell.nivel || 0)

          if (!groups.has(level)) {
            groups.set(level, [])
          }

          groups.get(level).push(spell)
        }

        return {
          object,
          groups: [...groups.entries()]
            .sort(([leftLevel], [rightLevel]) => leftLevel - rightLevel)
            .map(([level, spells]) => ({
              level,
              label: level === 0 ? 'Trucos' : `NV${level}`,
              slots: level === 0 ? null : Number(slots?.[level] || 0),
              spells: spells.sort((left, right) =>
                String(left.nombre || '').localeCompare(
                  String(right.nombre || '')
                )
              ),
            })),
        }
      })
  }, [linkedObjects])
  const hasDynamicSpellContent = useMemo(
    () =>
      characterSpells.length > 0 ||
      objectSpellGroups.length > 0 ||
      Object.keys(spellSlots || {}).some((level) =>
        Number.isFinite(Number(level))
      ),
    [characterSpells.length, objectSpellGroups.length, spellSlots]
  )
  const traitGroupsForLayout = useMemo(() => {
    const visibleLinkedObjectIds = new Set(
      linkedObjects
        .filter((object) => object.mostrarRasgosEnFicha)
        .map((object) => object.id || object.objetoId)
        .filter(Boolean)
    )
    const groups = [...(currentItem?.rasgosAgrupados || [])].map((group) => ({
      ...group,
      rasgos: [...(group.rasgos || [])]
        .filter((trait) => {
          if (!isObjectDerivedTrait(trait)) {
            return true
          }

          const objectId = trait.origenEntidadId || trait.objetoId
          return visibleLinkedObjectIds.has(objectId)
        })
        .map((trait) =>
          isObjectDerivedTrait(trait)
            ? {
                ...trait,
                esRasgoObjeto: true,
                objetoId: trait.origenEntidadId || trait.objetoId,
                objetoNombre: trait.origenEntidadNombre || trait.objetoNombre,
              }
            : trait
        ),
    }))
    const objectOverrideKeys = new Set()

    for (const group of groups) {
      for (const trait of group.rasgos || []) {
        const key = getObjectTraitOverrideKey(trait)

        if (key) {
          objectOverrideKeys.add(key)
        }
      }
    }

    const hasSpellGroup = groups.some((group) =>
      isSpellTraitGroupName(group.nombre)
    )
    const hasObjectGroup = groups.some((group) =>
      isObjectTraitGroupName(group.nombre)
    )

    if (!hasSpellGroup && hasDynamicSpellContent) {
      const spellTraitType = editorMeta?.tiposRasgo?.find((traitType) =>
        isSpellTraitGroupName(traitType.nombre)
      )

      groups.push({
        id: spellTraitType?.id || 'dynamic-spells',
        tipoRasgoId: spellTraitType?.id || 'dynamic-spells',
        nombre: spellTraitType?.nombre || 'Hechizos',
        ordenVisualizacion: spellTraitType?.ordenVisualizacion ?? 999,
        rasgos: [],
      })
    }

    if (!hasObjectGroup && linkedObjects.length > 0) {
      const objectTraitType = editorMeta?.tiposRasgo?.find((traitType) =>
        isObjectTraitGroupName(traitType.nombre)
      )

      groups.push({
        id: objectTraitType?.id || 'dynamic-objects',
        tipoRasgoId: objectTraitType?.id || 'dynamic-objects',
        nombre: objectTraitType?.nombre || 'Objetos',
        ordenVisualizacion: objectTraitType?.ordenVisualizacion ?? 999,
        rasgos: [],
      })
    }

    for (const object of linkedObjects) {
      if (!object.mostrarRasgosEnFicha) {
        continue
      }

      for (const objectGroup of getLinkedObjectTraitGroups(object)) {
        for (const trait of objectGroup.rasgos || []) {
          const objectId = object.id || object.objetoId
          const overrideKey =
            objectId && trait.id ? `${objectId}:${trait.id}` : null

          if (overrideKey && objectOverrideKeys.has(overrideKey)) {
            continue
          }

          const traitTypeName =
            trait.tipoRasgoNombre || objectGroup.nombre || 'Rasgos'
          const matchingType = editorMeta?.tiposRasgo?.find(
            (traitType) =>
              normalizeLooseText(traitType.nombre) ===
              normalizeLooseText(traitTypeName)
          )
          let targetGroup = groups.find(
            (group) =>
              normalizeLooseText(group.nombre) ===
              normalizeLooseText(traitTypeName)
          )

          if (!targetGroup) {
            targetGroup = {
              id: matchingType?.id || `object-${traitTypeName}`,
              tipoRasgoId: matchingType?.id || `object-${traitTypeName}`,
              nombre: matchingType?.nombre || traitTypeName,
              ordenVisualizacion:
                matchingType?.ordenVisualizacion ??
                trait.tipoRasgoOrden ??
                objectGroup.ordenVisualizacion ??
                990,
              rasgos: [],
            }
            groups.push(targetGroup)
          }

          targetGroup.rasgos.push({
            ...trait,
            id: `object-${object.id || object.objetoId}-${trait.id}`,
            nombre: `[${object.nombre}] ${trait.nombre}`,
            esRasgoObjeto: true,
            esRasgoObjetoDinamico: true,
            objetoNombre: object.nombre,
            objetoId: object.id || object.objetoId,
          })
        }
      }
    }

    return groups
  }, [
    currentItem?.rasgosAgrupados,
    editorMeta?.tiposRasgo,
    hasDynamicSpellContent,
    linkedObjects,
  ])
  const layout = useMemo(
    () => buildTraitColumns(traitGroupsForLayout, editorMeta?.tiposRasgo || []),
    [traitGroupsForLayout, editorMeta?.tiposRasgo]
  )
  const actionInlineTokens = useMemo(() => {
    const groups = isEditing
      ? draft?.rasgosAgrupados || []
      : traitGroupsForLayout || []
    const actionGroup = groups.find((group) =>
      isActionTraitGroupName(group.nombre)
    )

    if (!actionGroup) {
      return []
    }

    return getVisibleActionStatTokens(
      parseActionStatsTrait(getActionStatsTraitEntry(actionGroup).trait)
    )
  }, [draft?.rasgosAgrupados, isEditing, traitGroupsForLayout])
  const sheetInlineTokens = useMemo(() => {
    if (!currentItem) {
      return []
    }

    const tokens = sheetAbilityInlineTokenDefinitions.map((definition) =>
      createInlineToken(
        definition.token,
        definition.label,
        formatSheetModifier(getAbilityModifier(currentItem[definition.key]))
      )
    )

    for (const definition of savingThrowInlineTokenDefinitions) {
      const ability = abilityScoreEntries.find(
        (item) => item.key === definition.key
      )
      const savingThrow = ability
        ? getDisplayedSavingThrow(currentItem, ability.key, ability.saveKey)
        : null

      tokens.push(
        createInlineToken(
          definition.token,
          definition.label,
          savingThrow === null || savingThrow === undefined
            ? '+0'
            : formatSheetModifier(savingThrow)
        )
      )
    }

    tokens.push(
      createInlineToken(
        '{PG}',
        'PG',
        formatSheetNumber(currentItem.puntosGolpe)
      ),
      createInlineToken(
        '{Ca}',
        'CA',
        formatSheetNumber(currentItem.claseArmadura)
      ),
      createInlineToken(
        '{Movimiento}',
        'Movimiento',
        getMovementSummary(currentItem)
      ),
      createInlineToken(
        '{Competencia}',
        'Competencia',
        formatSheetModifier(currentItem.bonificadorCompetencia)
      ),
      createInlineToken(
        '{Percepcion Pasiva}',
        'Percepción pasiva',
        formatSheetNumber(currentItem.percepcionPasiva)
      ),
      createInlineToken(
        '{Investigacion Pasiva}',
        'Investigación pasiva',
        formatSheetNumber(currentItem.investigacionPasiva)
      )
    )

    const skillNames = new Map()
    for (const [skillName] of baseSkillDefinitions) {
      skillNames.set(normalizeLooseText(skillName), skillName)
    }

    const skillGroup = (currentItem.rasgosAgrupados || []).find((group) =>
      isSkillTraitGroupName(group.nombre)
    )
    for (const trait of skillGroup?.rasgos || []) {
      const skill = parseSkillTrait(trait)
      if (skill.nombre?.trim()) {
        skillNames.set(normalizeLooseText(skill.nombre), skill.nombre.trim())
      }
    }

    for (const skillName of skillNames.values()) {
      const total = getCharacterSkillTotal(currentItem, skillName)
      tokens.push(
        createInlineToken(
          getSkillInlineTokenName(skillName),
          skillName,
          total === null || total === undefined ? '-' : formatModifier(total)
        )
      )
    }

    return tokens
  }, [currentItem])
  const characterInlineTokens = useMemo(
    () => [...actionInlineTokens, ...sheetInlineTokens],
    [actionInlineTokens, sheetInlineTokens]
  )
  const spellActionInlineTokens = useMemo(
    () =>
      actionInlineTokens.filter((token) => spellActionStatKeys.has(token.key)),
    [actionInlineTokens]
  )
  const mobileTraitGroups = useMemo(
    () => layout.allGroups || [...layout.leftGroups, ...layout.rightGroups],
    [layout]
  )
  const selectedMobileTraitGroup =
    mobileTraitGroups.find((group) => group.id === mobileTraitGroupId) ||
    mobileTraitGroups[0] ||
    null
  const selectedMobileTraitGroupIndex = selectedMobileTraitGroup
    ? mobileTraitGroups.findIndex(
        (group) => group.id === selectedMobileTraitGroup.id
      )
    : -1
  const sortedSavedSpells = useMemo(
    () =>
      [...(editorMeta?.hechizosGuardados || [])].sort(
        (left, right) =>
          Number(left.nivel || 0) - Number(right.nivel || 0) ||
          String(left.nombre || '').localeCompare(String(right.nombre || ''))
      ),
    [editorMeta?.hechizosGuardados]
  )
  const spellClassOptions = useMemo(() => {
    const classes = new Set()

    for (const spell of editorMeta?.hechizosGuardados || []) {
      for (const className of spell.clases || []) {
        if (className) {
          classes.add(className)
        }
      }
    }

    return [...classes].sort((left, right) =>
      String(left).localeCompare(String(right))
    )
  }, [editorMeta?.hechizosGuardados])
  const filteredSavedSpells = useMemo(() => {
    const normalizedQuery = normalizeLooseText(spellPickerQuery)
    const normalizedClass = normalizeLooseText(spellPickerClass)

    return sortedSavedSpells.filter((spell) => {
      const matchesQuery =
        !normalizedQuery ||
        normalizeLooseText(
          `${spell.nombre || ''} ${spell.escuela || ''} ${(spell.clases || []).join(' ')}`
        ).includes(normalizedQuery)
      const matchesClass =
        !normalizedClass ||
        (spell.clases || []).some(
          (className) => normalizeLooseText(className) === normalizedClass
        )
      const matchesLevel =
        spellPickerLevel === '' ||
        Number(spell.nivel || 0) === Number(spellPickerLevel)

      return matchesQuery && matchesClass && matchesLevel
    })
  }, [sortedSavedSpells, spellPickerClass, spellPickerLevel, spellPickerQuery])

  function addPowerToDraft(power) {
    updateDraft((current) => {
      const powerId = power.id || power.poderId

      if (
        !powerId ||
        current.poderes?.some((item) => (item.poderId || item.id) === powerId)
      ) {
        return current
      }

      current.poderes = [
        ...(current.poderes || []),
        {
          ...power,
          id: powerId,
          poderId: powerId,
        },
      ]
      return current
    })
  }

  function removePowerFromDraft(powerId) {
    updateDraft((current) => {
      current.poderes = (current.poderes || []).filter(
        (item) => (item.poderId || item.id) !== powerId
      )
      return current
    })
  }

  function addObjectToDraft(object) {
    updateDraft((current) => {
      const objectId = object.id || object.objetoId

      if (
        !objectId ||
        current.objetos?.some((item) => (item.objetoId || item.id) === objectId)
      ) {
        return current
      }

      current.objetos = [
        ...(current.objetos || []),
        {
          ...object,
          id: objectId,
          objetoId: objectId,
          mostrarRasgosEnFicha: true,
        },
      ]
      ensureObjectTraitDrafts(
        current,
        current.objetos[current.objetos.length - 1],
        editorMeta
      )
      return current
    })
  }

  function removeObjectFromDraft(objectId) {
    updateDraft((current) => {
      current.objetos = (current.objetos || []).filter(
        (item) => (item.objetoId || item.id) !== objectId
      )
      removeObjectTraitDrafts(current, objectId)
      return current
    })
  }

  function toggleObjectTraitsInDraft(objectId) {
    updateDraft((current) => {
      const linkedObject = current.objetos?.find(
        (item) => (item.objetoId || item.id) === objectId
      )

      if (!linkedObject) {
        return current
      }

      linkedObject.mostrarRasgosEnFicha = !linkedObject.mostrarRasgosEnFicha

      if (linkedObject.mostrarRasgosEnFicha) {
        ensureObjectTraitDrafts(current, linkedObject, editorMeta)
      } else {
        removeObjectTraitDrafts(current, objectId)
      }

      return current
    })
  }

  function toggleObjectTraitsInSheet(objectId) {
    if (createMode || isEditing || !currentItem?.id || !objectId) {
      return
    }

    const linkedObject = linkedObjects.find(
      (item) => (item.objetoId || item.id) === objectId
    )

    if (!linkedObject) {
      return
    }

    objectTraitDisplayMutation.mutate({
      objectId,
      mostrarRasgosEnFicha: !linkedObject.mostrarRasgosEnFicha,
    })
  }

  function toggleLinkedObjectExpanded(objectId) {
    setExpandedLinkedObjects((current) => ({
      ...current,
      [objectId]: !current[objectId],
    }))
  }

  function renderLinkedPowerCard(power, { editable = false } = {}) {
    const powerId = power.poderId || power.id

    return (
      <article key={powerId} className="theme-sheet-card border p-4 max-sm:p-3">
        <div className="flex gap-4 max-sm:gap-3">
          <a
            href={`/app/poderes/otros/${powerId}`}
            target="_blank"
            rel="noreferrer"
            className="h-20 w-20 shrink-0 overflow-hidden border border-brand/20 bg-brand/10 max-sm:h-16 max-sm:w-16"
            aria-label={`Abrir ${power.nombre}`}
          >
            {power.imagenUrl ? (
              <CloudinaryImage
                src={power.imagenUrl}
                alt={power.nombre}
                variant="thumb"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-brand">
                <Sparkles className="h-8 w-8" />
              </span>
            )}
          </a>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3 max-sm:gap-2">
              <div className="min-w-0">
                <h4 className="break-words font-headline text-lg font-black text-ink [overflow-wrap:anywhere] max-sm:text-base">
                  {power.nombre}
                </h4>
                {power.categorias?.length ? (
                  <p className="mt-1 text-xs font-semibold text-ink-muted">
                    {power.categorias
                      .map((category) => category.nombre)
                      .join(', ')}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2 max-sm:gap-1">
                <a
                  href={`/app/poderes/otros/${powerId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-700 transition hover:border-brand hover:text-brand max-sm:h-8 max-sm:w-8"
                  aria-label={`Abrir ficha de ${power.nombre}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => removePowerFromDraft(powerId)}
                    className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-red-700 transition hover:border-red-300 max-sm:h-8 max-sm:w-8"
                    aria-label={`Quitar ${power.nombre}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            {power.descripcion ? (
              <div className="theme-sheet-copy mt-3 text-sm leading-6 text-ink-soft max-sm:line-clamp-3 max-sm:text-xs max-sm:leading-5">
                <WikiText text={power.descripcion} />
              </div>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  function renderLinkedObjectCard(
    object,
    { editable = false, compact = false, canToggleDisplay = false } = {}
  ) {
    const objectId = object.objetoId || object.id
    const isExpanded = Boolean(expandedLinkedObjects[objectId])
    const objectTraitGroups = getLinkedObjectTraitGroups(object)
    const hasDetails =
      object.descripcion ||
      objectTraitGroups.length ||
      (object.hechizos || []).length

    return (
      <article
        key={objectId}
        className="theme-sheet-card border p-4 max-sm:p-3"
      >
        <div className="flex gap-4 max-sm:gap-3">
          <a
            href={`/app/objetos/${objectId}`}
            target="_blank"
            rel="noreferrer"
            className="h-20 w-20 shrink-0 overflow-hidden border border-brand/20 bg-brand/10 max-sm:h-16 max-sm:w-16"
            aria-label={`Abrir ${object.nombre}`}
          >
            {object.imagenPrincipalUrl ? (
              <CloudinaryImage
                src={object.imagenPrincipalUrl}
                alt={object.nombre}
                variant="thumb"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-brand">
                <Package className="h-8 w-8" />
              </span>
            )}
          </a>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3 max-sm:gap-2">
              <div className="min-w-0">
                <h4 className="break-words font-headline text-lg font-black text-ink [overflow-wrap:anywhere] max-sm:text-base">
                  {object.nombre}
                </h4>
                <div className="mt-1 flex flex-wrap gap-2 max-sm:gap-1">
                  {object.tier?.nombre ? (
                    <span className="rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-brand">
                      {object.tier.nombre}
                    </span>
                  ) : null}
                  {object.tipoMagicoCodigo ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                      {object.tipoMagicoCodigo.replace('_', ' ')}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2 max-sm:gap-1">
                <button
                  type="button"
                  onClick={() => toggleLinkedObjectExpanded(objectId)}
                  disabled={!hasDetails}
                  className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 max-sm:h-8 max-sm:w-8"
                  aria-label={isExpanded ? 'Plegar objeto' : 'Desplegar objeto'}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                <a
                  href={`/app/objetos/${objectId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-700 transition hover:border-brand hover:text-brand max-sm:h-8 max-sm:w-8"
                  aria-label={`Abrir ficha de ${object.nombre}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {canToggleDisplay ? (
                  <button
                    type="button"
                    onClick={() =>
                      editable
                        ? toggleObjectTraitsInDraft(objectId)
                        : toggleObjectTraitsInSheet(objectId)
                    }
                    disabled={!editable && objectTraitDisplayMutation.isPending}
                    className={clsx(
                      'inline-flex h-9 w-9 items-center justify-center border transition disabled:cursor-wait disabled:opacity-60 max-sm:h-8 max-sm:w-8',
                      object.mostrarRasgosEnFicha
                        ? 'border-brand/30 bg-brand/10 text-brand'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand hover:text-brand'
                    )}
                    aria-label={
                      object.mostrarRasgosEnFicha
                        ? 'Ocultar rasgos del objeto en estadisticas'
                        : 'Mostrar rasgos del objeto en estadisticas'
                    }
                  >
                    {object.mostrarRasgosEnFicha ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
                {editable ? (
                  <>
                    <button
                      type="button"
                      onClick={() => removeObjectFromDraft(objectId)}
                      className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-red-700 transition hover:border-red-300 max-sm:h-8 max-sm:w-8"
                      aria-label={`Quitar ${object.nombre}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {isExpanded && !compact ? (
              <div className="theme-sheet-copy mt-4 grid gap-4 text-sm leading-6 max-sm:gap-3 max-sm:text-xs max-sm:leading-5">
                {object.descripcion ? (
                  <WikiText text={object.descripcion} />
                ) : null}
                {objectTraitGroups.map((group) => (
                  <div
                    key={group.id || group.nombre}
                    className="grid gap-2 border-t border-stroke/60 pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-px flex-1 bg-stroke/60" />
                      <p className="font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-muted">
                        {group.nombre}
                      </p>
                      <span className="h-px flex-1 bg-stroke/60" />
                    </div>
                    {(group.rasgos || []).map((trait) => (
                      <div
                        key={trait.id}
                        className="rounded border border-slate-200 bg-white/70 px-3 py-2"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
                            {group.nombre}
                          </span>
                          <strong className="theme-sheet-copy-strong font-semibold">
                            {trait.nombre}
                          </strong>
                        </div>
                        <WikiText text={trait.descripcion} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  function renderAssetSearchPanel({
    type,
    title,
    query,
    onQueryChange,
    results,
    isLoadingResults,
  }) {
    const isPower = type === 'power'
    const selectedIds = isPower
      ? selectedLinkedPowerIds
      : selectedLinkedObjectIds
    const onAdd = isPower ? addPowerToDraft : addObjectToDraft

    return (
      <div className="theme-sheet-card border p-4">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
          {title}
        </p>
        <label className="mt-3 flex items-center gap-2 border border-slate-200 bg-white px-3 py-2 focus-within:border-brand">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none"
            placeholder={isPower ? 'Buscar poderes' : 'Buscar objetos'}
          />
        </label>
        <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
          {results.map((item) => {
            const itemId = item.id || item.poderId || item.objetoId
            const alreadyAdded = selectedIds.has(itemId)

            return (
              <button
                key={itemId}
                type="button"
                disabled={alreadyAdded}
                onClick={() => onAdd(item)}
                className="flex items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">
                    {item.nombre}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {alreadyAdded
                      ? 'Ya añadido'
                      : isPower
                        ? 'Poder disponible'
                        : 'Objeto disponible'}
                  </span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            )
          })}
          {isLoadingResults ? (
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs font-semibold text-ink-soft">
              Buscando...
            </p>
          ) : null}
          {!isLoadingResults && !results.length ? (
            <p className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs font-semibold text-ink-soft">
              No hay resultados con visión completa.
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  function renderPowersAndObjectsTab() {
    return (
      <div className="space-y-6" data-editor-anchor="powers-objects-section">
        {isEditing ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {renderAssetSearchPanel({
              type: 'power',
              title: 'Añadir poder',
              query: powerLinkQuery,
              onQueryChange: setPowerLinkQuery,
              results: powerSearchQuery.data || [],
              isLoadingResults: powerSearchQuery.isFetching,
            })}
            {renderAssetSearchPanel({
              type: 'object',
              title: 'Añadir objeto',
              query: objectLinkQuery,
              onQueryChange: setObjectLinkQuery,
              results: objectSearchQuery.data || [],
              isLoadingResults: objectSearchQuery.isFetching,
            })}
          </div>
        ) : null}

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3 border-b border-brand/20 pb-2">
            <h3 className="font-headline text-xl font-black text-ink">
              Poderes
            </h3>
            <span className="font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-muted">
              {linkedPowers.length}
            </span>
          </div>
          {linkedPowers.length ? (
            <div className="grid gap-3">
              {linkedPowers.map((power) =>
                renderLinkedPowerCard(power, { editable: isEditing })
              )}
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-ink-soft">
              Este personaje no tiene poderes asociados visibles.
            </div>
          )}
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3 border-b border-brand/20 pb-2">
            <h3 className="font-headline text-xl font-black text-ink">
              Objetos
            </h3>
            <span className="font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-muted">
              {linkedObjects.length}
            </span>
          </div>
          {linkedObjects.length ? (
            <div className="grid gap-3">
              {linkedObjects.map((object) =>
                renderLinkedObjectCard(object, {
                  editable: isEditing,
                  canToggleDisplay: isEditing || (!isEditing && !createMode),
                })
              )}
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 px-4 py-5 text-sm font-semibold text-ink-soft">
              Este personaje no tiene objetos asociados visibles.
            </div>
          )}
        </section>
      </div>
    )
  }

  function renderObjectBlock({ editable = false } = {}) {
    if (!linkedObjects.length) {
      return null
    }

    return (
      <div className="mt-2 grid gap-3">
        {linkedObjects.map((object) =>
          renderLinkedObjectCard(object, {
            editable,
            compact: false,
            canToggleDisplay: editable || (!isEditing && !createMode),
          })
        )}
      </div>
    )
  }

  function addSpellToDraft(spell) {
    updateDraft((current) => {
      if (
        (current.hechizos || []).some(
          (item) => (item.hechizoId || item.id) === spell.id
        )
      ) {
        return current
      }

      current.hechizos = [
        ...(current.hechizos || []),
        {
          hechizoId: spell.id,
          id: spell.id,
          nombre: spell.nombre,
          nivel: spell.nivel,
          escuela: spell.escuela,
          tipoCasteo: spell.tipoCasteo,
          concentracion: spell.concentracion,
        },
      ]
      const level = Number(spell.nivel || 0)
      current.hechizosSlots = current.hechizosSlots || {}
      for (let slotLevel = 1; slotLevel <= level; slotLevel += 1) {
        if (current.hechizosSlots[slotLevel] === undefined) {
          current.hechizosSlots[slotLevel] = 0
        }
      }
      return current
    })
  }

  function removeSpellFromDraft(spellId) {
    updateDraft((current) => {
      current.hechizos = (current.hechizos || []).filter(
        (spell) => (spell.hechizoId || spell.id) !== spellId
      )
      return current
    })
  }

  function addSpellSlotLevel(level) {
    updateDraft((current) => {
      current.hechizosSlots = current.hechizosSlots || {}
      for (let slotLevel = 1; slotLevel <= level; slotLevel += 1) {
        if (current.hechizosSlots[slotLevel] === undefined) {
          current.hechizosSlots[slotLevel] = 0
        }
      }
      return current
    })
  }

  function updateSpellSlots(level, delta) {
    updateDraft((current) => {
      current.hechizosSlots = current.hechizosSlots || {}
      current.hechizosSlots[level] = Math.max(
        0,
        Number(current.hechizosSlots[level] || 0) + delta
      )
      return current
    })
  }

  function getActionStatsForGroup(group, groupIndex, editable = false) {
    const sourceGroup =
      editable && groupIndex > -1 ? draft?.rasgosAgrupados?.[groupIndex] : group

    return parseActionStatsTrait(getActionStatsTraitEntry(sourceGroup).trait)
  }

  function updateActionStats(groupIndex, nextStats) {
    updateDraft((current) => {
      const group = current.rasgosAgrupados?.[groupIndex]

      if (!group) {
        return current
      }

      ensureActionStatsTraitInGroup(group)
      const entry = getActionStatsTraitEntry(group)
      const trait =
        entry.traitIndex > -1
          ? group.rasgos[entry.traitIndex]
          : createDefaultActionStatsTrait()

      if (entry.traitIndex < 0) {
        group.rasgos.unshift(trait)
      }

      trait.nombre = ACTION_STATS_TRAIT_NAME
      trait.descripcion = serializeActionStats(nextStats)
      trait.esReutilizable = false
      trait.esActionStats = true

      return current
    })
  }

  function updateActionStatValue(
    groupIndex,
    stats,
    field,
    value,
    valueIndex = 0
  ) {
    const nextStats = {
      ...stats,
      [field.key]: field.multiple ? [...(stats[field.key] || [''])] : value,
    }

    if (field.multiple) {
      nextStats[field.key][valueIndex] = value
    }

    updateActionStats(groupIndex, nextStats)
  }

  function addActionStatValue(groupIndex, stats, field) {
    updateActionStats(groupIndex, {
      ...stats,
      [field.key]: [...(stats[field.key] || ['']), ''],
    })
  }

  function removeActionStatValue(groupIndex, stats, field, valueIndex) {
    const values = [...(stats[field.key] || [''])]
    values.splice(valueIndex, 1)
    updateActionStats(groupIndex, {
      ...stats,
      [field.key]: values.length ? values : [''],
    })
  }

  function getActionStatPlaceholder(field) {
    if (field.key === 'cantidadAtaques') {
      return '2'
    }

    if (field.key === 'cd') {
      return '15'
    }

    return '8'
  }

  function renderActionStatInput({
    field,
    groupIndex,
    stats,
    value,
    valueIndex,
    values,
  }) {
    return (
      <div
        key={`${field.key}-${valueIndex}`}
        className={clsx(
          'grid gap-2',
          field.signed
            ? 'grid-cols-[auto_minmax(0,1fr)_auto]'
            : 'grid-cols-[minmax(0,1fr)_auto]'
        )}
      >
        {field.signed ? (
          <span className="action-stat-prefix inline-flex h-9 w-8 items-center justify-center border border-slate-200 bg-slate-50 text-sm font-black text-brand">
            +
          </span>
        ) : null}
        <input
          value={value}
          onChange={(event) =>
            updateActionStatValue(
              groupIndex,
              stats,
              field,
              event.target.value,
              valueIndex
            )
          }
          className="w-full min-w-0 border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-brand"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={getActionStatPlaceholder(field)}
        />
        {field.multiple && values.length > 1 ? (
          <button
            type="button"
            onClick={() =>
              removeActionStatValue(groupIndex, stats, field, valueIndex)
            }
            className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-red-700"
            aria-label={`Quitar ${field.label}`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    )
  }

  function renderActionStatsBlock({ group, groupIndex, editable }) {
    const stats = getActionStatsForGroup(group, groupIndex, editable)
    const visibleStats = getVisibleActionStats(stats)

    if (!editable && !visibleStats.length) {
      return null
    }

    return (
      <div className="action-stats-block theme-sheet-soft border p-2.5 sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
              Ataques, Daños y CD
            </p>
            {editable ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Estos valores se pueden insertar en cualquier rasgo escribiendo
                {' {'}.
              </p>
            ) : null}
          </div>
        </div>

        {visibleStats.length ? (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleStats.map((field) => (
              <div
                key={field.key}
                className="action-stat-pill grid min-w-0 gap-0.5 border px-2.5 py-2"
              >
                <span className="min-w-0 break-words font-label text-[8px] font-black uppercase tracking-[0.13em] text-slate-500 [overflow-wrap:anywhere]">
                  {field.label}
                </span>
                <span className="min-w-0 break-words text-base font-black leading-none text-slate-950 [overflow-wrap:anywhere]">
                  {field.value}
                </span>
              </div>
            ))}
          </div>
        ) : editable ? (
          <p className="mt-3 border border-dashed border-slate-300 px-3 py-3 text-xs font-semibold text-slate-500">
            Rellena solo los valores que quieras mostrar en la ficha.
          </p>
        ) : null}

        {editable ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {actionStatFields.map((field) => {
              const values = field.multiple
                ? stats[field.key]?.length
                  ? stats[field.key]
                  : ['']
                : [stats[field.key] || '']

              return (
                <div
                  key={field.key}
                  className="action-stat-editor grid gap-2 border border-slate-200 bg-white/70 p-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="font-label text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
                      {field.label}
                    </label>
                    {field.multiple ? (
                      <button
                        type="button"
                        onClick={() =>
                          addActionStatValue(groupIndex, stats, field)
                        }
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-700 transition hover:border-brand hover:text-brand"
                        aria-label={`Anadir ${field.label}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    {values.map((value, valueIndex) =>
                      renderActionStatInput({
                        field,
                        groupIndex,
                        stats,
                        value,
                        valueIndex,
                        values,
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }

  function getSpellActionStatLabel(token) {
    if (token.key === 'ataqueMagico') {
      return 'Ataque mágico'
    }

    if (token.key === 'danoMagico') {
      return 'Daño mágico'
    }

    return token.label
  }

  function renderSpellActionStatsSummary() {
    if (!spellActionInlineTokens.length) {
      return null
    }

    return (
      <div className="spell-action-stats grid grid-cols-1 gap-1.5 border px-2 py-2 sm:grid-cols-3">
        {spellActionInlineTokens.map((token) => (
          <div
            key={token.key}
            className="spell-action-stat-pill grid min-w-0 gap-0.5 border px-2 py-1.5"
          >
            <span className="min-w-0 break-words font-label text-[7px] font-black uppercase tracking-[0.12em] text-slate-500 [overflow-wrap:anywhere]">
              {getSpellActionStatLabel(token)}
            </span>
            <span className="min-w-0 break-words text-sm font-black leading-none text-slate-950 [overflow-wrap:anywhere]">
              {token.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  function getSkillTotal(skill) {
    if (skill.manual !== null && skill.manual !== undefined) {
      return skill.manual
    }

    return getAutoSkillTotal(skill)
  }

  function getAutoSkillTotal(skill) {
    const abilityModifier = getAbilityModifier(currentItem?.[skill.ability])
    const proficiencyBonus = Number(currentItem?.bonificadorCompetencia || 0)

    return clampSkillTotal(
      (abilityModifier || 0) + proficiencyBonus * Number(skill.multiplier)
    )
  }

  function clampSkillTotal(value) {
    const numeric = Number(value)

    if (!Number.isFinite(numeric)) {
      return 0
    }

    return Math.min(
      Math.max(Math.trunc(numeric), -SKILL_TOTAL_LIMIT),
      SKILL_TOTAL_LIMIT
    )
  }

  function getSkillRowKey(trait, traitIndex) {
    return trait.id || trait.clientId || `skill-${traitIndex}`
  }

  function calculateAllSkillTotals(groupIndex) {
    updateDraft((current) => {
      const group = current.rasgosAgrupados?.[groupIndex]

      if (!group) {
        return current
      }

      group.rasgos = group.rasgos.map((trait) => {
        const skill = parseSkillTrait(trait)
        return {
          ...trait,
          descripcion: serializeSkillDescription({
            ...skill,
            manual: getAutoSkillTotal(skill),
          }),
        }
      })

      return current
    })
    setSkillManualInputs((current) => {
      const next = { ...current }

      for (const key of Object.keys(next)) {
        if (key.startsWith(`${groupIndex}:`)) {
          delete next[key]
        }
      }

      return next
    })
  }

  function updateSkillTrait(groupIndex, traitIndex, patch) {
    updateDraft((current) => {
      const trait = current.rasgosAgrupados?.[groupIndex]?.rasgos?.[traitIndex]

      if (!trait) {
        return current
      }

      const nextSkill = {
        ...parseSkillTrait(trait),
        ...patch,
      }

      trait.nombre = nextSkill.nombre
      trait.descripcion = serializeSkillDescription(nextSkill)
      trait.esReutilizable = false

      return current
    })
  }

  function addCustomSkill(groupIndex) {
    updateDraft((current) => {
      const group = current.rasgosAgrupados?.[groupIndex]

      if (!group) {
        return current
      }

      group.rasgos.push(
        createSkillTrait({
          nombre: 'Nueva habilidad',
          ability: 'fuerza',
          custom: true,
        })
      )

      return current
    })
  }

  function parseManualSkillInput(value) {
    const normalized = String(value || '')
      .replace(/[^\d-]/gu, '')
      .replace(/(?!^)-/gu, '')

    if (!normalized || normalized === '-') {
      return null
    }

    const numeric = Number(normalized)
    return Number.isFinite(numeric) ? clampSkillTotal(numeric) : null
  }

  function getManualSkillDisplayValue(value) {
    const cleaned = String(value || '').replace(/[^\d+-]/gu, '')

    if (!cleaned || cleaned === '-' || cleaned === '+') {
      return cleaned
    }

    const nextManual = parseManualSkillInput(cleaned)

    return nextManual === null ? cleaned : formatModifier(nextManual)
  }

  function updateSkillMultiplier(groupIndex, traitIndex, nextMultiplier) {
    updateSkillTrait(groupIndex, traitIndex, {
      multiplier: Math.min(Math.max(Number(nextMultiplier) || 0, 0), 10),
    })
  }

  function getSkillTableCollapseKey(group) {
    return `${activeCharacterKey}:${group?.id || group?.tipoRasgoId || 'habilidades'}`
  }

  function toggleSkillTable(group) {
    const collapseKey = getSkillTableCollapseKey(group)

    setCollapsedSkillTables((current) => ({
      ...current,
      [collapseKey]: !current[collapseKey],
    }))
  }

  function renderSkillBlock({ group, groupIndex, editable }) {
    const traits =
      editable && groupIndex > -1
        ? draft?.rasgosAgrupados?.[groupIndex]?.rasgos || []
        : group.rasgos || []

    const rows = traits.map((trait, traitIndex) => ({
      trait,
      traitIndex,
      skill: parseSkillTrait(trait),
    }))
    const isCollapsed = Boolean(
      collapsedSkillTables[getSkillTableCollapseKey(group)]
    )

    return (
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => toggleSkillTable(group)}
          className="theme-sheet-soft inline-flex items-center justify-between gap-3 border px-4 py-3 text-left font-label text-[10px] font-black uppercase tracking-[0.18em] transition hover:border-brand/30 hover:bg-brand/5"
          aria-expanded={!isCollapsed}
        >
          <span>
            {isCollapsed ? 'Mostrar tabla' : 'Plegar tabla'} · {rows.length}{' '}
            habilidades
          </span>
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronUp className="h-4 w-4 shrink-0" />
          )}
        </button>

        {!isCollapsed ? (
          <>
            <div
              className={clsx(
                'skill-table-adaptive overflow-hidden border border-slate-200 bg-white',
                !editable && 'skill-table-adaptive--compact'
              )}
            >
              <div className="skill-table-header gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                <span className="whitespace-nowrap">Habilidad</span>
                <span className="whitespace-nowrap" title="Característica">
                  Carac.
                </span>
                <span className="whitespace-nowrap">Comp.</span>
                <span className="whitespace-nowrap">Total</span>
                <span className="sr-only">Acción</span>
              </div>

              <div className="skill-table-rows">
                {rows.map(({ trait, traitIndex, skill }) => {
                  const ability = getSkillAbilityOption(skill.ability)
                  const total = getSkillTotal(skill)
                  const rowKey = getSkillRowKey(trait, traitIndex)
                  const manualInputKey = `${groupIndex}:${rowKey}`

                  return (
                    <div key={rowKey} className="skill-table-row">
                      <label className="skill-table-name block min-w-0">
                        <span className="sr-only">Habilidad</span>
                        {editable && skill.custom ? (
                          <input
                            value={skill.nombre}
                            onChange={(event) =>
                              updateSkillTrait(groupIndex, traitIndex, {
                                nombre: event.target.value,
                                custom: true,
                              })
                            }
                            className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-brand"
                            placeholder="Nombre de la habilidad"
                          />
                        ) : (
                          <span className="skill-table-name-text">
                            {skill.nombre}
                          </span>
                        )}
                      </label>

                      <label className="skill-table-ability block min-w-0">
                        <span className="sr-only">Característica</span>
                        {editable && skill.custom ? (
                          <select
                            value={skill.ability}
                            onChange={(event) =>
                              updateSkillTrait(groupIndex, traitIndex, {
                                ability: event.target.value,
                                custom: true,
                              })
                            }
                            className="w-full border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-800 outline-none focus:border-brand"
                          >
                            {skillAbilityOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.shortLabel}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="skill-ability-chip"
                            title={ability.label}
                          >
                            {ability.shortLabel}
                          </span>
                        )}
                      </label>

                      {editable || skill.multiplier > 0 ? (
                        <div className="skill-table-proficiency grid min-w-0 gap-1">
                          {editable ? (
                            <>
                              <label
                                className="skill-proficiency-chip"
                                title="Competencia"
                              >
                                <input
                                  type="checkbox"
                                  checked={skill.multiplier > 0}
                                  onChange={(event) =>
                                    updateSkillMultiplier(
                                      groupIndex,
                                      traitIndex,
                                      event.target.checked ? 1 : 0
                                    )
                                  }
                                  className="h-3.5 w-3.5 border-slate-300 text-brand focus:ring-brand"
                                />
                                Comp
                              </label>

                              {skill.multiplier > 0 ? (
                                <div className="flex flex-nowrap items-center gap-1">
                                  <label
                                    className="skill-proficiency-chip"
                                    title="Pericia"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={skill.multiplier > 1}
                                      onChange={(event) =>
                                        updateSkillMultiplier(
                                          groupIndex,
                                          traitIndex,
                                          event.target.checked ? 2 : 1
                                        )
                                      }
                                      className="h-3.5 w-3.5 border-slate-300 text-brand focus:ring-brand"
                                    />
                                    Per
                                  </label>

                                  {skill.multiplier > 1 ? (
                                    <div className="inline-flex h-7 shrink-0 items-center overflow-hidden rounded-md border border-slate-200 bg-white text-xs font-black text-slate-700 shadow-sm">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateSkillMultiplier(
                                            groupIndex,
                                            traitIndex,
                                            Math.max(skill.multiplier - 1, 2)
                                          )
                                        }
                                        className="inline-flex h-full w-6 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-brand"
                                        aria-label="Restar pericia"
                                      >
                                        -
                                      </button>
                                      <span className="min-w-7 px-1 text-center text-brand">
                                        x{skill.multiplier}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateSkillMultiplier(
                                            groupIndex,
                                            traitIndex,
                                            Math.min(skill.multiplier + 1, 10)
                                          )
                                        }
                                        className="inline-flex h-full w-6 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-brand"
                                        aria-label="Sumar pericia"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="grid min-w-0 gap-1">
                              {skill.multiplier > 0 ? (
                                <span className="skill-proficiency-chip bg-slate-50">
                                  Comp
                                </span>
                              ) : null}
                              {skill.multiplier > 1 ? (
                                <div className="flex flex-nowrap items-center gap-1">
                                  <span className="skill-proficiency-chip bg-slate-50">
                                    Per
                                  </span>
                                  <span className="inline-flex h-7 shrink-0 items-center rounded-md border border-brand/30 bg-brand/10 px-2 text-xs font-black text-brand">
                                    x{skill.multiplier}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ) : null}

                      <label className="skill-table-total block">
                        <span className="sr-only">Total</span>
                        {editable ? (
                          <input
                            value={
                              Object.prototype.hasOwnProperty.call(
                                skillManualInputs,
                                manualInputKey
                              )
                                ? skillManualInputs[manualInputKey]
                                : formatModifier(skill.manual ?? total)
                            }
                            onChange={(event) => {
                              const nextValue = event.target.value
                              const nextManual =
                                parseManualSkillInput(nextValue)
                              const nextDisplayValue =
                                getManualSkillDisplayValue(nextValue)
                              setSkillManualInputs((current) => ({
                                ...current,
                                [manualInputKey]: nextDisplayValue,
                              }))
                              updateSkillTrait(groupIndex, traitIndex, {
                                manual: nextManual,
                              })
                            }}
                            onBlur={() =>
                              setSkillManualInputs((current) => {
                                const next = { ...current }
                                delete next[manualInputKey]
                                return next
                              })
                            }
                            className="skill-total-input"
                            inputMode="numeric"
                          />
                        ) : (
                          <span className="skill-total-badge">
                            {formatModifier(total)}
                          </span>
                        )}
                      </label>

                      <div className="skill-table-action flex items-center justify-end gap-3">
                        {editable && skill.custom ? (
                          <button
                            type="button"
                            onClick={() =>
                              confirmTraitDelete(groupIndex, traitIndex)
                            }
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-white text-red-700"
                            aria-label={`Eliminar habilidad ${skill.nombre}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {editable ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => calculateAllSkillTotals(groupIndex)}
                  className="theme-sheet-soft inline-flex items-center justify-center gap-2 border px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.18em] transition hover:border-brand/30 hover:bg-brand/5"
                >
                  Calcular automáticamente
                </button>

                <button
                  type="button"
                  onClick={() => addCustomSkill(groupIndex)}
                  className="theme-sheet-soft inline-flex items-center justify-center gap-2 border px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.18em] transition hover:border-brand/30 hover:bg-brand/5"
                >
                  <Plus className="h-4 w-4" />
                  Añadir otra habilidad
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    )
  }

  function selectMobileTraitGroupByOffset(offset) {
    if (!mobileTraitGroups.length) {
      return
    }

    const currentIndex =
      selectedMobileTraitGroupIndex > -1 ? selectedMobileTraitGroupIndex : 0
    const nextIndex =
      (currentIndex + offset + mobileTraitGroups.length) %
      mobileTraitGroups.length

    setMobileTraitGroupId(mobileTraitGroups[nextIndex].id)
  }

  function getTraitGroupCollapseKey(group) {
    return String(group?.id || group?.tipoRasgoId || group?.nombre || 'rasgos')
  }

  function toggleTraitGroupCollapse(group) {
    const collapseKey = getTraitGroupCollapseKey(group)

    setCollapsedTraitGroups((current) => ({
      ...current,
      [collapseKey]: !current[collapseKey],
    }))
  }

  function renderTraitDescription(trait) {
    const startsWithLineBreak = /^[\t ]*\r?\n/u.test(trait.descripcion || '')

    return (
      <>
        <strong className="theme-sheet-copy-strong font-semibold">
          -{trait.nombre}:
        </strong>
        {startsWithLineBreak ? null : ' '}
        <WikiText
          text={trait.descripcion}
          inlineTokens={characterInlineTokens}
        />
      </>
    )
  }

  function renderTraitGroupSection(group) {
    const groupIndex = draft?.rasgosAgrupados?.findIndex(
      (item) => item.tipoRasgoId === group.tipoRasgoId
    )
    const isActionGroup = isActionTraitGroupName(group.nombre)
    const traitEntries = (group.rasgos || [])
      .map((trait, traitIndex) => ({ trait, traitIndex }))
      .filter(({ trait }) => !isActionStatsTrait(trait))
    const hasActionStats = isActionGroup
      ? getVisibleActionStats(
          getActionStatsForGroup(group, groupIndex, isEditing)
        ).length > 0
      : false
    const collapseKey = getTraitGroupCollapseKey(group)
    const isCollapsed = Boolean(collapsedTraitGroups[collapseKey])

    if (
      !isEditing &&
      isActionGroup &&
      !hasActionStats &&
      traitEntries.length === 0
    ) {
      return null
    }

    return (
      <section
        key={group.id || group.tipoRasgoId || group.nombre}
        className="pt-5"
      >
        <div
          className={clsx(
            'character-trait-group-heading flex items-center justify-between gap-3 border-b-2 pb-1',
            isCollapsed ? 'mb-0' : 'mb-3'
          )}
        >
          <button
            type="button"
            onClick={() => toggleTraitGroupCollapse(group)}
            className="group flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={!isCollapsed}
          >
            <ChevronDown
              className={clsx(
                'character-trait-group-icon h-4 w-4 shrink-0 transition-transform duration-200',
                isCollapsed && '-rotate-90'
              )}
              aria-hidden="true"
            />
            <h3 className="theme-sheet-heading break-words font-headline text-[0.88rem] font-black uppercase tracking-[0.08em] [overflow-wrap:anywhere] sm:text-[1rem] sm:tracking-[0.1em] md:text-[1.12rem] md:tracking-[0.11em] xl:text-[1.22rem] xl:tracking-[0.12em]">
              {group.displayName || group.nombre}
            </h3>
          </button>

          {isEditing &&
          groupIndex > -1 &&
          !isObjectTraitGroupName(group.nombre) ? (
            <div className="flex gap-2">
              {!isSkillTraitGroupName(group.nombre) ? (
                <button
                  type="button"
                  onClick={() => addTraitToGroup(groupIndex)}
                  className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 bg-white text-slate-700"
                  aria-label="Añadir rasgo"
                >
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => removeTraitGroup(groupIndex)}
                className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 bg-white text-red-700"
                aria-label="Eliminar tipo de rasgo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {!isCollapsed ? (
          <div className="theme-sheet-copy space-y-3 break-words text-[0.86rem] leading-6 [overflow-wrap:anywhere] sm:text-[0.9rem] sm:leading-7 md:text-[0.96rem] md:leading-8">
            {isActionGroup
              ? renderActionStatsBlock({
                  group,
                  groupIndex,
                  editable: isEditing && groupIndex > -1,
                })
              : null}

            {!isSkillTraitGroupName(group.nombre) &&
            !isObjectTraitGroupName(group.nombre)
              ? traitEntries.map(({ trait, traitIndex }, visibleTraitIndex) =>
                  isEditing &&
                  groupIndex > -1 &&
                  !trait.esRasgoObjetoDinamico ? (
                    <div
                      key={`${group.id}-${trait.id || trait.clientId || traitIndex}`}
                      className="theme-sheet-card border p-3"
                    >
                      {isObjectDerivedTrait(trait) ? (
                        <p className="mb-2 font-label text-[9px] font-black uppercase tracking-[0.16em] text-brand">
                          Copia editable de {trait.objetoNombre || 'objeto'}
                        </p>
                      ) : null}
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <input
                          value={
                            draft?.rasgosAgrupados?.[groupIndex]?.rasgos?.[
                              traitIndex
                            ]?.nombre || ''
                          }
                          onChange={(event) =>
                            updateTrait(
                              groupIndex,
                              traitIndex,
                              'nombre',
                              event.target.value
                            )
                          }
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-brand"
                          placeholder="Nombre del rasgo"
                        />
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const previousTraitIndex =
                                traitEntries[visibleTraitIndex - 1]?.traitIndex

                              if (previousTraitIndex !== undefined) {
                                moveTraitWithinGroup(
                                  groupIndex,
                                  traitIndex,
                                  previousTraitIndex - traitIndex
                                )
                              }
                            }}
                            disabled={visibleTraitIndex === 0}
                            className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Subir rasgo"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextTraitIndex =
                                traitEntries[visibleTraitIndex + 1]?.traitIndex

                              if (nextTraitIndex !== undefined) {
                                moveTraitWithinGroup(
                                  groupIndex,
                                  traitIndex,
                                  nextTraitIndex - traitIndex
                                )
                              }
                            }}
                            disabled={
                              visibleTraitIndex >= traitEntries.length - 1
                            }
                            className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Bajar rasgo"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          {!isObjectDerivedTrait(trait) ? (
                            <button
                              type="button"
                              onClick={() =>
                                confirmTraitDelete(groupIndex, traitIndex)
                              }
                              className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-red-700"
                              aria-label="Eliminar rasgo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mb-2 grid gap-2 sm:grid-cols-2">
                        <label className="block">
                          <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Tipo
                          </span>
                          <select
                            value={group.tipoRasgoId}
                            disabled={isObjectDerivedTrait(trait)}
                            onChange={(event) =>
                              moveTraitToGroup(
                                groupIndex,
                                traitIndex,
                                event.target.value
                              )
                            }
                            className="mt-1 w-full border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {editorMeta?.tiposRasgo?.map((traitType) => (
                              <option key={traitType.id} value={traitType.id}>
                                {traitType.nombre}
                              </option>
                            ))}
                          </select>
                        </label>

                        {canManageSavedTraits &&
                        !isObjectDerivedTrait(trait) ? (
                          <label className="flex items-end gap-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            <input
                              type="checkbox"
                              checked={Boolean(
                                draft?.rasgosAgrupados?.[groupIndex]?.rasgos?.[
                                  traitIndex
                                ]?.esReutilizable
                              )}
                              onChange={(event) =>
                                updateTrait(
                                  groupIndex,
                                  traitIndex,
                                  'esReutilizable',
                                  event.target.checked
                                )
                              }
                              className="h-4 w-4 border-slate-300 text-brand focus:ring-brand"
                            />
                            Guardar rasgo
                          </label>
                        ) : null}
                      </div>
                      <WikiTextArea
                        rows={4}
                        value={
                          draft?.rasgosAgrupados?.[groupIndex]?.rasgos?.[
                            traitIndex
                          ]?.descripcion || ''
                        }
                        onChange={(event) =>
                          updateTrait(
                            groupIndex,
                            traitIndex,
                            'descripcion',
                            event.target.value
                          )
                        }
                        inlineTokens={characterInlineTokens}
                        inlineTokenHelp="En rasgos de personaje, escribe { para insertar datos de la ficha, habilidades o ataques definidos."
                        className="w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand"
                        placeholder="Descripcion del rasgo"
                      />
                    </div>
                  ) : (
                    <p
                      key={trait.id}
                      className="break-words [overflow-wrap:anywhere]"
                    >
                      {renderTraitDescription(trait)}
                    </p>
                  )
                )
              : null}

            {isEditing &&
            groupIndex > -1 &&
            !isSpellTraitGroupName(group.nombre) &&
            !isSkillTraitGroupName(group.nombre) &&
            !isObjectTraitGroupName(group.nombre) ? (
              <button
                type="button"
                onClick={() => addTraitToGroup(groupIndex)}
                className="theme-sheet-soft mt-1 inline-flex items-center justify-center gap-2 border px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.18em] transition hover:border-brand/30 hover:bg-brand/5"
              >
                <Plus className="h-4 w-4" />
                Añadir rasgo
              </button>
            ) : null}

            {isSpellTraitGroupName(group.nombre)
              ? renderSpellBlock({ editable: isEditing })
              : null}

            {isSkillTraitGroupName(group.nombre)
              ? renderSkillBlock({ group, groupIndex, editable: isEditing })
              : null}

            {isObjectTraitGroupName(group.nombre)
              ? renderObjectBlock({ editable: isEditing })
              : null}

            {isEditing &&
            groupIndex > -1 &&
            !isSpellTraitGroupName(group.nombre) &&
            !isSkillTraitGroupName(group.nombre) &&
            !isObjectTraitGroupName(group.nombre) &&
            !traitEntries.length ? (
              <div className="border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                Este tipo aun no tiene rasgos. Usa el boton + para anadir el
                primero.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    )
  }

  function renderSpellBlock({ editable = false } = {}) {
    const shouldShowSpellActionStats =
      !editable && spellActionInlineTokens.length > 0

    if (!editable && !hasDynamicSpellContent && !shouldShowSpellActionStats) {
      return null
    }

    return (
      <div className="mt-2 space-y-3">
        {shouldShowSpellActionStats ? renderSpellActionStatsSummary() : null}

        {groupedCharacterSpells.length ? (
          <div className="grid gap-2">
            {groupedCharacterSpells.map((group, groupIndex) => (
              <p key={group.level} className="text-[0.86rem] leading-6">
                <strong className="theme-sheet-copy-strong font-semibold">
                  -{group.label}
                  {group.level > 0 ? `(${group.slots || 0})` : ''}:
                </strong>{' '}
                {editable && group.level > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => updateSpellSlots(group.level, 1)}
                      className="mx-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-stroke text-[10px] font-black text-ink-soft transition hover:border-brand hover:text-brand"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSpellSlots(group.level, -1)}
                      className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-stroke text-[10px] font-black text-ink-soft transition hover:border-danger hover:text-danger"
                    >
                      -
                    </button>
                  </>
                ) : null}
                <span className="break-words align-baseline">
                  {group.spells.map((spell, spellIndex) => (
                    <span key={spell.id} className="inline">
                      {spellIndex > 0 ? (
                        <span className="mx-1 text-inherit">|</span>
                      ) : null}
                      <a
                        href={`/app/poderes/hechizos/${spell.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-inherit underline-offset-4 transition hover:underline"
                      >
                        {spell.nombre}
                      </a>
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => removeSpellFromDraft(spell.id)}
                          className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-red-700"
                          aria-label="Quitar hechizo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                  {editable &&
                  groupIndex === groupedCharacterSpells.length - 1 &&
                  group.level < 10 ? (
                    <button
                      type="button"
                      onClick={() => addSpellSlotLevel(group.level + 1)}
                      className="ml-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-brand"
                    >
                      Añadir NV{group.level + 1}
                    </button>
                  ) : null}
                </span>
              </p>
            ))}
          </div>
        ) : null}
        {!groupedCharacterSpells.length && !shouldShowSpellActionStats ? (
          <p className="mt-2 text-sm text-ink-soft">
            Todavía no hay hechizos asignados a este personaje.
          </p>
        ) : null}

        {objectSpellGroups.length ? (
          <div className="mt-4 grid gap-3 border-t border-brand/15 pt-4">
            {objectSpellGroups.map(({ object, groups }) => (
              <div
                key={object.id || object.objetoId}
                className="rounded-lg border border-slate-200 bg-white/70 px-3 py-3"
              >
                <p className="font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                  Hechizos de objeto · {object.nombre}
                </p>
                <div className="mt-2 grid gap-1">
                  {groups.map((group) => (
                    <p key={group.level} className="text-[0.84rem] leading-6">
                      <strong className="theme-sheet-copy-strong font-semibold">
                        -{group.label}
                        {group.level > 0 ? `(${group.slots || 0})` : ''}:
                      </strong>{' '}
                      {group.spells.length ? (
                        group.spells.map((spell, spellIndex) => (
                          <span key={spell.id} className="inline">
                            {spellIndex > 0 ? (
                              <span className="mx-1 text-inherit">|</span>
                            ) : null}
                            <a
                              href={`/app/poderes/hechizos/${spell.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-inherit underline-offset-4 transition hover:underline"
                            >
                              {spell.nombre}
                            </a>
                          </span>
                        ))
                      ) : (
                        <span className="text-ink-muted">Sin hechizos</span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {editable ? (
          <div className="theme-sheet-card mt-3 grid max-w-full gap-3 border p-3">
            <p className="text-xs font-semibold text-ink-soft">
              Añade hechizos guardados en tu repositorio personal. Los hechizos
              nuevos se crean desde Poderes / Hechizos.
            </p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)_7rem]">
              <input
                value={spellPickerQuery}
                onChange={(event) => setSpellPickerQuery(event.target.value)}
                className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-brand"
                placeholder="Buscar hechizo"
              />
              <select
                value={spellPickerClass}
                onChange={(event) => setSpellPickerClass(event.target.value)}
                className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-brand"
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
                className="border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-brand"
              >
                <option value="">Nivel</option>
                {Array.from({ length: 11 }, (_, index) => (
                  <option key={index} value={index}>
                    {index === 0 ? 'Truco' : `N${index}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid max-h-52 gap-2 overflow-y-auto pr-1">
              {filteredSavedSpells.map((spell) => (
                <button
                  key={spell.id}
                  type="button"
                  disabled={selectedSpellIds.has(spell.id)}
                  onClick={() => addSpellToDraft(spell)}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-45"
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
                <p className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-xs font-semibold text-ink-soft">
                  No hay hechizos que coincidan con esos filtros.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const selectedGalleryImage = getSelectedGalleryImage(
    galleryImages,
    selectedGalleryImageState,
    activeCharacterKey
  )
  const selectedGalleryIndex = galleryImages.findIndex(
    (image) => image.imagenUrl === selectedGalleryImage
  )

  const visibleVersions = useMemo(() => {
    if (createMode) {
      return []
    }

    const responseItem = versionsResponse?.item
    const related = versionsResponse?.versiones
    const rootCharacterId =
      related?.personajeBase?.id ||
      responseItem?.personajeBaseId ||
      currentItem?.personajeBaseId ||
      responseItem?.id ||
      currentItem?.id

    const items = [
      related?.personajeBase || null,
      responseItem || currentItem || null,
      ...(related?.versionesDerivadas || []),
      ...(related?.versionesHermana || []),
    ].filter(Boolean)

    const seen = new Set()

    return items
      .map((item) =>
        item.id === currentItem?.id
          ? {
              ...item,
              nombre: currentItem.nombre,
              titulo: currentItem.titulo,
              personajeBaseId: currentItem.personajeBaseId,
              creadoEn: item.creadoEn || currentItem.creadoEn,
            }
          : item
      )
      .filter((item) => {
        if (!item?.id || seen.has(item.id)) {
          return false
        }

        seen.add(item.id)
        return true
      })
      .sort((left, right) => {
        if (left.id === rootCharacterId) return -1
        if (right.id === rootCharacterId) return 1

        return (
          new Date(left.creadoEn || 0).getTime() -
          new Date(right.creadoEn || 0).getTime()
        )
      })
  }, [createMode, currentItem, versionsResponse])

  const returnTo = location.state?.returnTo || null
  const isPreviewMode = currentItem?.modoVista === 'preview'
  const deleteCharacterMutation = useMutation({
    onMutate: async () => {
      if (!characterId) {
        return
      }

      setDeletingCharacterId(characterId)

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['character', characterId] }),
        queryClient.cancelQueries({
          queryKey: ['character-editor', characterId],
        }),
        queryClient.cancelQueries({
          queryKey: ['character-versions', characterId],
        }),
      ])
    },
    mutationFn: async () => {
      if (!characterId) {
        throw new Error('No se encontro el personaje a eliminar.')
      }

      await deleteCharacter(characterId)
    },
    onError: () => {
      setDeletingCharacterId(null)
    },
    onSuccess: async () => {
      const deletedCharacterId = characterId

      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ['character', deletedCharacterId],
        }),
        queryClient.cancelQueries({
          queryKey: ['character-editor', deletedCharacterId],
        }),
        queryClient.cancelQueries({
          queryKey: ['character-versions', deletedCharacterId],
        }),
      ])

      queryClient.removeQueries({ queryKey: ['character', deletedCharacterId] })
      queryClient.removeQueries({
        queryKey: ['character-editor', deletedCharacterId],
      })
      queryClient.removeQueries({
        queryKey: ['character-versions', deletedCharacterId],
      })
      queryClient.invalidateQueries({ queryKey: ['characters', 'recent'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-characters'] })
      discardEditing(visibleVersions.map((version) => version.id))
      setIsCharacterDeleteOpen(false)
      setCharacterDeleteText('')

      if (returnTo?.pathname) {
        navigate(returnTo.pathname, {
          state: {
            restoreScrollY: returnTo.scrollY || 0,
          },
          replace: true,
        })
        return
      }

      navigate('/app', { replace: true })
    },
  })

  function handleReturnToOrigin() {
    discardEditing(visibleVersions.map((version) => version.id))

    if (returnTo?.pathname) {
      navigate(returnTo.pathname, {
        state: {
          restoreScrollY: returnTo.scrollY || 0,
        },
      })
      return
    }

    navigate('/app')
  }

  function handleDiscardCreation() {
    discardEditing([])
    navigate('/app')
  }

  function handleCloseCharacterDelete() {
    if (deleteCharacterMutation.isPending) {
      return
    }

    setIsCharacterDeleteOpen(false)
    setCharacterDeleteText('')
    deleteCharacterMutation.reset()
  }

  if ((!createMode && isLoading) || (createMode && isEditorLoading)) {
    return <CharacterDetailLoading />
  }

  if (
    (!createMode && (isError || !data)) ||
    (createMode && isEditorError) ||
    !currentItem
  ) {
    return <CharacterDetailError />
  }

  return (
    <section className="grid gap-6">
      {isEditing ? (
        <input
          ref={mainImageInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_INPUT_TYPES}
          onChange={handleMainImageUpload}
          className="hidden"
        />
      ) : null}
      <article className="entity-sheet entity-sheet--character theme-sheet-shell shadow-card">
        <CharacterSheetHeader
          tabs={tabs}
          activeTab={activeTab}
          characterId={activeCharacterKey}
          characterName={
            createMode
              ? currentItem.nombre?.trim() || 'Nuevo personaje'
              : currentItem.nombre
          }
          onTabChange={handleCharacterTabChange}
          onBack={handleReturnToOrigin}
        />
        <div className="mx-auto w-full max-w-[84rem] px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-8 xl:px-6">
          {!createMode ? (
            <div className="mb-3 flex justify-end gap-2">
              <FavoriteStarButton
                entityType="character"
                entityId={currentItem.id}
              />
              {(data?.puedeEditar || currentItem?.puedeEditar) && !isEditing ? (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-white text-ink-soft shadow-card transition hover:border-brand hover:text-brand"
                  aria-label="Editar personaje"
                  title="Editar personaje"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}
          <CharacterVersionButtons
            versions={visibleVersions}
            characterId={characterId}
            locationState={location.state}
            preserveEditor={isEditing}
            onBeforeNavigate={() => {
              if (isEditing) {
                persistCurrentEditorSnapshot(activeTab)
              }
            }}
          />

          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[3rem_minmax(0,1fr)_3rem] lg:gap-3 2xl:grid-cols-[3.25rem_minmax(0,1fr)_3.25rem]">
            {showEditorIndex ? (
              <div className="character-editor-index-shell mb-3 flex justify-center lg:mb-0 lg:block">
                <CharacterEditorIndex
                  tabs={tabs}
                  activeTab={activeTab}
                  characterId={activeCharacterKey}
                  collapsed={isEditorIndexCollapsed}
                  onCollapsedChange={setIsEditorIndexCollapsed}
                  onTabChange={handleCharacterTabChange}
                />
              </div>
            ) : (
              <div className="hidden lg:block" />
            )}

            <div>
              <div
                className={clsx(
                  'theme-sheet-frame mx-auto max-w-[40rem] border px-4 py-5 sm:max-w-[44rem] sm:px-6 sm:py-6 md:max-w-none md:px-8 md:py-8 xl:px-10 xl:py-10',
                  isEditing
                    ? 'border-brand/50 theme-brand-outline-soft'
                    : 'border-slate-200'
                )}
                onFocusCapture={handleEditorFieldFocus}
                onBlurCapture={handleEditorFieldBlur}
              >
                {isEditing ? (
                  <EditorModeBanner
                    canUndo={Boolean(editorHistory.past.length)}
                    canRedo={Boolean(editorHistory.future.length)}
                    onUndo={undoDraft}
                    onRedo={redoDraft}
                  />
                ) : null}

                {activeTab === 'estadisticas' ? (
                  <>
                    {createMode && isEditing ? (
                      <section className="theme-sheet-soft mb-5 border p-4">
                        <label className="block">
                          <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Campaña
                          </span>
                          <select
                            value={draft?.core.campanaId || ''}
                            onChange={(event) =>
                              updateDraftCampaign(event.target.value)
                            }
                            className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                          >
                            {editorMeta?.campanas?.map((campaign) => (
                              <option key={campaign.id} value={campaign.id}>
                                {campaign.nombre}
                              </option>
                            ))}
                          </select>
                        </label>
                      </section>
                    ) : null}

                    <div
                      className="character-stats-header theme-sheet-rule mb-8 flex flex-col items-stretch gap-5 border-b pb-8 lg:flex-row lg:items-start lg:justify-between lg:gap-8 xl:gap-10"
                      data-editor-anchor="stats-header"
                    >
                      <div className="character-identity-block min-w-0 flex-1 pt-1">
                        {isEditing ? (
                          <>
                            <EditableField
                              label="Nombre"
                              value={draft?.core.nombre}
                              onChange={(event) =>
                                updateCoreField(
                                  'nombre',
                                  event.target.value.slice(
                                    0,
                                    CHARACTER_NAME_MAX_LENGTH
                                  ),
                                  'stats-header'
                                )
                              }
                              maxLength={CHARACTER_NAME_MAX_LENGTH}
                              inputClassName="font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl"
                            />
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <EditableField
                                label="Titulo"
                                value={draft?.core.titulo}
                                onChange={(event) =>
                                  updateCoreField(
                                    'titulo',
                                    event.target.value.slice(
                                      0,
                                      CHARACTER_TITLE_MAX_LENGTH
                                    ),
                                    'stats-header'
                                  )
                                }
                                maxLength={CHARACTER_TITLE_MAX_LENGTH}
                              />
                              <div />
                            </div>
                          </>
                        ) : (
                          <>
                            <h2 className="break-words font-headline text-[2rem] font-bold tracking-tight text-slate-900 [overflow-wrap:anywhere] sm:text-[2.35rem] md:text-[2.7rem] xl:text-[3.05rem]">
                              {currentItem.nombre}
                            </h2>

                            <div className="mt-3 flex flex-wrap gap-4">
                              <p className="font-label text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                                Tier Lvl:{' '}
                                <span className="theme-sheet-copy-strong font-normal">
                                  {currentItem.tier?.nombre || '-'}
                                </span>
                              </p>
                              <p className="font-label text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                                Clase:{' '}
                                <span className="theme-sheet-copy-strong break-words font-normal [overflow-wrap:anywhere]">
                                  | {classSummary} |
                                </span>
                              </p>
                            </div>
                          </>
                        )}

                        <div className="character-vitals-grid mt-8 grid grid-cols-2 gap-3 sm:gap-4">
                          {[
                            {
                              label: 'Puntos de Golpe',
                              mobileLabel: 'Golpe',
                              field: 'puntosGolpe',
                              Icon: HeartPulse,
                              iconClass: 'character-vital-icon--health',
                            },
                            {
                              label: 'Clase de Armadura',
                              mobileLabel: 'Armadura',
                              field: 'claseArmadura',
                              Icon: Shield,
                              iconClass: 'character-vital-icon--armor',
                            },
                            {
                              label: 'Movimiento',
                              mobileLabel: 'Mov.',
                              field: 'movimiento',
                              Icon: Footprints,
                              iconClass: 'character-vital-icon--speed',
                            },
                            {
                              label: 'Competencia',
                              mobileLabel: 'Comp.',
                              field: 'bonificadorCompetencia',
                              Icon: Gauge,
                              iconClass: 'character-vital-icon--proficiency',
                            },
                          ].map(
                            ({
                              label,
                              mobileLabel,
                              field,
                              Icon,
                              iconClass,
                            }) => (
                              <div
                                key={field}
                                className="character-vital-card min-w-0 overflow-hidden rounded-xl border px-2.5 py-2.5 shadow-sm sm:px-3 sm:py-3"
                              >
                                <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                                  <span
                                    className={clsx(
                                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border sm:h-9 sm:w-9',
                                      iconClass
                                    )}
                                  >
                                    {createElement(Icon, {
                                      className: 'h-3.5 w-3.5 sm:h-4 sm:w-4',
                                      'aria-hidden': true,
                                    })}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="theme-sheet-copy-strong font-label text-[8px] font-black uppercase leading-3 tracking-[0.08em] sm:text-[10px] sm:leading-4 sm:tracking-[0.12em]">
                                      <span className="sm:hidden">
                                        {mobileLabel}
                                      </span>
                                      <span className="hidden sm:inline">
                                        {label}
                                      </span>
                                    </p>
                                    {isEditing ? (
                                      field === 'movimiento' ? (
                                        <div className="mt-2 grid gap-1.5">
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={
                                              draft?.core.velocidadPies ?? ''
                                            }
                                            onChange={(event) =>
                                              updateCoreField(
                                                'velocidadPies',
                                                sanitizeIntegerInput(
                                                  event.target.value,
                                                  MAX_SHEET_SPEED_INTEGER
                                                ),
                                                'stats-header'
                                              )
                                            }
                                            className="border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-brand"
                                            placeholder="Pies"
                                          />
                                          <p className="font-label text-[9px] font-bold uppercase leading-4 tracking-[0.1em] text-slate-500">
                                            Metros calculados:{' '}
                                            <span className="text-slate-800">
                                              {formatSheetNumber(
                                                getMetersFromFeet(
                                                  draft?.core.velocidadPies
                                                )
                                              )}
                                            </span>
                                          </p>
                                        </div>
                                      ) : (
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          value={draft?.core[field] ?? ''}
                                          onChange={(event) =>
                                            updateCoreField(
                                              field,
                                              sanitizeIntegerInput(
                                                event.target.value,
                                                field ===
                                                  'bonificadorCompetencia'
                                                  ? MAX_SHEET_COMPETENCE
                                                  : MAX_SHEET_GENERAL_INTEGER
                                              ),
                                              'stats-header'
                                            )
                                          }
                                          className="w-full border border-slate-200 bg-white px-3 py-2 text-[1.35rem] text-slate-800 outline-none focus:border-brand"
                                        />
                                      )
                                    ) : (
                                      <p className="theme-sheet-copy-strong mt-1 break-words font-headline text-[1.18rem] font-normal leading-tight [overflow-wrap:anywhere] sm:text-[2.05rem] sm:leading-none">
                                        {field === 'movimiento'
                                          ? getMovementSummary(currentItem)
                                          : field === 'bonificadorCompetencia'
                                            ? formatSheetModifier(
                                                currentItem.bonificadorCompetencia
                                              )
                                            : formatSheetNumber(
                                                currentItem[field]
                                              )}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        <div className="character-secondary-stats theme-sheet-rule mt-10 grid grid-cols-1 gap-x-6 gap-y-2 border-t pt-6 font-headline text-[11px] uppercase tracking-[0.14em] sm:grid-cols-2 lg:flex lg:flex-wrap">
                          {[
                            ['Iniciativa', 'iniciativa', formatSheetModifier],
                            [
                              'Percepcion P',
                              'percepcionPasiva',
                              formatSheetNumber,
                            ],
                            [
                              'Investigacion P',
                              'investigacionPasiva',
                              formatSheetNumber,
                            ],
                            [
                              'Experiencia',
                              'puntosExperiencia',
                              formatSheetNumber,
                            ],
                          ].map(([label, field, formatter]) => {
                            const supportsAutomaticPassive =
                              field === 'percepcionPasiva' ||
                              field === 'investigacionPasiva'
                            const isAutomaticPassive =
                              supportsAutomaticPassive &&
                              draft?.core[field] === null

                            return (
                              <div key={field}>
                                <span className="theme-sheet-copy-strong font-black">
                                  {label}:
                                </span>{' '}
                                {isEditing ? (
                                  <span className="ml-2 inline-flex max-w-full flex-wrap items-center gap-2 align-middle">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={
                                        draft?.core[field] ??
                                        currentItem?.[field] ??
                                        ''
                                      }
                                      disabled={isAutomaticPassive}
                                      onChange={(event) =>
                                        updateCoreField(
                                          field,
                                          sanitizeIntegerInput(
                                            event.target.value,
                                            MAX_SHEET_GENERAL_INTEGER
                                          ),
                                          'stats-header'
                                        )
                                      }
                                      className="w-24 border border-slate-200 bg-white px-2 py-1 text-sm font-normal text-black/90 outline-none focus:border-brand disabled:bg-slate-100 disabled:text-slate-500"
                                    />
                                    {supportsAutomaticPassive ? (
                                      <label className="inline-flex items-center gap-1.5 font-label text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                                        <input
                                          type="checkbox"
                                          checked={isAutomaticPassive}
                                          onChange={(event) =>
                                            updateCoreField(
                                              field,
                                              event.target.checked
                                                ? null
                                                : (currentItem?.[field] ?? 0),
                                              'stats-header'
                                            )
                                          }
                                          className="h-3.5 w-3.5 border-slate-300 text-brand focus:ring-brand"
                                        />
                                        Auto
                                      </label>
                                    ) : null}
                                  </span>
                                ) : (
                                  <span className="theme-sheet-copy-strong font-normal">
                                    {formatter(currentItem[field])}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="character-main-image theme-sheet-image order-first h-64 w-full max-w-[16rem] min-w-0 flex-none self-center overflow-hidden sm:h-72 sm:max-w-[17.9rem] lg:order-none lg:h-[22.75rem] lg:w-[17.9rem] lg:min-w-[17.9rem] lg:self-start">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => mainImageInputRef.current?.click()}
                            disabled={uploadState.gallery}
                            className="group relative block h-full w-full cursor-pointer text-left disabled:cursor-wait"
                            aria-label="Cambiar imagen principal del personaje"
                          >
                            {currentItem.imagenPrincipalUrl ? (
                              <img
                                src={currentItem.imagenPrincipalUrl}
                                alt={currentItem.nombre}
                                className="h-full w-full object-cover"
                                loading="eager"
                                decoding="async"
                              />
                            ) : (
                              <div className="theme-sheet-soft theme-sheet-copy flex h-full w-full items-center justify-center text-[10px]">
                                Sin imagen
                              </div>
                            )}
                            <span className="absolute inset-x-0 bottom-0 bg-black/65 px-3 py-2 text-center font-label text-[9px] font-black uppercase tracking-[0.14em] text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                              {uploadState.gallery
                                ? 'Subiendo...'
                                : 'Cambiar imagen'}
                            </span>
                          </button>
                        ) : currentItem.imagenPrincipalUrl ? (
                          <img
                            src={currentItem.imagenPrincipalUrl}
                            alt={currentItem.nombre}
                            className="h-full w-full object-cover"
                            loading="eager"
                            decoding="async"
                          />
                        ) : (
                          <div className="theme-sheet-soft theme-sheet-copy flex h-full w-full items-center justify-center text-[10px]">
                            Sin imagen
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className="character-ability-panel theme-sheet-soft mb-10 border px-2 py-3 sm:px-6 sm:py-5"
                      data-editor-anchor="ability-grid"
                    >
                      <div className="grid grid-cols-6 gap-1 text-center sm:grid-cols-3 sm:gap-y-5 xl:grid-cols-6">
                        {abilityScoreEntries.map((ability) => (
                          <AbilityScoreBlock
                            key={ability.key}
                            label={ability.label}
                            score={currentItem[ability.key]}
                            savingThrow={getDisplayedSavingThrow(
                              currentItem,
                              ability.key,
                              ability.saveKey
                            )}
                            editMode={isEditing}
                            saveProficient={Boolean(
                              currentItem[
                                getSavingThrowProficiencyKey(ability.key)
                              ]
                            )}
                            onChange={(kind, value) =>
                              updateAbilityField(ability.key, kind, value)
                            }
                            onToggleProficiency={(checked) =>
                              toggleSavingThrowProficiency(ability.key, checked)
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div className="mb-10 text-center">
                      <h2 className="theme-sheet-heading inline-block font-headline text-[1.8rem] font-black uppercase tracking-[0.28em] md:text-[2.35rem]">
                        Rasgos
                      </h2>
                      <div className="theme-sheet-divider mt-5 h-px w-full" />
                    </div>

                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() =>
                          setTraitsToolsOpen((current) => !current)
                        }
                        className="theme-sheet-soft mb-3 flex w-full items-center justify-between gap-3 border px-4 py-3 text-left font-label text-[10px] font-black uppercase tracking-[0.18em] transition hover:border-brand/30 hover:bg-brand/5"
                        aria-expanded={traitsToolsOpen}
                      >
                        <span>Herramientas de rasgos</span>
                        {traitsToolsOpen ? (
                          <ChevronUp className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        )}
                      </button>
                    ) : null}

                    {isEditing ? (
                      <div
                        className={clsx(
                          'theme-sheet-soft mb-6 flex flex-col gap-3 border p-4 md:flex-row md:items-end',
                          !traitsToolsOpen && 'hidden'
                        )}
                        data-editor-anchor="traits-editor"
                      >
                        <label className="block flex-1">
                          <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Añadir tipo de rasgo
                          </span>
                          <select
                            value={newTraitTypeId}
                            onChange={(event) =>
                              setNewTraitTypeId(event.target.value)
                            }
                            className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                          >
                            <option value="">Selecciona un tipo</option>
                            {availableTraitTypes.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.nombre}
                              </option>
                            ))}
                          </select>
                        </label>

                        <button
                          type="button"
                          onClick={addTraitGroup}
                          disabled={!newTraitTypeId}
                          className="theme-solid-button inline-flex items-center justify-center gap-2 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" />
                          Añadir tipo
                        </button>
                      </div>
                    ) : null}

                    {isEditing && canManageSavedTraits ? (
                      <div
                        className={clsx(
                          'theme-sheet-card mb-8 border p-4 shadow-sm',
                          !traitsToolsOpen && 'hidden'
                        )}
                        data-editor-anchor="traits-reusable"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-end">
                          <label className="block flex-1">
                            <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                              Reutilizar rasgos guardados
                            </span>
                            <input
                              value={savedTraitQuery}
                              onChange={(event) =>
                                setSavedTraitQuery(event.target.value)
                              }
                              className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              placeholder="Buscar por nombre, descripción o tipo"
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            ['all', 'Todos'],
                            ['user', 'Usuario'],
                            ['class', 'Clase'],
                            ['feat', 'Dotes'],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setSavedTraitSourceFilter(value)

                                if (value !== 'class') {
                                  setSavedTraitSourceEntityFilter('all')
                                }
                              }}
                              className={clsx(
                                'rounded-md border px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] transition',
                                savedTraitSourceFilter === value
                                  ? 'border-brand bg-brand/15 text-brand'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand/40 hover:text-brand'
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {savedTraitSourceFilter === 'class' ? (
                          <select
                            value={savedTraitSourceEntityFilter}
                            onChange={(event) =>
                              setSavedTraitSourceEntityFilter(
                                event.target.value
                              )
                            }
                            className="mt-3 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                          >
                            <option value="all">
                              Todas las clases y subclases
                            </option>
                            {savedTraitClassSourceOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : null}

                        {!savedTraitQuery && filteredSavedTraits.length ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowRecentSavedTraits((current) => {
                                if (current) {
                                  setShowAllSavedTraits(false)
                                }

                                return !current
                              })
                            }}
                            className="theme-sheet-soft theme-sheet-copy-strong mt-4 w-full border px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] transition hover:border-brand/30 hover:bg-brand/5"
                          >
                            {showRecentSavedTraits
                              ? 'Plegar rasgos guardados'
                              : `Desplegar ultimos ${Math.min(filteredSavedTraits.length, 4)} rasgos`}
                          </button>
                        ) : null}

                        {savedTraitQuery ||
                        savedTraitSourceFilter !== 'all' ||
                        savedTraitSourceEntityFilter !== 'all' ||
                        showRecentSavedTraits ||
                        !filteredSavedTraits.length ? (
                          <>
                            <div className="mt-4 grid gap-2 md:grid-cols-2">
                              {visibleSavedTraits.length ? (
                                visibleSavedTraits.map((trait) => (
                                  <div
                                    key={trait.id}
                                    className="theme-sheet-card relative border pr-10 text-left transition hover:border-brand/40 hover:bg-brand/5"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => deleteSavedTrait(trait.id)}
                                      disabled={
                                        deleteSavedTraitPendingId === trait.id
                                      }
                                      className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                      aria-label="Borrar rasgo guardado"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        addSavedTraitToDraft(trait)
                                      }
                                      className="block w-full px-3 py-2 text-left"
                                    >
                                      <span className="block font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                                        {trait.tipoRasgo?.nombre || 'Rasgo'}
                                      </span>
                                      {trait.origenTipo &&
                                      trait.origenTipo !== 'usuario' ? (
                                        <span className="mt-1 block text-[10px] font-bold text-slate-500">
                                          {trait.origenTipo === 'dote'
                                            ? 'Dote'
                                            : trait.origenTipo === 'subclase'
                                              ? 'Subclase'
                                              : 'Clase'}
                                          {trait.origenEntidadNombre
                                            ? ` · ${trait.origenEntidadNombre}`
                                            : ''}
                                        </span>
                                      ) : null}
                                      <span className="theme-sheet-copy-strong mt-1 block break-words text-sm font-bold [overflow-wrap:anywhere]">
                                        {trait.nombre}
                                      </span>
                                      <span className="theme-sheet-copy mt-1 line-clamp-2 block break-words text-xs leading-5 [overflow-wrap:anywhere]">
                                        <WikiText
                                          text={trait.descripcion}
                                          disableLinks
                                        />
                                      </span>
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm leading-7 text-slate-500">
                                  No hay rasgos guardados que coincidan. Marca
                                  "guardar rasgo" en una ficha propia y confirma
                                  la edicion para reutilizarlo aqui.
                                </p>
                              )}
                            </div>

                            {!savedTraitQuery &&
                            showRecentSavedTraits &&
                            filteredSavedTraits.length > 4 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowAllSavedTraits((current) => !current)
                                }
                                className="theme-sheet-soft theme-sheet-copy-strong mt-4 w-full border px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] transition hover:border-brand/30 hover:bg-brand/5"
                              >
                                {showAllSavedTraits
                                  ? 'Plegar todos los rasgos guardados'
                                  : `Desplegar todos (${filteredSavedTraits.length})`}
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    {mobileTraitGroups.length ? (
                      <div className="theme-sheet-soft mb-5 grid gap-3 border px-3 py-4 lg:hidden">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                              Vista de rasgos
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              Muestra todos los tipos o enfoca uno solo.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setMobileSingleTraitMode((current) => !current)
                            }
                            className={clsx(
                              'shrink-0 rounded-lg border px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] transition',
                              mobileSingleTraitMode
                                ? 'border-brand bg-brand text-black'
                                : 'border-slate-200 bg-white text-slate-600'
                            )}
                          >
                            {mobileSingleTraitMode ? 'Vista normal' : 'Enfocar'}
                          </button>
                        </div>

                        {mobileSingleTraitMode ? (
                          <div className="grid gap-3">
                            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  selectMobileTraitGroupByOffset(-1)
                                }
                                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"
                                aria-label="Tipo de rasgo anterior"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>

                              <select
                                value={selectedMobileTraitGroup?.id || ''}
                                onChange={(event) =>
                                  setMobileTraitGroupId(event.target.value)
                                }
                                className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-3 text-center font-label text-[10px] font-black uppercase tracking-[0.12em] text-slate-800 outline-none focus:border-brand"
                              >
                                {mobileTraitGroups.map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {group.displayName || group.nombre}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() =>
                                  selectMobileTraitGroupByOffset(1)
                                }
                                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"
                                aria-label="Tipo de rasgo siguiente"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>

                            {selectedMobileTraitGroup ? (
                              <p className="text-center text-xs text-slate-500">
                                {selectedMobileTraitGroupIndex + 1} de{' '}
                                {mobileTraitGroups.length}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {mobileSingleTraitMode && selectedMobileTraitGroup ? (
                      <div className="grid gap-4 text-[10px] leading-relaxed sm:text-[11px] lg:hidden">
                        {renderTraitGroupSection(selectedMobileTraitGroup)}
                      </div>
                    ) : null}

                    <div
                      className={clsx(
                        'character-traits-flow text-[10px] leading-relaxed sm:text-[11px]',
                        mobileSingleTraitMode && 'hidden lg:block'
                      )}
                    >
                      {(
                        layout.allGroups || [
                          ...layout.leftGroups,
                          ...layout.rightGroups,
                        ]
                      ).map((group) => renderTraitGroupSection(group))}
                    </div>

                    {shouldRenderStandaloneSpellBlock ? (
                      <div className="mt-8 max-w-3xl">
                        {renderSpellBlock({ editable: isEditing })}
                      </div>
                    ) : null}

                    {isEditing ? (
                      <div
                        className="theme-sheet-soft mt-8 border p-4"
                        data-editor-anchor="class-editor"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h3 className="theme-sheet-heading font-headline text-lg font-bold">
                            Clases
                          </h3>
                          <button
                            type="button"
                            onClick={addClassEntry}
                            className="theme-solid-button inline-flex items-center gap-2 px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em]"
                          >
                            <Plus className="h-4 w-4" />
                            Añadir clase
                          </button>
                        </div>

                        <div className="space-y-3">
                          {draft?.clases?.map((entry, index) => {
                            return (
                              <div
                                key={`clase-editor-${index}`}
                                className="theme-sheet-card grid gap-3 border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto]"
                              >
                                <input
                                  value={entry.claseNombre}
                                  maxLength={CLASS_NAME_MAX_LENGTH}
                                  onChange={(event) =>
                                    updateClassEntry(
                                      index,
                                      'claseNombre',
                                      event.target.value
                                    )
                                  }
                                  className="archive-input rounded-none px-3 py-2"
                                  placeholder="Clase"
                                />

                                <input
                                  value={entry.subclaseNombre || ''}
                                  maxLength={SUBCLASS_NAME_MAX_LENGTH}
                                  onChange={(event) =>
                                    updateClassEntry(
                                      index,
                                      'subclaseNombre',
                                      event.target.value
                                    )
                                  }
                                  className="archive-input rounded-none px-3 py-2"
                                  placeholder="Subclase"
                                />

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={entry.nivelClase ?? ''}
                                  onChange={(event) =>
                                    updateClassEntry(
                                      index,
                                      'nivelClase',
                                      event.target.value
                                    )
                                  }
                                  className="archive-input rounded-none px-3 py-2"
                                  placeholder="Nivel"
                                />

                                <button
                                  type="button"
                                  onClick={() => removeClassEntry(index)}
                                  className="theme-sheet-soft inline-flex items-center justify-center border px-3 py-2 text-danger transition hover:border-danger/40"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )
                          })}

                          {!draft?.clases?.length ? (
                            <div className="theme-sheet-copy rounded-lg border border-dashed border-current/20 px-4 py-4 text-sm">
                              Aun no hay clases registradas en el borrador.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {!isPreviewMode &&
                activeTab !== 'estadisticas' &&
                activeTab !== 'galeria' ? (
                  <div className="mb-8 flex flex-col items-stretch gap-5 border-b border-slate-100 pb-8 lg:flex-row lg:items-start lg:justify-between lg:gap-8 xl:gap-10">
                    <div className="min-w-0 flex-1 pt-1">
                      {isEditing ? (
                        <>
                          <EditableField
                            label="Nombre"
                            value={draft?.core.nombre}
                            onChange={(event) =>
                              updateCoreField(
                                'nombre',
                                event.target.value.slice(
                                  0,
                                  CHARACTER_NAME_MAX_LENGTH
                                )
                              )
                            }
                            maxLength={CHARACTER_NAME_MAX_LENGTH}
                            inputClassName="font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl"
                          />
                          <EditableField
                            label="Titulo"
                            value={draft?.core.titulo}
                            onChange={(event) =>
                              updateCoreField(
                                'titulo',
                                event.target.value.slice(
                                  0,
                                  CHARACTER_TITLE_MAX_LENGTH
                                )
                              )
                            }
                            maxLength={CHARACTER_TITLE_MAX_LENGTH}
                          />
                        </>
                      ) : (
                        <>
                          <h2 className="break-words font-headline text-[2rem] font-bold tracking-tight text-slate-900 [overflow-wrap:anywhere] sm:text-[2.35rem] md:text-[2.7rem] xl:text-[3.05rem]">
                            {currentItem.nombre}
                          </h2>
                          <p className="mt-3 font-label text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                            Clase:{' '}
                            <span className="break-words font-normal text-black/90 [overflow-wrap:anywhere]">
                              | {classSummary} |
                            </span>
                          </p>
                        </>
                      )}
                    </div>

                    <div className="order-first h-64 w-full max-w-[16rem] min-w-0 flex-none self-center overflow-hidden bg-slate-50 sm:h-72 sm:max-w-[17.9rem] lg:order-none lg:h-[22.75rem] lg:w-[17.9rem] lg:min-w-[17.9rem] lg:self-start">
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => mainImageInputRef.current?.click()}
                          disabled={uploadState.gallery}
                          className="group relative block h-full w-full cursor-pointer text-left disabled:cursor-wait"
                          aria-label="Cambiar imagen principal del personaje"
                        >
                          {currentItem.imagenPrincipalUrl ? (
                            <img
                              src={currentItem.imagenPrincipalUrl}
                              alt={currentItem.nombre}
                              className="h-full w-full object-cover"
                              loading="eager"
                              decoding="async"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-[10px] text-slate-400">
                              Sin imagen
                            </div>
                          )}
                          <span className="absolute inset-x-0 bottom-0 bg-black/65 px-3 py-2 text-center font-label text-[9px] font-black uppercase tracking-[0.14em] text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                            {uploadState.gallery
                              ? 'Subiendo...'
                              : 'Cambiar imagen'}
                          </span>
                        </button>
                      ) : currentItem.imagenPrincipalUrl ? (
                        <img
                          src={currentItem.imagenPrincipalUrl}
                          alt={currentItem.nombre}
                          className="h-full w-full object-cover"
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-[10px] text-slate-400">
                          Sin imagen
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {!isPreviewMode && activeTab === 'poderes-objetos'
                  ? renderPowersAndObjectsTab()
                  : null}

                {!isPreviewMode && activeTab === 'informacion' ? (
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <section className="space-y-6">
                      <div
                        className="border border-slate-100 bg-slate-50/50 px-5 py-5"
                        data-editor-anchor="info-categories"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                              Descripcion
                            </p>
                          </div>
                        </div>
                        {isEditing ? (
                          <WikiTextArea
                            rows={6}
                            value={draft?.core.descripcion || ''}
                            onChange={(event) =>
                              updateCoreField('descripcion', event.target.value)
                            }
                            className="mt-3 w-full border border-slate-200 bg-white px-3 py-3 text-sm leading-7 text-slate-700 outline-none focus:border-brand"
                          />
                        ) : (
                          <p className="mt-3 break-words text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">
                            <WikiText
                              text={currentItem.descripcion}
                              emptyText="Sin descripción registrada."
                            />
                          </p>
                        )}
                      </div>

                      <div
                        className="border border-slate-100 bg-slate-50/50 px-5 py-5"
                        data-editor-anchor="info-general"
                      >
                        <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                          Lore
                        </p>
                        {isEditing ? (
                          <WikiTextArea
                            rows={9}
                            value={draft?.core.lore || ''}
                            onChange={(event) =>
                              updateCoreField('lore', event.target.value)
                            }
                            className="mt-3 w-full border border-slate-200 bg-white px-3 py-3 text-sm leading-7 text-slate-700 outline-none focus:border-brand"
                          />
                        ) : (
                          <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">
                            <WikiText
                              text={currentItem.lore}
                              emptyText="Este personaje aun no tiene lore registrado."
                            />
                          </p>
                        )}
                      </div>

                      <div
                        className="border border-slate-100 bg-slate-50/50 px-5 py-5"
                        data-editor-anchor="info-privacy"
                      >
                        <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                          Categorias
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {isEditing ? (
                            <>
                              {(draft?.categorias || []).map((categoria) => (
                                <span
                                  key={`${categoria.id || 'new'}-${categoria.nombre}`}
                                  className="category-chip category-chip--selected group"
                                >
                                  {categoria.nombre}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeCategory(categoria.nombre)
                                    }
                                    className="category-chip-remove ml-2 hidden transition group-hover:inline-flex"
                                    aria-label={`Quitar categoría ${categoria.nombre}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              ))}

                              <div className="category-picker-panel w-full space-y-3 rounded-xl border p-4">
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
                                              normalizeLooseText(
                                                item.nombre
                                              ) ===
                                              normalizeLooseText(categoryQuery)
                                          )

                                        addCategoryFromEntry(
                                          exactMatch || {
                                            id: null,
                                            nombre: categoryQuery,
                                          }
                                        )
                                      }
                                    }}
                                    className="category-picker-input flex-1 border px-3 py-2 text-sm outline-none focus:border-brand"
                                    placeholder="Buscar o crear categoría"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      addCategoryFromEntry({
                                        id: null,
                                        nombre: categoryQuery,
                                      })
                                    }
                                    className="category-picker-action inline-flex items-center justify-center gap-2 border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em]"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Añadir categoría
                                  </button>
                                </div>

                                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                                  {filteredCategorySuggestions.length ? (
                                    filteredCategorySuggestions
                                      .slice(0, 8)
                                      .map((categoria) => (
                                        <button
                                          key={categoria.id}
                                          type="button"
                                          onClick={() =>
                                            addCategoryFromEntry(categoria)
                                          }
                                          className="category-picker-option flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition hover:border-brand/30 hover:bg-brand/5"
                                        >
                                          <span>{categoria.nombre}</span>
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
                            </>
                          ) : currentItem.categorias?.length ? (
                            currentItem.categorias.map((categoria) => (
                              <span
                                key={categoria.id}
                                className="category-chip"
                              >
                                {categoria.nombre}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">
                              Sin categorías asignadas.
                            </span>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="space-y-6">
                      <div className="border border-slate-100 bg-slate-50/50 px-5 py-5">
                        <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                          Datos generales
                        </p>
                        {isEditing ? (
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="block">
                              <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Tier
                              </span>
                              <select
                                value={draft?.core.tierId || ''}
                                onChange={(event) =>
                                  updateCoreField(
                                    'tierId',
                                    event.target.value || null
                                  )
                                }
                                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              >
                                <option value="">Sin tier</option>
                                {editorMeta?.tiers?.map((tier) => (
                                  <option key={tier.id} value={tier.id}>
                                    {tier.nombre}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block">
                              <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Estado
                              </span>
                              <select
                                value={draft?.core.estadoId || ''}
                                onChange={(event) =>
                                  updateCoreField(
                                    'estadoId',
                                    event.target.value || null
                                  )
                                }
                                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              >
                                <option value="">Sin estado</option>
                                {editorMeta?.estados?.map((state) => (
                                  <option key={state.id} value={state.id}>
                                    {state.nombre}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block">
                              <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Campaña
                              </span>
                              <select
                                value={draft?.core.campanaId || ''}
                                onChange={(event) =>
                                  updateDraftCampaign(event.target.value)
                                }
                                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              >
                                {editorMeta?.campanas?.map((campaign) => (
                                  <option key={campaign.id} value={campaign.id}>
                                    {campaign.nombre}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block">
                              <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Aventura
                              </span>
                              <select
                                value={draft?.core.aventuraId || ''}
                                onChange={(event) =>
                                  updateCoreField(
                                    'aventuraId',
                                    event.target.value || null
                                  )
                                }
                                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              >
                                <option value="">Sin aventura</option>
                                {(
                                  editorMeta?.campanas?.find(
                                    (campaign) =>
                                      campaign.id === draft?.core.campanaId
                                  )?.aventuras || []
                                ).map((adventure) => (
                                  <option
                                    key={adventure.id}
                                    value={adventure.id}
                                  >
                                    {adventure.nombre}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block sm:col-span-2">
                              <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Partida de aparición
                              </span>
                              <select
                                value={draft?.core.partidaAparicionId || ''}
                                onChange={(event) =>
                                  updateCoreField(
                                    'partidaAparicionId',
                                    event.target.value || null
                                  )
                                }
                                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              >
                                <option value="">Sin partida</option>
                                {selectedCampaignSessions.map((session) => (
                                  <option key={session.id} value={session.id}>
                                    {formatSessionOptionLabel(session)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block sm:col-span-2">
                              <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Partida de defunción
                              </span>
                              <select
                                value={draft?.core.partidaDefuncionId || ''}
                                onChange={(event) =>
                                  updateCoreField(
                                    'partidaDefuncionId',
                                    event.target.value || null
                                  )
                                }
                                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              >
                                <option value="">Sin partida</option>
                                {selectedCampaignSessions.map((session) => (
                                  <option key={session.id} value={session.id}>
                                    {formatSessionOptionLabel(session)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block">
                              <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Propietario
                              </span>
                              <select
                                value={draft?.core.propietarioUsuarioId || ''}
                                onChange={(event) =>
                                  updateCoreField(
                                    'propietarioUsuarioId',
                                    event.target.value
                                  )
                                }
                                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              >
                                {editorMeta?.usuarios?.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.nombreUsuario}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <EditableField
                              label="Edad"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={draft?.core.edad}
                              onChange={(event) =>
                                updateCoreField(
                                  'edad',
                                  sanitizeIntegerInput(
                                    event.target.value,
                                    MAX_SHEET_SPEED_INTEGER
                                  )
                                )
                              }
                            />
                            <label className="block">
                              <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Altura (m)
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  heightInputValue ??
                                  formatDecimalCommaValue(
                                    draft?.core.alturaMetros
                                  )
                                }
                                onChange={(event) => {
                                  const rawValue = event.target.value
                                    .replace(/\./gu, '')
                                    .replace(/[^\d,]/gu, '')
                                  const [integerPart = '', ...decimalParts] =
                                    rawValue.split(',')
                                  const nextDisplay =
                                    decimalParts.length > 0
                                      ? `${integerPart},${decimalParts
                                          .join('')
                                          .slice(0, 2)}`
                                      : integerPart

                                  setHeightInputValue(nextDisplay)
                                  updateCoreField(
                                    'alturaMetros',
                                    sanitizeDecimalCommaInput(nextDisplay)
                                  )
                                }}
                                onBlur={() => setHeightInputValue(null)}
                                className="mt-1 w-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand"
                              />
                            </label>
                            <EditableField
                              label="Peso (kg)"
                              type="text"
                              inputMode="decimal"
                              value={formatDecimalCommaValue(
                                draft?.core.pesoKg
                              )}
                              onChange={(event) =>
                                updateCoreField(
                                  'pesoKg',
                                  sanitizeDecimalCommaInput(event.target.value)
                                )
                              }
                            />

                            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                              <input
                                type="checkbox"
                                checked={Boolean(draft?.core.esCriatura)}
                                onChange={(event) =>
                                  updateCoreField(
                                    'esCriatura',
                                    event.target.checked
                                  )
                                }
                                className="h-4 w-4 border-slate-300 text-brand focus:ring-brand"
                              />
                              <span className="text-sm font-medium text-slate-700">
                                Marcar como criatura
                              </span>
                            </label>
                          </div>
                        ) : (
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {[
                              ['Campaña', currentItem.campana?.nombre || '-'],
                              ['Aventura', currentItem.aventura?.nombre || '-'],
                              [
                                'Aparición',
                                formatSessionOptionLabel(
                                  currentItem.partidaAparicion
                                ),
                              ],
                              [
                                'Defunción',
                                formatSessionOptionLabel(
                                  currentItem.partidaDefuncion
                                ),
                              ],
                              ['Estado', currentItem.estado?.nombre || '-'],
                              ['Tier', currentItem.tier?.nombre || '-'],
                              ['Edad', formatSheetNumber(currentItem.edad)],
                              [
                                'Altura',
                                formatSheetNumber(
                                  currentItem.alturaMetros,
                                  ' m'
                                ),
                              ],
                              [
                                'Peso',
                                formatSheetNumber(currentItem.pesoKg, ' kg'),
                              ],
                              [
                                'Criatura',
                                currentItem.esCriatura ? 'Si' : 'No',
                              ],
                              ['Version', currentItem.esVersion ? 'Si' : 'No'],
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                              >
                                <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                                  {label}
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-800">
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border border-slate-100 bg-slate-50/50 px-5 py-5">
                        <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                          Privacidad
                        </p>

                        {isEditing ? (
                          <>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {[
                                ['public', 'Completamente público'],
                                ['private', 'Completamente privado'],
                                ['preview', 'Solo vista previa'],
                                ['custom', 'Usuarios concretos'],
                              ].map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setPrivacyMode(value)}
                                  className={clsx(
                                    'border px-3 py-2 text-[11px] font-semibold transition',
                                    draft?.privacidad.mode === value
                                      ? 'border-brand bg-brand/10 text-brand'
                                      : 'border-slate-200 bg-white text-slate-600'
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>

                            {draft?.privacidad.mode === 'custom' ? (
                              <div className="mt-4 space-y-3 border border-slate-200 bg-white p-4">
                                {editorMeta?.usuarios
                                  ?.filter(
                                    (editorUser) =>
                                      editorUser.id !==
                                        draft?.core.propietarioUsuarioId &&
                                      editorUser.id !== user?.id
                                  )
                                  .map((user) => {
                                    const permissionCode = getPermissionCode(
                                      draft.privacidad,
                                      user.id
                                    )

                                    return (
                                      <div
                                        key={user.id}
                                        className="grid grid-cols-[minmax(0,1fr)_11rem] items-center gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                                      >
                                        <div>
                                          <p className="text-sm font-semibold text-slate-800">
                                            {user.nombreUsuario}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            Elige si lo ve completo, solo
                                            preview o nada.
                                          </p>
                                        </div>
                                        <select
                                          value={permissionCode}
                                          onChange={(event) =>
                                            setPermissionLevel(
                                              user.id,
                                              event.target.value
                                            )
                                          }
                                          className="border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                                        >
                                          <option value="sin_acceso">
                                            Sin acceso
                                          </option>
                                          <option value="vista_previa">
                                            Solo preview
                                          </option>
                                          <option value="completo">
                                            Completo
                                          </option>
                                        </select>
                                      </div>
                                    )
                                  })}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                            {currentItem.ambitoVisibilidadCodigo ===
                            'campana_completo'
                              ? 'Completamente Público'
                              : currentItem.ambitoVisibilidadCodigo ===
                                  'campana_vista_previa'
                                ? 'Solo Vista Previa'
                                : currentItem.ambitoVisibilidadCodigo ===
                                    'usuarios_seleccionados'
                                  ? 'Disponible para usuarios concretos'
                                  : 'Completamente privado'}
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div
                          className="space-y-5 border border-slate-100 bg-slate-50/50 px-5 py-5"
                          data-editor-anchor="info-versioning"
                        >
                          <div>
                            <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                              Versiones
                            </p>
                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                              <p className="text-sm font-semibold text-slate-800">
                                {draft?.core.personajeBaseId
                                  ? `Version de ${selectedVersionBase?.nombre || 'otro personaje'}`
                                  : 'Personaje independiente'}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                Solo puedes vincularlo como versión de
                                personajes que sean tuyos.
                              </p>

                              <div className="mt-4 flex flex-col gap-2">
                                <input
                                  value={versionSearchQuery}
                                  onChange={(event) =>
                                    setVersionSearchQuery(event.target.value)
                                  }
                                  className="border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                                  placeholder="Buscar personaje propio"
                                />

                                <button
                                  type="button"
                                  onClick={() => setVersionBase(null)}
                                  className="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-brand/30 hover:bg-brand/5"
                                >
                                  Dejar como personaje independiente
                                </button>

                                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                                  {filteredVersionBaseOptions.length ? (
                                    filteredVersionBaseOptions.map((item) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setVersionBase(item.id)}
                                        className="flex w-full items-center justify-between gap-3 border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand/30 hover:bg-brand/5"
                                      >
                                        <span className="min-w-0">
                                          <span className="block truncate font-semibold">
                                            {item.nombre}
                                          </span>
                                          {item.titulo ? (
                                            <span className="block truncate text-xs text-slate-500">
                                              {item.titulo}
                                            </span>
                                          ) : null}
                                        </span>
                                        <Plus className="h-4 w-4 shrink-0 text-slate-400" />
                                      </button>
                                    ))
                                  ) : (
                                    <p className="text-sm text-slate-500">
                                      No hay personajes propios que coincidan.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                              Copiar Ficha
                            </p>
                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                              <input
                                value={copySearchQuery}
                                onChange={(event) =>
                                  setCopySearchQuery(event.target.value)
                                }
                                className="w-full border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                                placeholder="Buscar personaje propio para copiar"
                              />

                              {selectedCopySource ? (
                                <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-slate-800">
                                  Origen seleccionado:{' '}
                                  <span className="font-bold text-brand">
                                    {selectedCopySource.nombre}
                                  </span>
                                </div>
                              ) : null}

                              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                                {filteredCopySourceOptions.length ? (
                                  filteredCopySourceOptions.map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedCopyCharacterId(item.id)
                                        setCopySearchQuery(item.nombre)
                                        setCopyFeedback('')
                                      }}
                                      className="flex w-full items-center justify-between gap-3 border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand/30 hover:bg-brand/5"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate font-semibold">
                                          {item.nombre}
                                        </span>
                                        {item.titulo ? (
                                          <span className="block truncate text-xs text-slate-500">
                                            {item.titulo}
                                          </span>
                                        ) : null}
                                      </span>
                                      <Plus className="h-4 w-4 shrink-0 text-slate-400" />
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-sm text-slate-500">
                                    No hay personajes propios que coincidan.
                                  </p>
                                )}
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2">
                                {[
                                  ['estadisticas', 'Estadisticas'],
                                  ['poderesObjetos', 'Poderes y Objetos'],
                                  ['informacion', 'Informacion'],
                                  ['musica', 'Musica'],
                                  ['galeria', 'Galeria'],
                                ].map(([section, label]) => (
                                  <label
                                    key={section}
                                    className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={Boolean(copySections[section])}
                                      onChange={() =>
                                        toggleCopySection(section)
                                      }
                                      className="h-4 w-4 border-slate-300 text-brand focus:ring-brand"
                                    />
                                    {label}
                                  </label>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={applyCopiedSectionsFromSource}
                                disabled={!selectedCopyCharacterId}
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-slate-900 px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Copiar secciones seleccionadas
                              </button>

                              {copyFeedback ? (
                                <p className="mt-3 text-sm text-slate-600">
                                  {copyFeedback}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </section>
                  </div>
                ) : null}

                {!isPreviewMode && activeTab === 'musica' ? (
                  <div className="space-y-4" data-editor-anchor="music-section">
                    {isEditing ? (
                      <div className="mb-4 flex justify-end">
                        <button
                          type="button"
                          onClick={addMusicEntry}
                          className="inline-flex items-center gap-2 bg-slate-900 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-white"
                        >
                          <Plus className="h-4 w-4" />
                          Añadir tema
                        </button>
                      </div>
                    ) : null}

                    {(currentItem.temasMusicales || []).length ? (
                      currentItem.temasMusicales.map((item, index) =>
                        isEditing ? (
                          <div
                            key={item.id}
                            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-4 sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)_auto]"
                          >
                            <input
                              value={
                                draft?.temasMusicales?.[index]?.titulo || ''
                              }
                              onChange={(event) =>
                                updateMusicEntry(
                                  index,
                                  'titulo',
                                  event.target.value
                                )
                              }
                              className="border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              placeholder="Titulo del tema"
                            />
                            <input
                              value={
                                draft?.temasMusicales?.[index]?.musicaUrl || ''
                              }
                              onChange={(event) =>
                                updateMusicEntry(
                                  index,
                                  'musicaUrl',
                                  event.target.value
                                )
                              }
                              className="border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand"
                              placeholder="https://..."
                            />
                            <button
                              type="button"
                              onClick={() => removeMusicEntry(index)}
                              className="inline-flex items-center justify-center border border-slate-200 bg-white px-3 py-2 text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {musicUrlErrors[index] ? (
                              <p className="sm:col-span-3 text-sm text-red-600">
                                {musicUrlErrors[index]}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div
                            key={item.id}
                            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-headline text-lg font-bold text-slate-900">
                                {getMusicTitle(item, index)}
                              </p>
                              <p className="mt-1 truncate text-sm text-slate-600">
                                {item.musicaUrl}
                              </p>
                            </div>

                            <a
                              href={item.musicaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-black"
                            >
                              Abrir enlace
                            </a>
                          </div>
                        )
                      )
                    ) : (
                      <div className="border border-slate-100 bg-slate-50/50 px-6 py-6">
                        <p className="text-sm text-slate-600">
                          {isEditing
                            ? 'Aun no hay temas musicales en el borrador.'
                            : 'Este personaje todavia no tiene temas musicales registrados.'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                {!isPreviewMode && activeTab === 'galeria' ? (
                  <div
                    className="space-y-6"
                    data-editor-anchor="gallery-section"
                  >
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
                          disabled={uploadState.gallery}
                          className="inline-flex items-center gap-2 bg-slate-900 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ImagePlus className="h-4 w-4" />
                          {uploadState.gallery
                            ? 'Subiendo galeria...'
                            : 'Añadir imágenes'}
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

                            setSelectedGalleryImageState({
                              characterId: activeCharacterKey,
                              imageUrl: galleryImages[nextIndex].imagenUrl,
                            })
                          }}
                          disabled={galleryImages.length <= 1}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Imagen anterior"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>

                        <div className="flex min-h-[340px] items-center justify-center overflow-hidden border border-slate-200 bg-slate-50/60 p-4 sm:min-h-[460px] xl:min-h-[560px]">
                          {selectedGalleryImage ? (
                            <CloudinaryImage
                              src={selectedGalleryImage}
                              alt={`${currentItem.nombre} - imagen destacada`}
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

                            setSelectedGalleryImageState({
                              characterId: activeCharacterKey,
                              imageUrl: galleryImages[nextIndex].imagenUrl,
                            })
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
                            selectedGalleryImage === image.imagenUrl
                          const isPrincipal =
                            image.imagenUrl === currentItem.imagenPrincipalUrl

                          return (
                            <div
                              key={image.id}
                              className={clsx(
                                'overflow-hidden border bg-white transition',
                                isSelected
                                  ? 'border-brand theme-brand-outline'
                                  : 'border-slate-200 hover:border-slate-300'
                              )}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedGalleryImageState({
                                    characterId: activeCharacterKey,
                                    imageUrl: image.imagenUrl,
                                  })
                                }
                                className="block w-full"
                              >
                                <CloudinaryImage
                                  src={image.imagenUrl}
                                  alt={`${currentItem.nombre} - galeria ${index + 1}`}
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
                            Este personaje todavía no tiene imágenes en galería.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <PreviewModeNotice show={isPreviewMode} />
              </div>

              <CharacterSheetActions
                canEdit={currentItem.puedeEditar}
                isPreviewMode={isPreviewMode}
                isEditing={isEditing}
                isSaving={saveMutation.isPending}
                isDeleting={deleteCharacterMutation.isPending}
                creator={createMode ? null : currentItem.propietario}
                creatorLabel="Propietario"
                saveLabel={createMode ? 'Crear Personaje' : undefined}
                savingLabel={createMode ? 'Creando...' : undefined}
                cancelLabel={createMode ? 'Descartar Personaje' : undefined}
                onStartEditing={handleStartEditing}
                onSaveEditing={() => handleSaveEditing()}
                onCancelEditing={
                  createMode ? handleDiscardCreation : handleCancelEditing
                }
                onDelete={() => setIsCharacterDeleteOpen(true)}
              />

              {saveError ? (
                <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {saveError}
                </div>
              ) : null}
            </div>

            <div className="hidden lg:block" />
          </div>
        </div>
      </article>

      {!createMode ? (
        <CommentsSection
          key={`comentarios-personaje-${currentItem.id}`}
          targetType="personaje"
          targetId={currentItem.id}
        />
      ) : null}

      <ScrollTopButton
        show={showScrollTop}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null)
          setSkipDeletePromptToday(false)
        }}
        onConfirm={handleDeleteTraitConfirmed}
        rememberChoice={skipDeletePromptToday}
        onRememberChoiceChange={setSkipDeletePromptToday}
      />

      <CharacterDeleteModal
        key={
          isCharacterDeleteOpen
            ? 'character-delete-open'
            : 'character-delete-closed'
        }
        open={isCharacterDeleteOpen}
        characterName={currentItem?.nombre}
        confirmationText={characterDeleteText}
        isDeleting={deleteCharacterMutation.isPending}
        error={
          deleteCharacterMutation.error?.response?.data?.error?.message ||
          deleteCharacterMutation.error?.message ||
          ''
        }
        onConfirmationTextChange={setCharacterDeleteText}
        onClose={handleCloseCharacterDelete}
        onConfirm={() => deleteCharacterMutation.mutate()}
      />
    </section>
  )
}
