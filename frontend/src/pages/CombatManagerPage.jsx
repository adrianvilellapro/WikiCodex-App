import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  ArrowLeft,
  BarChart3,
  Bot,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  ExternalLink,
  Eye,
  Flag,
  HeartPulse,
  ListChecks,
  Lock,
  Plus,
  Save,
  Search,
  Shield,
  Skull,
  Swords,
  Trash2,
  Unlock,
  UserRound,
  X,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { useAuth } from '../features/auth/auth-context'
import { cn } from '../lib/cn'
import { api } from '../services/http'
import {
  fetchCampaignDetail,
  fetchCampaigns,
  fetchCampaignSessionDetail,
} from './campaign-detail/api'
import { fetchCharacterDetail } from './character-detail/api'
import { ScrollTopButton } from './character-detail/components'

const STORAGE_VERSION = 'v1'
const COMBAT_HOME_PATH = '/app/herramientas/combate'
const COMBAT_START_PATH = '/app/herramientas/combate/iniciar'
const COMBAT_ACTIVE_PATH = '/app/herramientas/combate/activos'
const COMBAT_FINISHED_PATH = '/app/herramientas/combate/terminados'
const EMPTY_COMBATANTS = []
const STATUS_LABELS = {
  active: 'Activo',
  unconscious: 'Inconsciente',
  dead: 'Muerto',
}
const ABILITY_ENTRIES = [
  ['fuerza', 'FUE'],
  ['destreza', 'DES'],
  ['constitucion', 'CON'],
  ['inteligencia', 'INT'],
  ['sabiduria', 'SAB'],
  ['carisma', 'CAR'],
]
const SAVE_ENTRIES = [
  ['salvacionFuerza', 'FUE'],
  ['salvacionDestreza', 'DES'],
  ['salvacionConstitucion', 'CON'],
  ['salvacionInteligencia', 'INT'],
  ['salvacionSabiduria', 'SAB'],
  ['salvacionCarisma', 'CAR'],
]

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getStorageKey(userId) {
  return `wikicodex:combat-sessions:${userId || 'anon'}:${STORAGE_VERSION}`
}

function getNumberValue(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsed = Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function sanitizeCombatNumberInput(
  value,
  { allowDecimal = false, allowNegative = false } = {}
) {
  const source = String(value || '')
  let result = ''
  let hasDecimal = false

  for (const char of source) {
    if (/\d/u.test(char)) {
      result += char
      continue
    }

    if (allowDecimal && (char === ',' || char === '.') && !hasDecimal) {
      result += char
      hasDecimal = true
      continue
    }

    if (allowNegative && char === '-' && !result) {
      result += char
    }
  }

  return result
}

function formatNumber(value) {
  const parsed = getNumberValue(value)
  return parsed === null ? '-' : String(parsed)
}

function formatModifier(value) {
  const parsed = getNumberValue(value)
  if (parsed === null) {
    return '-'
  }

  return parsed > 0 ? `+${parsed}` : String(parsed)
}

function formatAbilityModifier(value) {
  const parsed = getNumberValue(value)
  if (parsed === null) {
    return '-'
  }

  const modifier = Math.floor((parsed - 10) / 2)
  return modifier > 0 ? `+${modifier}` : String(modifier)
}

function formatDateTime(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTimeValue(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function getCombatantDisplayName(combatant) {
  return (
    combatant?.name?.trim() ||
    combatant?.nombre?.trim() ||
    (combatant?.isCustom ? 'Participante manual' : 'Participante')
  )
}

function getLivingTurnOrder(session) {
  return sortCombatants(session?.combatants || []).filter(
    (combatant) => combatant.status !== 'dead'
  )
}

function getTurnMovement(session, direction) {
  const order = getLivingTurnOrder(session)
  if (!order.length) {
    return null
  }

  const currentIndex = order.findIndex(
    (combatant) => combatant.id === session?.activeTurnCombatantId
  )
  const resolvedCurrentIndex =
    currentIndex >= 0 ? currentIndex : direction > 0 ? -1 : 0
  const nextIndex =
    direction > 0
      ? (resolvedCurrentIndex + 1) % order.length
      : resolvedCurrentIndex <= 0
        ? order.length - 1
        : resolvedCurrentIndex - 1

  return {
    order,
    currentIndex: resolvedCurrentIndex,
    nextIndex,
    nextCombatant: order[nextIndex],
    wrapsForward: direction > 0 && resolvedCurrentIndex >= 0 && nextIndex === 0,
    wrapsBackward: direction < 0 && resolvedCurrentIndex <= 0,
  }
}

function applyTurnChange(session, direction) {
  const movement = getTurnMovement(session, direction)
  if (!movement?.nextCombatant) {
    return session
  }

  const currentRound = session.round || 1
  const nextRound =
    direction > 0
      ? movement.wrapsForward
        ? currentRound + 1
        : currentRound
      : movement.wrapsBackward
        ? Math.max(1, currentRound - 1)
        : currentRound

  return {
    ...session,
    round: nextRound,
    turnCount: Math.max(0, (session.turnCount || 0) + direction),
    activeTurnCombatantId: movement.nextCombatant.id,
    events: [
      ...(session.events || []),
      {
        id: createId(),
        at: new Date().toISOString(),
        type: direction > 0 ? 'turn' : 'turn-back',
        combatantId: movement.nextCombatant.id,
        combatantName: getCombatantDisplayName(movement.nextCombatant),
      },
    ],
  }
}

function isEditableShortcutTarget(target) {
  const tagName = target?.tagName?.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target?.isContentEditable
  )
}

function normalizeCombatant(combatant) {
  const hitPoints = combatant.hitPoints ?? ''
  const maxHitPoints = combatant.maxHitPoints ?? hitPoints
  const armorClass = combatant.armorClass ?? ''

  return {
    ...combatant,
    name:
      combatant.isCustom && !combatant.name
        ? ''
        : combatant.name || combatant.nombre || 'Participante',
    status: combatant.status || 'active',
    initiativeBonus: combatant.initiativeBonus ?? combatant.initiative ?? 0,
    initiativeRoll: combatant.initiativeRoll ?? null,
    originalMaxHitPoints: combatant.originalMaxHitPoints ?? maxHitPoints,
    maxHitPoints,
    maxHitPointsUnlocked: Boolean(combatant.maxHitPointsUnlocked),
    hitPoints,
    temporaryHitPoints: combatant.temporaryHitPoints ?? 0,
    originalArmorClass: combatant.originalArmorClass ?? armorClass,
    armorClass,
    armorClassUnlocked: Boolean(combatant.armorClassUnlocked),
    abilities: combatant.abilities || {},
    saves: combatant.saves || {},
    notes: combatant.notes || '',
    notesOpen: Boolean(combatant.notesOpen),
    collapsed: Boolean(combatant.collapsed),
    isCustom: Boolean(combatant.isCustom),
  }
}

function normalizeSession(session) {
  return {
    ...session,
    status: session.status || 'active',
    round: session.round || 1,
    turnCount: session.turnCount || 0,
    hideDead: Boolean(session.hideDead),
    combatants: (session.combatants || []).map(normalizeCombatant),
    events: Array.isArray(session.events) ? session.events : [],
    assignedCombats: Array.isArray(session.assignedCombats)
      ? session.assignedCombats
      : [],
  }
}

function readStoredCombatState(storageKey) {
  if (typeof window === 'undefined') {
    return { sessions: [], activeSessionId: null }
  }

  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) {
      return { sessions: [], activeSessionId: null }
    }

    const parsed = JSON.parse(stored)
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions.map(normalizeSession)
      : []
    const activeSessionId =
      typeof parsed.activeSessionId === 'string'
        ? parsed.activeSessionId
        : sessions.find((session) => session.status === 'active')?.id || null

    return {
      sessions,
      activeSessionId: sessions.some(
        (session) => session.id === activeSessionId
      )
        ? activeSessionId
        : sessions.find((session) => session.status === 'active')?.id || null,
    }
  } catch {
    return { sessions: [], activeSessionId: null }
  }
}

function writeStoredCombatState(storageKey, state) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(state))
}

function sortCombatants(combatants) {
  return [...combatants].sort((left, right) => {
    const leftInitiative = getNumberValue(left.initiative)
    const rightInitiative = getNumberValue(right.initiative)

    if (leftInitiative !== null && rightInitiative !== null) {
      if (rightInitiative !== leftInitiative) {
        return rightInitiative - leftInitiative
      }
    } else if (leftInitiative !== null) {
      return -1
    } else if (rightInitiative !== null) {
      return 1
    }

    return String(left.addedAt || '').localeCompare(String(right.addedAt || ''))
  })
}

function createCombatantFromCharacter(character) {
  const initiativeBonus = character.iniciativa ?? 0
  const maxHitPoints = character.puntosGolpe ?? ''
  const armorClass = character.claseArmadura ?? ''

  return normalizeCombatant({
    id: createId(),
    characterId: character.id,
    name: character.nombre,
    title: character.titulo || '',
    imageUrl: character.imagenPrincipalUrl || null,
    campaignName: character.campana?.nombre || '',
    initiative: '',
    initiativeBonus,
    initiativeRoll: null,
    originalMaxHitPoints: maxHitPoints,
    maxHitPoints,
    hitPoints: maxHitPoints,
    temporaryHitPoints: 0,
    originalArmorClass: armorClass,
    armorClass,
    status: 'active',
    addedAt: new Date().toISOString(),
    abilities: {
      fuerza: character.fuerza,
      destreza: character.destreza,
      constitucion: character.constitucion,
      inteligencia: character.inteligencia,
      sabiduria: character.sabiduria,
      carisma: character.carisma,
    },
    saves: {
      salvacionFuerza: character.salvacionFuerza,
      salvacionDestreza: character.salvacionDestreza,
      salvacionConstitucion: character.salvacionConstitucion,
      salvacionInteligencia: character.salvacionInteligencia,
      salvacionSabiduria: character.salvacionSabiduria,
      salvacionCarisma: character.salvacionCarisma,
    },
  })
}

function createCustomCombatant() {
  return normalizeCombatant({
    id: createId(),
    name: '',
    title: 'Entrada manual',
    initiative: '',
    initiativeBonus: 0,
    hitPoints: '',
    maxHitPoints: '',
    temporaryHitPoints: 0,
    armorClass: '',
    status: 'active',
    isCustom: true,
    addedAt: new Date().toISOString(),
    abilities: Object.fromEntries(ABILITY_ENTRIES.map(([key]) => [key, ''])),
    saves: Object.fromEntries(SAVE_ENTRIES.map(([key]) => [key, ''])),
  })
}

function createCombatSession(name) {
  return normalizeSession({
    id: createId(),
    name:
      name.trim() ||
      `Combate ${new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    status: 'active',
    createdAt: new Date().toISOString(),
    finishedAt: null,
    round: 1,
    turnCount: 0,
    activeTurnCombatantId: null,
    hideDead: false,
    combatants: [],
    events: [],
  })
}

function calculateCombatStats(session) {
  const events = Array.isArray(session?.events) ? session.events : []
  const stats = {
    danoTotal: 0,
    curacionTotal: 0,
    inconscientes: 0,
    muertes: 0,
    reanimaciones: 0,
    turnos: Number(session?.turnCount || 0),
  }

  for (const event of events) {
    const amount = Number(event.amount || 0)

    if (event.type === 'damage' && Number.isFinite(amount)) {
      stats.danoTotal += amount
    } else if (event.type === 'healing' && Number.isFinite(amount)) {
      stats.curacionTotal += amount
    } else if (event.type === 'unconscious') {
      stats.inconscientes += 1
    } else if (event.type === 'death') {
      stats.muertes += 1
    } else if (event.type === 'revive') {
      stats.reanimaciones += 1
    }
  }

  return stats
}

async function searchVisibleCharacters(query) {
  const { data } = await api.get('/characters', {
    params: {
      view: 'characters',
      limit: 10,
      q: query,
      matchMode: 'all',
      sort: 'name_asc',
    },
  })

  return data.items || []
}

async function assignCombatToSession({ campaignId, sessionId, combat }) {
  const { data } = await api.post(
    `/campaigns/${campaignId}/sessions/${sessionId}/combats`,
    {
      nombre: combat.name,
      snapshot: combat,
      estadisticas: calculateCombatStats(combat),
    }
  )
  return data.item
}

async function deleteAssignedCombat({ campaignId, sessionId, combatId }) {
  await api.delete(
    `/campaigns/${campaignId}/sessions/${sessionId}/combats/${combatId}`
  )
}

function useCombatStore() {
  const { user } = useAuth()
  const storageKey = getStorageKey(user?.id)
  const [combatState, setCombatState] = useState(() =>
    readStoredCombatState(storageKey)
  )

  useEffect(() => {
    writeStoredCombatState(storageKey, combatState)
  }, [combatState, storageKey])

  return { combatState, setCombatState }
}

function useScrollTopVisibility() {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 500)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return showScrollTop
}

function scrollToCombatant(combatantId) {
  if (!combatantId) {
    return
  }

  window.setTimeout(() => {
    document
      .getElementById(`combatant-${combatantId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 0)
}

function CombatPageFrame({
  eyebrow,
  title,
  description,
  children,
  backTo = COMBAT_HOME_PATH,
  showBack = true,
}) {
  const navigate = useNavigate()
  const showScrollTop = useScrollTopVisibility()

  return (
    <section className="grid gap-6">
      <div className="theme-header-surface overflow-hidden border-b-2 border-brand">
        <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] lg:items-center">
          {showBack ? (
            <button
              type="button"
              onClick={() => navigate(backTo)}
              className="theme-header-button inline-flex h-11 w-11 items-center justify-center rounded-full border transition"
              aria-label="Volver atrás"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <span className="hidden h-11 w-11 lg:block" />
          )}

          <div className="min-w-0 text-center">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              {eyebrow}
            </p>
            <h1 className="mt-1 break-words font-headline text-xl font-black uppercase tracking-[0.18em] text-brand [overflow-wrap:anywhere] sm:text-2xl sm:tracking-[0.28em]">
              {title}
            </h1>
            {description ? (
              <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-white/65">
                {description}
              </p>
            ) : null}
          </div>

          <span className="hidden h-11 w-11 lg:block" />
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[76rem] gap-5 px-1 sm:px-2">
        {children}
      </div>

      <ScrollTopButton
        show={showScrollTop}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </section>
  )
}

function CharacterAvatar({ item, className, linkTo }) {
  const content =
    item.imageUrl || item.imagenPrincipalUrl ? (
      <CloudinaryImage
        src={item.imageUrl || item.imagenPrincipalUrl}
        alt={getCombatantDisplayName(item)}
        variant="avatar"
        sizes="88px"
        className="h-full w-full object-cover"
      />
    ) : (
      <UserRound className="h-5 w-5" />
    )

  const classNames = cn(
    'flex items-center justify-center overflow-hidden rounded-lg bg-surface-strong text-brand',
    className
  )

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        target="_blank"
        rel="noreferrer"
        className={cn(
          classNames,
          'transition hover:ring-2 hover:ring-brand/60'
        )}
        title="Abrir ficha en otra pestaña"
      >
        {content}
      </Link>
    )
  }

  return <div className={classNames}>{content}</div>
}

function CompactNumberField({
  label,
  value,
  onChange,
  readOnly,
  locked = false,
  onToggleLock,
  allowDecimal = false,
  allowNegative = false,
}) {
  const isLocked = Boolean(locked && !readOnly)
  const effectiveReadOnly = readOnly || isLocked

  return (
    <div className="grid gap-1">
      <span className="inline-flex min-h-6 w-fit items-center gap-1.5">
        <span className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
          {label}
        </span>
        {onToggleLock && !readOnly ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              onToggleLock()
            }}
            className={cn(
              'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition',
              isLocked
                ? 'border-stroke bg-surface-strong text-ink-muted hover:border-brand hover:text-brand'
                : 'border-brand/30 bg-brand/10 text-brand hover:border-brand/60'
            )}
            aria-label={isLocked ? `Desbloquear ${label}` : `Bloquear ${label}`}
            title={isLocked ? `Desbloquear ${label}` : `Bloquear ${label}`}
          >
            {isLocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </span>
      {effectiveReadOnly ? (
        <span className="flex h-9 items-center justify-center rounded-md bg-surface-strong px-2 text-center text-sm font-semibold text-ink">
          {formatNumber(value)}
        </span>
      ) : (
        <input
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          value={value ?? ''}
          onChange={(event) =>
            onChange(
              sanitizeCombatNumberInput(event.target.value, {
                allowDecimal,
                allowNegative,
              })
            )
          }
          className="archive-input h-9 rounded-md px-2 py-1 text-center text-sm font-semibold"
        />
      )}
    </div>
  )
}

function CombatNavCard({ to, icon, eyebrow, title, description, count }) {
  const CardIcon = icon

  return (
    <Link
      to={to}
      className="panel group grid min-h-56 gap-5 overflow-hidden border border-stroke p-5 transition hover:-translate-y-1 hover:border-brand/50 hover:shadow-glow"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <CardIcon className="h-6 w-6" />
        </span>
        <span className="archive-chip">{count}</span>
      </div>
      <div>
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold text-ink">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink-soft">{description}</p>
      </div>
      <div className="flex items-center gap-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand">
        Abrir
        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  )
}

function EmptyPanel({ icon, title, description, action }) {
  const PanelIcon = icon

  return (
    <div className="panel flex min-h-[18rem] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <PanelIcon className="h-7 w-7" />
      </span>
      <div>
        <h2 className="font-display text-3xl font-bold text-ink">{title}</h2>
        <p className="mt-2 max-w-lg text-sm leading-7 text-ink-soft">
          {description}
        </p>
      </div>
      {action}
    </div>
  )
}

function StatStrip({
  title,
  entries,
  values,
  formatter = formatNumber,
  editable = false,
  showAbilityModifier = false,
  allowNegative = false,
  onChange,
}) {
  return (
    <div className="grid gap-1.5">
      <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
        {title}
      </p>
      <div className="grid grid-cols-6 gap-1">
        {entries.map(([key, label]) => (
          <label
            key={key}
            className="rounded-md border border-stroke bg-surface-strong px-1.5 py-1 text-center"
          >
            <span className="block font-label text-[8px] font-black uppercase text-ink-muted">
              {label}
            </span>
            {editable ? (
              <span className="mt-0.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={values?.[key] ?? ''}
                  onChange={(event) =>
                    onChange(
                      key,
                      sanitizeCombatNumberInput(event.target.value, {
                        allowNegative,
                      })
                    )
                  }
                  className="h-6 min-w-0 rounded bg-white px-1 text-center text-xs font-black text-ink"
                />
                {showAbilityModifier ? (
                  <span className="rounded bg-brand/10 px-1 text-[10px] font-black text-brand">
                    {formatAbilityModifier(values?.[key])}
                  </span>
                ) : null}
              </span>
            ) : (
              <span
                className={cn(
                  'mt-0.5 flex min-h-6 items-center justify-center text-ink',
                  showAbilityModifier ? 'gap-1' : ''
                )}
              >
                <span className="text-sm font-black leading-none">
                  {formatter(values?.[key])}
                </span>
                {showAbilityModifier ? (
                  <span className="rounded bg-brand/10 px-1 text-[10px] font-black leading-5 text-brand">
                    {formatAbilityModifier(values?.[key])}
                  </span>
                ) : null}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}

function CombatStatsPanel({ session, statsOverride = null }) {
  const stats = statsOverride || calculateCombatStats(session)
  const createdAt = session?.createdAt || session?.creadoEn
  const finishedAt = session?.finishedAt || session?.finalizadoEn
  const items = [
    ['Daño total', stats.danoTotal],
    ['Curación total', stats.curacionTotal],
    ['Inconscientes', stats.inconscientes],
    ['Muertes', stats.muertes],
    ['Reanimaciones', stats.reanimaciones],
    ['Turnos registrados', stats.turnos],
  ]

  return (
    <div className="panel grid gap-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
            Estadísticas
          </p>
          <h2 className="font-display text-2xl font-bold text-ink">
            Resumen del combate
          </h2>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-stroke bg-surface-strong px-3 py-2">
          <p className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
            Creación
          </p>
          <p className="mt-1 text-sm font-black text-ink">
            {formatDateTime(createdAt)}
          </p>
        </div>
        <div className="rounded-lg border border-stroke bg-surface-strong px-3 py-2">
          <p className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
            Finalización
          </p>
          <p className="mt-1 text-sm font-black text-ink">
            {formatDateTime(finishedAt)}
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-stroke bg-surface-strong px-3 py-3 text-center"
          >
            <p className="font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-muted">
              {label}
            </p>
            <p className="mt-1 text-2xl font-black text-ink">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function getCombatMetrics(session, statsOverride = null) {
  const snapshot = session?.snapshot || session || {}
  const stats =
    statsOverride || session?.estadisticas || calculateCombatStats(snapshot)
  const combatants = snapshot.combatants || EMPTY_COMBATANTS

  return {
    stats,
    combatants,
    participantCount: combatants.length,
    unconsciousNow: combatants.filter(
      (combatant) => combatant.status === 'unconscious'
    ).length,
    deadNow: combatants.filter((combatant) => combatant.status === 'dead')
      .length,
    createdAt: snapshot.createdAt || session?.creadoEn,
    finishedAt: snapshot.finishedAt || session?.finalizadoEn,
  }
}

function CharacterSearch({
  isOpen,
  onToggle,
  query,
  setQuery,
  results,
  isLoading,
  error,
  onAdd,
  addingCharacterId,
  activeSession,
}) {
  const combatants = activeSession?.combatants || EMPTY_COMBATANTS
  const addedCounts = useMemo(() => {
    const counts = new Map()
    for (const combatant of combatants) {
      counts.set(
        combatant.characterId,
        (counts.get(combatant.characterId) || 0) + 1
      )
    }
    return counts
  }, [combatants])

  return (
    <div className="panel grid gap-4 border border-brand/20 p-4 sm:p-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
            Incorporar personajes
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">
            Buscador de personajes
          </h2>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-ink-muted transition',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen ? (
        <>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="archive-input h-12 rounded-lg pl-11"
              placeholder="Buscar personaje visible por nombre"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </div>
          ) : null}

          {query.trim().length >= 2 ? (
            <div className="grid gap-2">
              {isLoading ? (
                <div className="rounded-lg bg-surface-strong px-4 py-5 text-sm text-ink-soft">
                  Buscando personajes visibles...
                </div>
              ) : results.length ? (
                results.map((item) => {
                  const isPreviewOnly = item.modoVista === 'preview'
                  const addedCount = addedCounts.get(item.id) || 0
                  return (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-lg border border-stroke bg-white p-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <CharacterAvatar
                        item={item}
                        className="h-14 w-14"
                        linkTo={`/app/personajes/${item.id}`}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-ink">
                            {item.nombre}
                          </h3>
                          {isPreviewOnly ? (
                            <span className="archive-chip">Vista previa</span>
                          ) : null}
                          {addedCount ? (
                            <span className="archive-chip">x{addedCount}</span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-ink-soft">
                          {item.titulo || 'Sin título'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAdd(item)}
                        disabled={addingCharacterId === item.id}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Plus className="h-4 w-4" />
                        {addingCharacterId === item.id ? 'Cargando' : 'Añadir'}
                      </button>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-lg border border-dashed border-stroke bg-surface-strong px-4 py-5 text-sm text-ink-soft">
                  No hay personajes visibles con esa búsqueda.
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function CombatantCard({
  combatant,
  isCurrent,
  turnLabel,
  onUpdateField,
  onUpdateNestedField,
  onSetStatus,
  onRemove,
  onToggleCollapsed,
  onToggleNotes,
  readOnly = false,
}) {
  const status = combatant.status || 'active'
  const isDead = status === 'dead'
  const isUnconscious = status === 'unconscious'
  const linkTo = combatant.characterId
    ? `/app/personajes/${combatant.characterId}`
    : null
  const isCollapsed = Boolean(combatant.collapsed)
  const canEditManualStats = combatant.isCustom && !readOnly
  const displayName = getCombatantDisplayName(combatant)

  return (
    <article
      id={`combatant-${combatant.id}`}
      className={cn(
        'relative grid gap-4 rounded-lg border bg-white p-4 shadow-card transition lg:grid-cols-[4rem_minmax(0,1fr)]',
        isCurrent
          ? 'border-brand bg-brand/10 ring-4 ring-brand/25 shadow-glow'
          : 'border-stroke',
        isDead && 'opacity-75'
      )}
    >
      {isCurrent ? (
        <div className="flex justify-end lg:col-span-2">
          <span className="rounded-full bg-brand px-3 py-1 font-label text-[9px] font-black uppercase tracking-[0.18em] text-black shadow-card">
            Turno actual
          </span>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3 lg:block">
        <CharacterAvatar
          item={combatant}
          className="h-16 w-16"
          linkTo={linkTo}
        />
        {!readOnly ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-strong text-ink-muted transition hover:bg-danger hover:text-white lg:hidden"
            aria-label={`Quitar ${displayName}`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="min-w-0 grid gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {combatant.isCustom && !readOnly ? (
                <input
                  value={combatant.name || ''}
                  onChange={(event) =>
                    onUpdateField('name', event.target.value)
                  }
                  placeholder="Nombre del participante"
                  className="archive-input h-10 max-w-md rounded-md text-xl font-bold"
                />
              ) : (
                <h3 className="break-words font-display text-2xl font-bold text-ink [overflow-wrap:anywhere]">
                  {displayName}
                </h3>
              )}
              <span
                className={cn(
                  'archive-chip',
                  isDead
                    ? 'bg-danger/10 text-danger'
                    : isUnconscious
                      ? 'bg-warning/10 text-warning'
                      : 'bg-success/10 text-success'
                )}
              >
                {STATUS_LABELS[status]}
              </span>
              {turnLabel ? (
                <span className="archive-chip">{turnLabel}</span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-ink-soft">
              {combatant.title || combatant.campaignName || 'Sin subtítulo'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-ink-muted">
              <span className="inline-flex items-center gap-1 rounded-md border border-stroke bg-surface-strong px-2 py-1">
                <HeartPulse className="h-3.5 w-3.5 text-brand" />
                <span className="font-label text-[8px] font-black uppercase text-ink-muted">
                  PG base
                </span>
                <span className="font-black text-ink">
                  {formatNumber(combatant.originalMaxHitPoints)}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-stroke bg-surface-strong px-2 py-1">
                <Shield className="h-3.5 w-3.5 text-brand" />
                <span className="font-label text-[8px] font-black uppercase text-ink-muted">
                  CA base
                </span>
                <span className="font-black text-ink">
                  {formatNumber(combatant.originalArmorClass)}
                </span>
              </span>
              {combatant.initiativeRoll ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-brand/20 bg-brand/10 px-2 py-1 text-brand">
                  <span className="font-label text-[8px] font-black uppercase">
                    Iniciativa
                  </span>
                  <span className="font-black text-ink">
                    d20 {combatant.initiativeRoll}
                  </span>
                  <span className="text-ink-muted">+</span>
                  <span className="font-black text-ink">
                    mod. {formatModifier(combatant.initiativeBonus)}
                  </span>
                  <span className="text-ink-muted">=</span>
                  <span className="font-black text-brand">
                    {formatNumber(combatant.initiative)}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-surface-strong px-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white"
            >
              {isCollapsed ? (
                <ChevronsUpDown className="h-4 w-4" />
              ) : (
                <ChevronsDownUp className="h-4 w-4" />
              )}
              {isCollapsed ? 'Desplegar' : 'Plegar'}
            </button>
            {!readOnly ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onSetStatus(isUnconscious ? 'active' : 'unconscious')
                  }
                  className={cn(
                    'inline-flex h-9 items-center justify-center rounded-lg px-3 font-label text-[10px] font-black uppercase tracking-[0.16em] transition',
                    isUnconscious
                      ? 'bg-surface-strong text-ink-soft hover:bg-white'
                      : 'bg-warning/10 text-warning hover:bg-warning hover:text-black'
                  )}
                >
                  {isUnconscious ? 'Reactivar' : 'Inconsciente'}
                </button>
                <button
                  type="button"
                  onClick={() => onSetStatus(isDead ? 'active' : 'dead')}
                  className={cn(
                    'inline-flex h-9 items-center justify-center rounded-lg px-3 font-label text-[10px] font-black uppercase tracking-[0.16em] transition',
                    isDead
                      ? 'bg-surface-strong text-ink-soft hover:bg-white'
                      : 'bg-danger/10 text-danger hover:bg-danger hover:text-white'
                  )}
                >
                  {isDead ? 'Revivir' : 'Muerto'}
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="hidden h-9 w-9 items-center justify-center rounded-lg bg-surface-strong text-ink-muted transition hover:bg-danger hover:text-white lg:inline-flex"
                  aria-label={`Quitar ${displayName}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
        </div>

        {isCollapsed ? (
          <div className="grid gap-2 rounded-lg border border-stroke bg-surface-strong p-3 sm:grid-cols-4">
            <span className="text-sm font-semibold text-ink">
              PG {formatNumber(combatant.hitPoints)} /{' '}
              {formatNumber(combatant.maxHitPoints)}
            </span>
            <span className="text-sm font-semibold text-ink">
              Temp {formatNumber(combatant.temporaryHitPoints)}
            </span>
            <span className="text-sm font-semibold text-ink">
              CA {formatNumber(combatant.armorClass)}
            </span>
            <span className="text-sm font-semibold text-ink">
              {STATUS_LABELS[status]}
            </span>
          </div>
        ) : (
          <>
            {combatant.accesoRestringido ? (
              <div className="rounded-lg border border-dashed border-stroke bg-surface-strong px-4 py-5 text-sm font-semibold text-ink-soft">
                No puedes ver las estadísticas de este personaje en este
                combate.
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-brand/15 bg-brand/5 p-3">
                  <div className="grid gap-3 sm:grid-cols-5">
                    <CompactNumberField
                      label="Iniciativa"
                      value={combatant.initiative}
                      readOnly={readOnly}
                      allowDecimal
                      allowNegative
                      onChange={(value) => onUpdateField('initiative', value)}
                    />
                    <CompactNumberField
                      label="PG máx."
                      value={combatant.maxHitPoints}
                      readOnly={readOnly}
                      locked={!combatant.maxHitPointsUnlocked}
                      onToggleLock={() =>
                        onUpdateField(
                          'maxHitPointsUnlocked',
                          !combatant.maxHitPointsUnlocked
                        )
                      }
                      onChange={(value) => onUpdateField('maxHitPoints', value)}
                    />
                    <CompactNumberField
                      label="PG actuales"
                      value={combatant.hitPoints}
                      readOnly={readOnly}
                      onChange={(value) => onUpdateField('hitPoints', value)}
                    />
                    <CompactNumberField
                      label="PG temp"
                      value={combatant.temporaryHitPoints}
                      readOnly={readOnly}
                      onChange={(value) =>
                        onUpdateField('temporaryHitPoints', value)
                      }
                    />
                    <CompactNumberField
                      label="CA"
                      value={combatant.armorClass}
                      readOnly={readOnly}
                      locked={!combatant.armorClassUnlocked}
                      onToggleLock={() =>
                        onUpdateField(
                          'armorClassUnlocked',
                          !combatant.armorClassUnlocked
                        )
                      }
                      onChange={(value) => onUpdateField('armorClass', value)}
                    />
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  <StatStrip
                    title="Características"
                    entries={ABILITY_ENTRIES}
                    values={combatant.abilities}
                    editable={canEditManualStats}
                    showAbilityModifier
                    allowNegative={false}
                    onChange={(key, value) =>
                      onUpdateNestedField('abilities', key, value)
                    }
                  />
                  <StatStrip
                    title="Salvaciones"
                    entries={SAVE_ENTRIES}
                    values={combatant.saves}
                    formatter={formatModifier}
                    editable={canEditManualStats}
                    allowNegative
                    onChange={(key, value) =>
                      onUpdateNestedField('saves', key, value)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={onToggleNotes}
                    className="flex w-full items-center justify-between rounded-lg bg-surface-strong px-3 py-2 text-left text-sm font-semibold text-ink-soft transition hover:bg-white"
                  >
                    Anotaciones
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition',
                        combatant.notesOpen && 'rotate-180'
                      )}
                    />
                  </button>
                  {combatant.notesOpen ? (
                    readOnly ? (
                      <div className="min-h-20 rounded-lg bg-surface-strong px-4 py-3 text-sm leading-6 text-ink-soft">
                        {combatant.notes || 'Sin anotaciones.'}
                      </div>
                    ) : (
                      <textarea
                        value={combatant.notes || ''}
                        onChange={(event) =>
                          onUpdateField('notes', event.target.value)
                        }
                        className="archive-input min-h-28 rounded-lg"
                        placeholder="Anotaciones temporales del combate"
                      />
                    )
                  ) : null}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </article>
  )
}

function FinishCombatModal({ sessionName, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4 backdrop-blur-sm">
      <div className="panel w-full max-w-lg p-6 shadow-glow">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <Flag className="h-6 w-6" />
          </span>
          <div>
            <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-danger">
              Terminar combate
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">
              ¿Marcar como terminado?
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink-soft">
              "{sessionName}" pasará al historial de combates terminados en modo
              solo lectura.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-surface-strong px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-danger px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:brightness-95"
          >
            <Flag className="h-4 w-4" />
            Terminar
          </button>
        </div>
      </div>
    </div>
  )
}

function CombatSessionEditor({
  session,
  setCombatState,
  readOnly = false,
  showSearch = true,
  allowRename = !readOnly,
  statsOverride = null,
  onFinished,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [addingCharacterId, setAddingCharacterId] = useState(null)
  const [addError, setAddError] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(true)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [readOnlyUiState, setReadOnlyUiState] = useState({})

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  const combatants = useMemo(() => {
    const baseCombatants = session?.combatants || EMPTY_COMBATANTS
    if (!readOnly) {
      return baseCombatants
    }

    return baseCombatants.map((combatant) => ({
      ...combatant,
      ...(readOnlyUiState[combatant.id] || {}),
    }))
  }, [readOnly, readOnlyUiState, session?.combatants])
  const hideDead = Boolean(session?.hideDead)
  const sortedCombatants = useMemo(
    () => sortCombatants(combatants),
    [combatants]
  )
  const visibleCombatants = useMemo(
    () =>
      hideDead
        ? sortedCombatants.filter((combatant) => combatant.status !== 'dead')
        : sortedCombatants,
    [hideDead, sortedCombatants]
  )
  const livingTurnOrder = useMemo(() => getLivingTurnOrder(session), [session])
  const currentTurnIndex = Math.max(
    livingTurnOrder.findIndex(
      (combatant) => combatant.id === session?.activeTurnCombatantId
    ),
    0
  )
  const deadCount = sortedCombatants.filter(
    (combatant) => combatant.status === 'dead'
  ).length

  const characterSearch = useQuery({
    queryKey: ['combat-character-search', debouncedSearchQuery],
    queryFn: () => searchVisibleCharacters(debouncedSearchQuery),
    enabled: !readOnly && showSearch && debouncedSearchQuery.length >= 2,
  })

  function updateSession(updater) {
    if (!session || readOnly) {
      return
    }

    setCombatState((current) => ({
      ...current,
      sessions: current.sessions.map((item) =>
        item.id === session.id ? updater(item) : item
      ),
    }))
  }

  function renameSession(value) {
    if (!session || !allowRename || typeof setCombatState !== 'function') {
      return
    }

    setCombatState((current) => ({
      ...current,
      sessions: current.sessions.map((item) =>
        item.id === session.id ? { ...item, name: value } : item
      ),
    }))
  }

  function pushEvent(currentSession, event) {
    return {
      ...currentSession,
      events: [
        ...(currentSession.events || []),
        {
          id: createId(),
          at: new Date().toISOString(),
          ...event,
        },
      ],
    }
  }

  function updateCombatant(combatantId, updater) {
    updateSession((currentSession) => {
      let nextSession = currentSession
      const nextCombatants = currentSession.combatants.map((combatant) => {
        if (combatant.id !== combatantId) {
          return combatant
        }

        const nextCombatant = normalizeCombatant(updater(combatant))
        const previousHp = getNumberValue(combatant.hitPoints)
        const nextHp = getNumberValue(nextCombatant.hitPoints)

        if (previousHp !== null && nextHp !== null && previousHp !== nextHp) {
          nextSession = pushEvent(nextSession, {
            type: nextHp < previousHp ? 'damage' : 'healing',
            combatantId,
            combatantName: getCombatantDisplayName(combatant),
            amount: Math.abs(previousHp - nextHp),
          })
        }

        if (combatant.status !== nextCombatant.status) {
          const type =
            nextCombatant.status === 'unconscious'
              ? 'unconscious'
              : nextCombatant.status === 'dead'
                ? 'death'
                : combatant.status === 'dead' ||
                    combatant.status === 'unconscious'
                  ? 'revive'
                  : 'status'
          nextSession = pushEvent(nextSession, {
            type,
            combatantId,
            combatantName: getCombatantDisplayName(combatant),
            from: combatant.status,
            to: nextCombatant.status,
          })
        }

        return nextCombatant
      })

      return {
        ...nextSession,
        combatants: nextCombatants,
      }
    })
  }

  function updateNestedCombatantField(combatantId, group, key, value) {
    updateCombatant(combatantId, (combatant) => ({
      ...combatant,
      [group]: {
        ...(combatant[group] || {}),
        [key]: value,
      },
    }))
  }

  async function addCharacterToSession(item) {
    if (!session || readOnly) {
      return
    }

    if (item.modoVista === 'preview') {
      setAddError(
        'Ese personaje solo está en vista previa; sus estadísticas no se pueden cargar en combate.'
      )
      return
    }

    setAddingCharacterId(item.id)
    setAddError('')

    try {
      const character = await fetchCharacterDetail(item.id)
      if (character.modoVista === 'preview') {
        throw new Error(
          'Ese personaje solo está en vista previa; sus estadísticas no se pueden cargar en combate.'
        )
      }

      const combatant = createCombatantFromCharacter(character)
      updateSession((currentSession) => ({
        ...currentSession,
        activeTurnCombatantId:
          currentSession.activeTurnCombatantId || combatant.id,
        combatants: [...currentSession.combatants, combatant],
      }))
    } catch (error) {
      setAddError(
        error?.response?.data?.message ||
          error?.message ||
          'No se pudo añadir el personaje al combate.'
      )
    } finally {
      setAddingCharacterId(null)
    }
  }

  function addCustomCombatant() {
    const combatant = createCustomCombatant()
    updateSession((currentSession) => ({
      ...currentSession,
      activeTurnCombatantId:
        currentSession.activeTurnCombatantId || combatant.id,
      combatants: [...currentSession.combatants, combatant],
    }))
    scrollToCombatant(combatant.id)
  }

  function removeCombatant(combatantId) {
    updateSession((currentSession) => {
      const nextCombatants = currentSession.combatants.filter(
        (combatant) => combatant.id !== combatantId
      )
      return {
        ...currentSession,
        activeTurnCombatantId:
          currentSession.activeTurnCombatantId === combatantId
            ? nextCombatants[0]?.id || null
            : currentSession.activeTurnCombatantId,
        combatants: nextCombatants,
      }
    })
  }

  const changeTurn = useCallback(
    (direction) => {
      if (!session || readOnly || typeof setCombatState !== 'function') {
        return
      }

      const movement = getTurnMovement(session, direction)
      if (!movement?.nextCombatant) {
        return
      }

      setCombatState((current) => ({
        ...current,
        sessions: current.sessions.map((item) =>
          item.id === session.id ? applyTurnChange(item, direction) : item
        ),
      }))
      scrollToCombatant(movement.nextCombatant.id)
    },
    [readOnly, session, setCombatState]
  )

  function nextTurn() {
    changeTurn(1)
  }

  function previousTurn() {
    changeTurn(-1)
  }

  useEffect(() => {
    if (readOnly) {
      return undefined
    }

    function handleKeyDown(event) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableShortcutTarget(event.target)
      ) {
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        changeTurn(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        changeTurn(-1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [changeTurn, readOnly])

  function rollInitiative() {
    if (!session || readOnly) {
      return
    }

    let firstCombatantId = null
    updateSession((currentSession) => {
      const nextCombatants = currentSession.combatants.map((combatant) => {
        const roll = Math.floor(Math.random() * 20) + 1
        const bonus = getNumberValue(combatant.initiativeBonus) || 0
        const total = Number((roll + bonus).toFixed(2))

        return {
          ...combatant,
          initiativeRoll: roll,
          initiative: total,
        }
      })
      const nextOrder = sortCombatants(nextCombatants).filter(
        (combatant) => combatant.status !== 'dead'
      )
      firstCombatantId = nextOrder[0]?.id || null

      return {
        ...currentSession,
        round: 1,
        turnCount: 0,
        activeTurnCombatantId: nextOrder[0]?.id || null,
        combatants: nextCombatants,
      }
    })
    scrollToCombatant(firstCombatantId)
  }

  function finishCombat() {
    if (!session || readOnly) {
      return
    }

    setCombatState((current) => {
      const nextActive = current.sessions.find(
        (item) => item.id !== session.id && item.status !== 'finished'
      )

      return {
        sessions: current.sessions.map((item) =>
          item.id === session.id
            ? {
                ...item,
                status: 'finished',
                finishedAt: new Date().toISOString(),
              }
            : item
        ),
        activeSessionId:
          current.activeSessionId === session.id
            ? nextActive?.id || null
            : current.activeSessionId,
      }
    })
    setShowFinishModal(false)
    onFinished?.()
  }

  function setAllCollapsed(collapsed) {
    if (readOnly) {
      setReadOnlyUiState((current) => {
        const next = { ...current }
        for (const combatant of combatants) {
          next[combatant.id] = {
            ...(next[combatant.id] || {}),
            collapsed,
          }
        }
        return next
      })
      return
    }

    updateSession((currentSession) => ({
      ...currentSession,
      combatants: currentSession.combatants.map((combatant) => ({
        ...combatant,
        collapsed,
      })),
    }))
  }

  function toggleReadOnlyCombatantField(combatantId, field) {
    setReadOnlyUiState((current) => ({
      ...current,
      [combatantId]: {
        ...(current[combatantId] || {}),
        [field]: !(
          current[combatantId]?.[field] ??
          combatants.find((combatant) => combatant.id === combatantId)?.[field]
        ),
      },
    }))
  }

  if (!session) {
    return null
  }

  return (
    <div className="grid min-w-0 gap-5">
      {!readOnly ? (
        <button
          type="button"
          onClick={nextTurn}
          disabled={!livingTurnOrder.length}
          className="fixed bottom-6 left-4 z-30 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black shadow-card transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 lg:left-[calc(var(--left-rail-width)+1rem)] xl:left-[calc(var(--left-rail-width)+2rem)]"
          title="Pasar turno (flecha derecha)"
        >
          <ChevronRight className="h-4 w-4" />
          Turno
        </button>
      ) : null}

      <div className="panel grid gap-4 border border-brand/15 p-4 sm:p-5">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="min-w-0">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              {readOnly
                ? session.finishedAt
                  ? `Terminado ${new Date(session.finishedAt).toLocaleString()}`
                  : 'Combate terminado'
                : `Asalto ${session.round || 1} - Turno ${
                    livingTurnOrder.length ? currentTurnIndex + 1 : 0
                  }/${livingTurnOrder.length}`}
            </p>
            {allowRename ? (
              <input
                value={session.name || ''}
                onChange={(event) => renameSession(event.target.value)}
                className="archive-input mt-1 h-12 max-w-2xl rounded-lg font-display text-3xl font-bold"
                placeholder="Nombre del combate"
              />
            ) : (
              <h2 className="mt-1 break-words font-display text-3xl font-bold text-ink [overflow-wrap:anywhere]">
                {session.name}
              </h2>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-soft">
              <span className="archive-chip">
                {sortedCombatants.length} participantes
              </span>
              <span className="archive-chip">{deadCount} muertos</span>
              {readOnly ? (
                <span className="archive-chip">Solo lectura</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!readOnly ? (
              <>
                <button
                  type="button"
                  onClick={previousTurn}
                  disabled={!livingTurnOrder.length}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-surface-strong px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  title="Turno anterior (flecha izquierda)"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Turno anterior
                </button>
                <button
                  type="button"
                  onClick={rollInitiative}
                  disabled={!sortedCombatants.length}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Swords className="h-4 w-4" />
                  Lanzar iniciativa
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateSession((currentSession) => ({
                      ...currentSession,
                      hideDead: !currentSession.hideDead,
                    }))
                  }
                  className={cn(
                    'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] transition',
                    session.hideDead
                      ? 'bg-danger/10 text-danger hover:bg-danger hover:text-white'
                      : 'bg-surface-strong text-ink-soft hover:bg-white'
                  )}
                >
                  <Skull className="h-4 w-4" />
                  {session.hideDead ? 'Mostrar muertos' : 'Ocultar muertos'}
                </button>
                <button
                  type="button"
                  onClick={() => setAllCollapsed(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-surface-strong px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white"
                >
                  <ChevronsDownUp className="h-4 w-4" />
                  Plegar
                </button>
                <button
                  type="button"
                  onClick={() => setAllCollapsed(false)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-surface-strong px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white"
                >
                  <ChevronsUpDown className="h-4 w-4" />
                  Desplegar
                </button>
                <button
                  type="button"
                  onClick={() => setShowFinishModal(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-danger/10 px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:bg-danger hover:text-white"
                >
                  <Flag className="h-4 w-4" />
                  Terminar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAllCollapsed(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-surface-strong px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white"
                >
                  <ChevronsDownUp className="h-4 w-4" />
                  Plegar todo
                </button>
                <button
                  type="button"
                  onClick={() => setAllCollapsed(false)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-surface-strong px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white"
                >
                  <ChevronsUpDown className="h-4 w-4" />
                  Desplegar todo
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {!readOnly && showSearch ? (
        <CharacterSearch
          isOpen={isSearchOpen}
          onToggle={() => setIsSearchOpen((value) => !value)}
          query={searchQuery}
          setQuery={(value) => {
            setSearchQuery(value)
            setAddError('')
          }}
          results={characterSearch.data || []}
          isLoading={characterSearch.isFetching}
          error={addError}
          onAdd={addCharacterToSession}
          addingCharacterId={addingCharacterId}
          activeSession={session}
        />
      ) : null}

      {readOnly ? (
        <CombatStatsPanel session={session} statsOverride={statsOverride} />
      ) : null}

      <div className="grid gap-3">
        {visibleCombatants.length ? (
          visibleCombatants.map((combatant) => (
            <CombatantCard
              key={combatant.id}
              combatant={combatant}
              readOnly={readOnly}
              isCurrent={
                combatant.id === session.activeTurnCombatantId && !readOnly
              }
              turnLabel={
                combatant.id === session.activeTurnCombatantId && !readOnly
                  ? `Turno ${currentTurnIndex + 1}`
                  : null
              }
              onUpdateField={(field, value) =>
                updateCombatant(combatant.id, (current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              onUpdateNestedField={(group, key, value) =>
                updateNestedCombatantField(combatant.id, group, key, value)
              }
              onSetStatus={(status) =>
                updateCombatant(combatant.id, (current) => ({
                  ...current,
                  status,
                }))
              }
              onRemove={() => removeCombatant(combatant.id)}
              onToggleCollapsed={() =>
                readOnly
                  ? toggleReadOnlyCombatantField(combatant.id, 'collapsed')
                  : updateCombatant(combatant.id, (current) => ({
                      ...current,
                      collapsed: !current.collapsed,
                    }))
              }
              onToggleNotes={() =>
                readOnly
                  ? toggleReadOnlyCombatantField(combatant.id, 'notesOpen')
                  : updateCombatant(combatant.id, (current) => ({
                      ...current,
                      notesOpen: !current.notesOpen,
                    }))
              }
            />
          ))
        ) : (
          <EmptyPanel
            icon={HeartPulse}
            title="Sin participantes visibles"
            description={
              readOnly
                ? 'Este combate terminado no tiene participantes registrados.'
                : 'Añade personajes desde el buscador o muestra los muertos si el combate los está ocultando.'
            }
          />
        )}

        {!readOnly ? (
          <button
            type="button"
            onClick={addCustomCombatant}
            className="panel flex items-center justify-center gap-3 border border-dashed border-brand/40 p-5 font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand transition hover:border-brand hover:bg-brand/10"
          >
            <Bot className="h-5 w-5" />
            Añadir participante manual
          </button>
        ) : null}
      </div>

      {showFinishModal ? (
        <FinishCombatModal
          sessionName={session.name}
          onCancel={() => setShowFinishModal(false)}
          onConfirm={finishCombat}
        />
      ) : null}
    </div>
  )
}

function CombatPreviewCard({ session, to, actions }) {
  const {
    stats,
    participantCount,
    unconsciousNow,
    deadNow,
    createdAt,
    finishedAt,
  } = getCombatMetrics(session)

  return (
    <article className="panel grid gap-4 border border-stroke p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
            {session.status === 'finished' ? 'Terminado' : 'Activo'}
          </p>
          <h2 className="mt-1 break-words font-display text-3xl font-bold text-ink [overflow-wrap:anywhere]">
            {session.name}
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            {participantCount} participantes - Asalto {session.round || 1}
          </p>
        </div>
        <span className="archive-chip">{stats.danoTotal} daño</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <span className="rounded-lg bg-surface-strong px-3 py-2 text-sm font-semibold text-ink-soft">
          Inconscientes: {unconsciousNow}
        </span>
        <span className="rounded-lg bg-surface-strong px-3 py-2 text-sm font-semibold text-ink-soft">
          Muertos: {deadNow}
        </span>
        <span className="rounded-lg bg-surface-strong px-3 py-2 text-sm font-semibold text-ink-soft">
          Caídas: {stats.inconscientes}
        </span>
        <span className="rounded-lg bg-surface-strong px-3 py-2 text-sm font-semibold text-ink-soft">
          Reanimaciones: {stats.reanimaciones}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
        <span className="archive-chip">Creado {formatDateTime(createdAt)}</span>
        {finishedAt ? (
          <span className="archive-chip">
            Finalizado {formatDateTime(finishedAt)}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to={to}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95"
        >
          <Eye className="h-4 w-4" />
          Abrir
        </Link>
        {actions}
      </div>
    </article>
  )
}

function AssignmentPanel({ combat, onAssigned }) {
  const queryClient = useQueryClient()
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const campaignsQuery = useQuery({
    queryKey: ['combat-assign-campaigns'],
    queryFn: fetchCampaigns,
  })
  const availableCampaigns = (campaignsQuery.data || []).filter(
    (campaign) => campaign.esMiembro || campaign.puedeGestionar
  )

  const campaignQuery = useQuery({
    queryKey: ['combat-assign-campaign', selectedCampaignId],
    queryFn: () => fetchCampaignDetail(selectedCampaignId),
    enabled: Boolean(selectedCampaignId),
  })
  const sessions = campaignQuery.data?.partidas || []

  async function handleAssign() {
    if (!selectedCampaignId || !selectedSessionId) {
      setError('Elige una campaña y una partida.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const item = await assignCombatToSession({
        campaignId: selectedCampaignId,
        sessionId: selectedSessionId,
        combat,
      })
      await queryClient.invalidateQueries({
        queryKey: [
          'campaign-session-detail',
          selectedCampaignId,
          selectedSessionId,
        ],
      })
      onAssigned?.({
        campaignId: selectedCampaignId,
        sessionId: selectedSessionId,
        item,
      })
    } catch (assignError) {
      setError(
        assignError?.response?.data?.message ||
          'No se pudo asociar el combate a la partida.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="panel grid gap-4 p-4 sm:p-5">
      <div>
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
          Asociar a partida
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink">
          Publicar resumen del combate
        </h2>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">Campaña</span>
          <select
            value={selectedCampaignId}
            onChange={(event) => {
              setSelectedCampaignId(event.target.value)
              setSelectedSessionId('')
            }}
            className="archive-input h-11 rounded-lg"
          >
            <option value="">Selecciona campaña</option>
            {availableCampaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">Partida</span>
          <select
            value={selectedSessionId}
            onChange={(event) => setSelectedSessionId(event.target.value)}
            className="archive-input h-11 rounded-lg"
            disabled={!selectedCampaignId}
          >
            <option value="">Selecciona partida</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.nombre}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={handleAssign}
          disabled={isSaving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Guardando' : 'Asociar'}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}
    </div>
  )
}

export function CombatManagerPage() {
  const { combatState } = useCombatStore()
  const activeCount = combatState.sessions.filter(
    (session) => session.status !== 'finished'
  ).length
  const finishedCount = combatState.sessions.filter(
    (session) => session.status === 'finished'
  ).length

  return (
    <CombatPageFrame
      eyebrow="Herramientas de Juego"
      title="Gestor de Combate"
      description="Tus combates se guardan solo en este navegador y separados por usuario. No se comparten con el resto de la web salvo que asocies un terminado a una partida."
      showBack={false}
    >
      <div className="grid gap-5 xl:grid-cols-3">
        <CombatNavCard
          to={COMBAT_FINISHED_PATH}
          icon={Archive}
          eyebrow="Historial"
          title="Combates terminados"
          description="Consulta, borra o asocia combates cerrados a partidas."
          count={finishedCount}
        />
        <CombatNavCard
          to={COMBAT_ACTIVE_PATH}
          icon={ListChecks}
          eyebrow="Mesa abierta"
          title="Combates activos"
          description="Revisa previews y abre cada combate en su propia vista activa."
          count={activeCount}
        />
        <CombatNavCard
          to={COMBAT_START_PATH}
          icon={Plus}
          eyebrow="Nueva escena"
          title="Iniciar combate"
          description="Crea una sesión temporal y añade personajes visibles desde el buscador."
          count="Nuevo"
        />
      </div>
    </CombatPageFrame>
  )
}

export function CombatStartPage() {
  const navigate = useNavigate()
  const { combatState, setCombatState } = useCombatStore()
  const [sessionName, setSessionName] = useState('')
  const [startedSessionId, setStartedSessionId] = useState(
    combatState.activeSessionId
  )
  const startedSession =
    combatState.sessions.find((session) => session.id === startedSessionId) ||
    null

  function handleCreateSession() {
    const nextSession = createCombatSession(sessionName)

    setCombatState((current) => ({
      sessions: [nextSession, ...current.sessions],
      activeSessionId: nextSession.id,
    }))
    setStartedSessionId(nextSession.id)
    setSessionName('')
    navigate(`${COMBAT_ACTIVE_PATH}/${nextSession.id}`, { replace: true })
  }

  return (
    <CombatPageFrame
      eyebrow="Gestor de Combate"
      title="Iniciar combate"
      description="Crea un combate temporal. Al crearlo queda como combate activo, pero esta vista no muestra la lista lateral de otros combates."
    >
      {!startedSession ? (
        <div className="panel grid gap-4 border border-brand/20 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
              Nueva sesión
            </p>
            <label className="mt-3 grid gap-2">
              <span className="text-sm font-semibold text-ink">
                Nombre del combate
              </span>
              <input
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleCreateSession()
                  }
                }}
                className="archive-input h-11 rounded-lg"
                placeholder="Ej. Asalto en la cripta"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleCreateSession}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95"
          >
            <Plus className="h-4 w-4" />
            Crear combate
          </button>
        </div>
      ) : null}

      {startedSession ? (
        <CombatSessionEditor
          session={startedSession}
          setCombatState={setCombatState}
          showSearch
        />
      ) : (
        <EmptyPanel
          icon={Swords}
          title="Todavía no has iniciado este combate"
          description="Ponle nombre y créalo para empezar a añadir personajes visibles."
        />
      )}
    </CombatPageFrame>
  )
}

export function ActiveCombatsPage() {
  const { combatState, setCombatState } = useCombatStore()
  const activeSessions = useMemo(
    () =>
      combatState.sessions.filter((session) => session.status !== 'finished'),
    [combatState.sessions]
  )

  function discardActiveSession(sessionId) {
    setCombatState((current) => {
      const nextSessions = current.sessions.filter(
        (session) => session.id !== sessionId
      )
      const nextActive =
        current.activeSessionId === sessionId
          ? nextSessions.find((session) => session.status !== 'finished')?.id ||
            null
          : current.activeSessionId

      return {
        sessions: nextSessions,
        activeSessionId: nextActive,
      }
    })
  }

  return (
    <CombatPageFrame
      eyebrow="Gestor de Combate"
      title="Combates activos"
      description="Aquí aparecen los combates que todavía no has marcado como terminados."
    >
      {activeSessions.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {activeSessions.map((session) => (
            <CombatPreviewCard
              key={session.id}
              session={session}
              to={`${COMBAT_ACTIVE_PATH}/${session.id}`}
              actions={
                <>
                  <Link
                    to={`${COMBAT_ACTIVE_PATH}/${session.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-surface-strong px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Nueva pestaña
                  </Link>
                  <button
                    type="button"
                    onClick={() => discardActiveSession(session.id)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-danger/10 px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:bg-danger hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                    Descartar
                  </button>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyPanel
          icon={Clock}
          title="No hay combates activos"
          description="Inicia un combate para preparar iniciativa, PG y turnos."
          action={
            <Link
              to={COMBAT_START_PATH}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95"
            >
              <Plus className="h-4 w-4" />
              Iniciar combate
            </Link>
          }
        />
      )}
    </CombatPageFrame>
  )
}

export function ActiveCombatDetailPage() {
  const navigate = useNavigate()
  const { combatId } = useParams()
  const { combatState, setCombatState } = useCombatStore()
  const session =
    combatState.sessions.find(
      (item) => item.id === combatId && item.status !== 'finished'
    ) || null

  function discardActiveSession() {
    if (!session) {
      return
    }

    setCombatState((current) => {
      const nextSessions = current.sessions.filter(
        (item) => item.id !== session.id
      )
      return {
        sessions: nextSessions,
        activeSessionId:
          current.activeSessionId === session.id
            ? nextSessions.find((item) => item.status !== 'finished')?.id ||
              null
            : current.activeSessionId,
      }
    })
    navigate(COMBAT_ACTIVE_PATH)
  }

  return (
    <CombatPageFrame
      eyebrow="Combate activo"
      title={session?.name || 'Combate no encontrado'}
      description="Vista activa para jugar el combate y modificar sus valores temporales."
    >
      {session ? (
        <div className="grid gap-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={discardActiveSession}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-danger/10 px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:bg-danger hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Descartar combate
            </button>
          </div>
          <CombatSessionEditor
            session={session}
            setCombatState={setCombatState}
            showSearch
            onFinished={() => navigate(COMBAT_FINISHED_PATH)}
          />
        </div>
      ) : (
        <EmptyPanel
          icon={Clock}
          title="Combate no disponible"
          description="Puede que haya sido terminado o borrado en este navegador."
          action={
            <Link
              to={COMBAT_ACTIVE_PATH}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95"
            >
              Ver activos
            </Link>
          }
        />
      )}
    </CombatPageFrame>
  )
}

export function FinishedCombatsPage() {
  const { combatState, setCombatState } = useCombatStore()
  const finishedSessions = useMemo(
    () =>
      combatState.sessions.filter((session) => session.status === 'finished'),
    [combatState.sessions]
  )

  function deleteFinishedSession(sessionId) {
    setCombatState((current) => ({
      ...current,
      sessions: current.sessions.filter((session) => session.id !== sessionId),
    }))
  }

  return (
    <CombatPageFrame
      eyebrow="Gestor de Combate"
      title="Combates terminados"
      description="Consulta combates cerrados, revisa sus estadísticas o asócialos a una partida."
    >
      {finishedSessions.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {finishedSessions.map((session) => (
            <CombatPreviewCard
              key={session.id}
              session={session}
              to={`${COMBAT_FINISHED_PATH}/${session.id}`}
              actions={
                <button
                  type="button"
                  onClick={() => deleteFinishedSession(session.id)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-danger/10 px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:bg-danger hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  Borrar
                </button>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyPanel
          icon={Archive}
          title="No hay combates terminados"
          description="Cuando marques un combate como terminado aparecerá aquí en modo solo lectura."
          action={
            <Link
              to={COMBAT_ACTIVE_PATH}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-surface-strong px-5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white"
            >
              Ver activos
              <ChevronRight className="h-4 w-4" />
            </Link>
          }
        />
      )}
    </CombatPageFrame>
  )
}

export function FinishedCombatDetailPage() {
  const navigate = useNavigate()
  const { combatId } = useParams()
  const { combatState, setCombatState } = useCombatStore()
  const session =
    combatState.sessions.find(
      (item) => item.id === combatId && item.status === 'finished'
    ) || null

  function deleteFinishedSession() {
    if (!session) {
      return
    }

    setCombatState((current) => ({
      ...current,
      sessions: current.sessions.filter((item) => item.id !== session.id),
    }))
    navigate(COMBAT_FINISHED_PATH)
  }

  function markAssigned({ campaignId, sessionId, item }) {
    setCombatState((current) => ({
      ...current,
      sessions: current.sessions.map((storedSession) =>
        storedSession.id === session.id
          ? {
              ...storedSession,
              assignedCombats: [
                ...(storedSession.assignedCombats || []),
                { campaignId, sessionId, combatId: item.id },
              ],
            }
          : storedSession
      ),
    }))
  }

  return (
    <CombatPageFrame
      eyebrow="Combate terminado"
      title={session?.name || 'Combate no encontrado'}
      description="Ficha resumen de un combate cerrado."
    >
      {session ? (
        <div className="grid gap-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={deleteFinishedSession}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-danger/10 px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:bg-danger hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Borrar terminado
            </button>
          </div>
          <AssignmentPanel combat={session} onAssigned={markAssigned} />
          <CombatSessionEditor
            session={session}
            setCombatState={setCombatState}
            readOnly
            allowRename
            showSearch={false}
          />
        </div>
      ) : (
        <EmptyPanel
          icon={Archive}
          title="Combate no disponible"
          description="Puede que se haya borrado de este navegador."
          action={
            <Link
              to={COMBAT_FINISHED_PATH}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95"
            >
              Ver terminados
            </Link>
          }
        />
      )}
    </CombatPageFrame>
  )
}

function SessionCombatPreviewCard({
  combat,
  to,
  canManage,
  onRemove,
  removing,
}) {
  const snapshot = combat.snapshot || {}
  const {
    stats,
    participantCount,
    unconsciousNow,
    deadNow,
    createdAt,
    finishedAt,
  } = getCombatMetrics(combat, combat.estadisticas)

  return (
    <article className="panel grid gap-4 border border-stroke p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
            Combate asociado
          </p>
          <h2 className="mt-1 break-words font-display text-3xl font-bold text-ink [overflow-wrap:anywhere]">
            {combat.nombre || snapshot.name || 'Combate'}
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Creado {formatDateTime(createdAt)}
            {finishedAt ? ` - Finalizado ${formatDateTime(finishedAt)}` : ''}
          </p>
        </div>
        <span className="archive-chip">{stats.danoTotal} daño total</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <span className="rounded-lg bg-surface-strong px-3 py-2 text-sm font-semibold text-ink-soft">
          Participantes: {participantCount}
        </span>
        <span className="rounded-lg bg-surface-strong px-3 py-2 text-sm font-semibold text-ink-soft">
          Inconscientes: {unconsciousNow}
        </span>
        <span className="rounded-lg bg-surface-strong px-3 py-2 text-sm font-semibold text-ink-soft">
          Muertos: {deadNow}
        </span>
        <span className="rounded-lg bg-surface-strong px-3 py-2 text-sm font-semibold text-ink-soft">
          Reanimaciones: {stats.reanimaciones}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to={to}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95"
        >
          <Eye className="h-4 w-4" />
          Ver detalle
        </Link>
        {canManage ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-danger/10 px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:bg-danger hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Quitar
          </button>
        ) : null}
      </div>
    </article>
  )
}

export function SessionCombatList({
  session,
  canManage,
  campaignId,
  sessionId,
}) {
  const queryClient = useQueryClient()
  const [removingId, setRemovingId] = useState('')
  const combats = useMemo(
    () =>
      [...(session?.combates || [])].sort((left, right) => {
        const leftDate = getTimeValue(left.snapshot?.createdAt || left.creadoEn)
        const rightDate = getTimeValue(
          right.snapshot?.createdAt || right.creadoEn
        )
        return rightDate - leftDate
      }),
    [session?.combates]
  )

  async function handleRemove(combatId) {
    setRemovingId(combatId)
    try {
      await deleteAssignedCombat({ campaignId, sessionId, combatId })
      await queryClient.invalidateQueries({
        queryKey: ['campaign-session-detail', campaignId, sessionId],
      })
    } finally {
      setRemovingId('')
    }
  }

  if (!combats.length) {
    return (
      <EmptyPanel
        icon={Swords}
        title="Sin combates asociados"
        description="Los combates terminados que se asocien a esta partida aparecerán aquí."
      />
    )
  }

  return (
    <div className="grid gap-5">
      {combats.map((combat) => (
        <SessionCombatPreviewCard
          key={combat.id}
          combat={combat}
          to={`/app/campanas/${campaignId}/partidas/${sessionId}/combates/${combat.id}`}
          canManage={canManage}
          onRemove={() => handleRemove(combat.id)}
          removing={removingId === combat.id}
        />
      ))}
    </div>
  )
}

export function SessionCombatDetailPage() {
  const { campaignId, sessionId, combatId } = useParams()
  const sessionQuery = useQuery({
    queryKey: ['campaign-session-detail', campaignId, sessionId],
    queryFn: () => fetchCampaignSessionDetail(campaignId, sessionId),
  })
  const session = sessionQuery.data
  const combat = useMemo(
    () =>
      (session?.combates || []).find((item) => item.id === combatId) || null,
    [combatId, session?.combates]
  )
  const snapshot = combat
    ? normalizeSession({
        ...(combat.snapshot || {}),
        name: combat.nombre || combat.snapshot?.name || 'Combate',
        combatants: (combat.snapshot?.combatants || []).map((combatant) => ({
          ...combatant,
          collapsed: false,
          notesOpen: Boolean(combatant.notes),
        })),
      })
    : null

  return (
    <CombatPageFrame
      eyebrow="Combate asociado"
      title={combat?.nombre || 'Combate'}
      description="Ficha detalle del combate asociado a esta partida."
      backTo={`/app/campanas/${campaignId}/partidas/${sessionId}?tab=combates`}
    >
      {sessionQuery.isLoading ? (
        <div className="panel h-72 animate-pulse bg-white/70" />
      ) : combat && snapshot ? (
        <div className="grid gap-5">
          <CombatSessionEditor
            session={snapshot}
            setCombatState={() => {}}
            readOnly
            showSearch={false}
            allowRename={false}
            statsOverride={combat.estadisticas}
          />
        </div>
      ) : (
        <EmptyPanel
          icon={Archive}
          title="Combate no disponible"
          description="Puede que se haya quitado de esta partida o que no tengas permisos para verlo."
          action={
            <Link
              to={`/app/campanas/${campaignId}/partidas/${sessionId}?tab=combates`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-95"
            >
              Volver a combates
            </Link>
          }
        />
      )}
    </CombatPageFrame>
  )
}
