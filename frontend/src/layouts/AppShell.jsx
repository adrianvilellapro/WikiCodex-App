import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  FolderOpen,
  Gamepad2,
  GraduationCap,
  Home,
  Info,
  LogOut,
  MapPinned,
  Menu,
  Moon,
  Palette,
  Plus,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Sword,
  Swords,
  Sun,
  UserCircle2,
  WandSparkles,
  X,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { isDemoMode } from '../demo/config'
import { useAuth } from '../features/auth/auth-context'
import { useTheme } from '../features/theme/theme-context'
import { cn } from '../lib/cn'
import { FAVORITES_UPDATED_EVENT, fetchFavorites } from '../services/favorites'
import { fetchGlobalSearch } from '../services/global-search'
import { api } from '../services/http'
import {
  getRecentActivity,
  RECENT_ACTIVITY_EVENT,
} from '../services/recent-activity'

const primaryLinks = [
  { to: '/app', label: 'Inicio', icon: Home, end: true },
  { to: '/app/personajes', label: 'Personajes', icon: UserCircle2 },
  { to: '/app/objetos', label: 'Objetos', icon: Sword },
  { to: '/app/lugares', label: 'Lugares', icon: MapPinned },
  { to: '/app/poderes', label: 'Poderes', icon: Sparkles },
  { to: '/app/clases', label: 'Clases y Dotes', icon: GraduationCap },
  { to: '/app/campanas', label: 'Campañas', icon: BookOpen },
]

const rulesLink = {
  to: '/app/reglamento',
  label: 'Reglamento y Recursos',
  icon: ScrollText,
}

const adminLinks = [
  { to: '/app/administracion', label: 'Administración', icon: Shield },
]

const gameToolLinks = [
  { to: '/app/herramientas/combate', label: 'Gestor de Combate', icon: Swords },
  {
    to: '/app/herramientas/hechizos',
    label: 'Gestor de Hechizos',
    icon: WandSparkles,
  },
  { to: '/app/herramientas/bossrush', label: 'BossRush', icon: Crown },
]

const gameToolsGroup = {
  label: 'Herramientas de Juego',
  icon: Gamepad2,
  items: gameToolLinks,
}

const createOptions = [
  ['Crear Personaje', '/app/personajes/nuevo', true],
  ['Crear Objeto', '/app/objetos/nuevo', true],
  ['Crear Lugar', '/app/lugares/nuevo', true],
  [
    'Crear Poder',
    '/app/poderes',
    true,
    [
      ['Crear Hechizo', '/app/poderes/hechizos/nuevo', BookOpen],
      ['Crear Otro Poder', '/app/poderes/otros/nuevo', Sparkles],
    ],
  ],
  [
    'Crear Clase/Dote',
    '/app/clases',
    true,
    [
      ['Crear Clase', '/app/clases/nuevo', GraduationCap],
      ['Crear Dote', '/app/clases/dotes/nuevo', ScrollText],
    ],
  ],
  ['Crear Campaña', '/app/campanas/nuevo', true],
]
const READING_MODE_STORAGE_KEY = 'wikicodex:reading-mode'
const READING_LEFT_STORAGE_KEY = 'wikicodex:reading-left-hidden'
const READING_RIGHT_STORAGE_KEY = 'wikicodex:reading-right-hidden'
const NOTIFICATION_POLL_INTERVAL_MS = 60 * 1000
const VISUAL_PALETTE_SWATCHES = [
  '#026b00',
  '#0f766e',
  '#2563eb',
  '#b45309',
  '#be123c',
  '#7c3aed',
]
const QUICK_NAV_BASE_STORAGE_KEY = 'wikicodex:quick-nav'
const FAVORITES_DISPLAY_BASE_STORAGE_KEY = 'wikicodex:favorites-display'
const RIGHT_RAIL_SECTIONS_BASE_STORAGE_KEY = 'wikicodex:right-rail-sections'
const QUICK_NAV_OPTIONS = [
  { to: '/app', label: 'Inicio', icon: Home, end: true },
  { to: '/app/personajes', label: 'Personajes', icon: UserCircle2 },
  { to: '/app/objetos', label: 'Objetos', icon: Sword },
  { to: '/app/lugares', label: 'Lugares', icon: MapPinned },
  { to: '/app/poderes', label: 'Poderes', icon: Sparkles },
  { to: '/app/clases', label: 'Clases y Dotes', icon: GraduationCap },
  { to: '/app/herramientas', label: 'Herramientas', icon: Gamepad2 },
  { to: '/app/herramientas/combate', label: 'Gestor combate', icon: Swords },
  {
    to: '/app/herramientas/hechizos',
    label: 'Gestor hechizos',
    icon: WandSparkles,
  },
  { to: '/app/herramientas/bossrush', label: 'BossRush', icon: Crown },
  {
    to: '/app/reglamento',
    label: 'Reglamento y Recursos',
    icon: ScrollText,
  },
  {
    to: '/app/reglamento/general',
    label: 'Reglamento estándar',
    icon: BookOpen,
  },
  {
    to: '/app/reglamento/referencia-rapida',
    label: 'Referencia rápida',
    icon: ScrollText,
  },
  { to: '/app/reglamento/sets', label: 'Sets de reglas', icon: Shield },
  {
    to: '/app/reglamento/recursos',
    label: 'Recursos externos',
    icon: FolderOpen,
  },
  { to: '/app/campanas', label: 'Campañas', icon: BookOpen },
  { to: '/app/perfil', label: 'Perfil', icon: UserCircle2 },
]
const DEFAULT_QUICK_NAV_TARGETS = [
  '/app',
  '/app/personajes',
  '/app/objetos',
  '/app/lugares',
  '/app/clases',
  '/app/campanas',
  '/app/perfil',
]
const RIGHT_RAIL_INFO_LINK = {
  to: '/app/informacion',
  label: 'Información',
  icon: Info,
}
const FAVORITE_GROUPS = [
  { id: 'character', label: 'Personajes' },
  { id: 'object', label: 'Objetos' },
  { id: 'place', label: 'Lugares' },
]
const GLOBAL_SEARCH_LABELS = {
  character: 'Personaje',
  object: 'Objeto',
  place: 'Lugar',
  spell: 'Hechizo',
  power: 'Poder',
  class: 'Clase',
  subclass: 'Subclase',
  feat: 'Dote',
  rule: 'Regla',
  campaign: 'Campaña',
  user: 'Usuario',
}

function DemoModeNotice() {
  return (
    <section className="mb-5 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 shadow-card sm:px-5">
      <div className="flex flex-col gap-1.5 text-sm text-ink sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div>
          <p className="font-display text-base font-bold text-ink">
            Demo estática de WikiCodex
          </p>
          <p className="mt-1 max-w-4xl text-ink-muted">
            Estás viendo una demo navegable de solo lectura: no hay login real,
            no se suben archivos y las acciones de crear, editar o borrar no
            modifican datos en ningún servidor.
          </p>
        </div>
        <p className="max-w-2xl text-ink-soft sm:text-right">
          WikiCodex es un proyecto de uso privado por el momento, pero
          cualquiera puede utilizar el código del repositorio para montar su
          propio WikiCodex.
        </p>
      </div>
    </section>
  )
}

function getEntityIcon(entityType) {
  if (entityType === 'character') {
    return UserCircle2
  }

  if (entityType === 'object') {
    return Sword
  }

  if (entityType === 'place') {
    return MapPinned
  }

  if (entityType === 'session') {
    return BookOpen
  }

  if (entityType === 'spell') {
    return BookOpen
  }

  if (entityType === 'power') {
    return Sparkles
  }

  if (entityType === 'class' || entityType === 'subclass') {
    return GraduationCap
  }

  if (entityType === 'feat' || entityType === 'rule') {
    return ScrollText
  }

  if (entityType === 'campaign') {
    return BookOpen
  }

  if (entityType === 'user') {
    return UserCircle2
  }

  return Clock
}

function getStorageUserKey(baseKey, userId) {
  return `${baseKey}:${userId || 'anon'}`
}

function readJsonStorage(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

async function fetchNotificationSummary() {
  const { data } = await api.get('/notifications/summary')
  return data
}

async function fetchNotifications() {
  const { data } = await api.get('/notifications', {
    params: { limit: 20 },
  })
  return data
}

function formatNotificationDate(value) {
  if (!value) {
    return ''
  }

  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function NotificationBell({ paletteColor, onNavigate }) {
  const containerRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [summary, setSummary] = useState({ total: 0, unreadCount: 0 })
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const hasNotifications = summary.total > 0

  async function refreshSummary() {
    try {
      const nextSummary = await fetchNotificationSummary()
      setSummary({
        total: nextSummary.total || 0,
        unreadCount: nextSummary.unreadCount || 0,
      })
    } catch {
      // El siguiente polling reintentara sin bloquear el header.
    }
  }

  async function refreshNotifications() {
    setIsLoading(true)

    try {
      const result = await fetchNotifications()
      setItems(result.items || [])
      setSummary({
        total: result.meta?.total || 0,
        unreadCount: result.meta?.unreadCount || 0,
      })
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let alive = true

    async function loadInitialSummary() {
      try {
        const nextSummary = await fetchNotificationSummary()

        if (alive) {
          setSummary({
            total: nextSummary.total || 0,
            unreadCount: nextSummary.unreadCount || 0,
          })
        }
      } catch {
        // La campaña simplemente queda sin indicador hasta el siguiente intento.
      }
    }

    loadInitialSummary()
    const interval = window.setInterval(
      loadInitialSummary,
      NOTIFICATION_POLL_INTERVAL_MS
    )

    return () => {
      alive = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  async function handleToggle() {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)

    if (nextOpen) {
      await refreshNotifications()
    }
  }

  async function handleDeleteNotification(event, notificationId) {
    event.stopPropagation()
    setDeletingId(notificationId)

    try {
      await api.delete(`/notifications/${notificationId}`)
      setItems((current) =>
        current.filter((item) => item.id !== notificationId)
      )
      await refreshSummary()
    } finally {
      setDeletingId('')
    }
  }

  async function handleDeleteAll(event) {
    event.stopPropagation()
    setIsDeletingAll(true)

    try {
      await api.delete('/notifications')
      setItems([])
      setSummary({ total: 0, unreadCount: 0 })
    } finally {
      setIsDeletingAll(false)
    }
  }

  async function handleNavigateToNotification(notification) {
    if (!notification.urlDestino) {
      return
    }

    setDeletingId(notification.id)
    setItems((current) => current.filter((item) => item.id !== notification.id))
    setSummary((current) => ({
      total: Math.max(0, Number(current.total || 0) - 1),
      unreadCount: Math.max(0, Number(current.unreadCount || 0) - 1),
    }))
    setIsOpen(false)

    try {
      await api.delete(`/notifications/${notification.id}`)
    } catch {
      // La navegación no debe bloquearse si la notificación ya no existe.
    } finally {
      setDeletingId('')
      onNavigate(notification.urlDestino)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'relative rounded-lg p-2 text-ink-soft transition hover:bg-surface-strong hover:text-brand',
          isOpen && 'bg-surface-strong text-brand'
        )}
        aria-expanded={isOpen}
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {hasNotifications ? (
          <span
            className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface"
            style={{ backgroundColor: paletteColor }}
          />
        ) : null}
      </button>

      {isOpen ? (
        <div className="fixed left-4 right-4 top-[4.75rem] z-50 max-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-2xl border border-stroke bg-white shadow-card lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[min(22rem,calc(100vw-2rem))] lg:max-h-none">
          <div className="flex items-start justify-between gap-3 border-b border-stroke px-4 py-3">
            <div>
              <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
                Notificaciones
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {summary.total} aviso{summary.total === 1 ? '' : 's'} activos
              </p>
            </div>

            {summary.total > 0 ? (
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="rounded-md border border-stroke px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-45"
              >
                Borrar todas
              </button>
            ) : null}
          </div>

          <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto lg:max-h-96">
            {isLoading ? (
              <div className="px-4 py-6 text-sm text-ink-soft">
                Cargando notificaciones...
              </div>
            ) : null}

            {!isLoading && !items.length ? (
              <div className="px-4 py-6 text-sm text-ink-soft">
                No tienes notificaciones pendientes.
              </div>
            ) : null}

            {!isLoading
              ? items.map((notification) => (
                  <div
                    key={notification.id}
                    className="grid grid-cols-[1fr_auto] gap-3 border-b border-stroke px-4 py-3 transition last:border-b-0 hover:bg-brand/5"
                  >
                    <button
                      type="button"
                      onClick={() => handleNavigateToNotification(notification)}
                      className="min-w-0 text-left"
                    >
                      <span className="block font-display text-sm font-bold text-ink">
                        {notification.titulo}
                      </span>
                      {notification.mensaje ? (
                        <span className="mt-1 block text-xs leading-5 text-ink-soft">
                          {notification.mensaje}
                        </span>
                      ) : null}
                      <span className="mt-2 block font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted">
                        {formatNotificationDate(notification.creadoEn)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={(event) =>
                        handleDeleteNotification(event, notification.id)
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition hover:bg-danger/10 hover:text-danger"
                      aria-label="Borrar notificación"
                    >
                      {deletingId === notification.id ? (
                        <span className="h-3 w-3 animate-pulse rounded-full bg-danger/60" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))
              : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CreateDropdown({ compact = false, isOpen, onToggle, onNavigate }) {
  const [openChildMenu, setOpenChildMenu] = useState(null)

  useEffect(() => {
    if (isOpen) {
      return undefined
    }

    const timeout = window.setTimeout(() => setOpenChildMenu(null), 0)
    return () => window.clearTimeout(timeout)
  }, [isOpen])

  return (
    <div className="relative" data-create-menu-root>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg bg-brand text-black transition hover:brightness-95',
          compact
            ? 'h-11 w-11'
            : 'gap-2 px-3 py-2 font-label text-[11px] font-black uppercase tracking-[0.12em]'
        )}
        aria-expanded={isOpen}
        aria-label="Abrir menú de creación"
      >
        <Plus className="h-4 w-4 stroke-[3]" />
        {compact ? null : 'Crear'}
      </button>

      {isOpen ? (
        <div
          className={cn(
            compact
              ? 'fixed left-4 right-4 top-[4.75rem] z-40 max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-card lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:w-56 lg:max-h-none lg:overflow-visible'
              : 'absolute right-0 top-full z-40 mt-2 w-56 overflow-visible rounded-xl border border-slate-200 bg-white shadow-card'
          )}
        >
          {createOptions.map(([label, target, enabled, children]) => {
            const OptionIcon =
              target === '/app/personajes/nuevo'
                ? UserCircle2
                : target === '/app/objetos/nuevo'
                  ? Sword
                  : target === '/app/lugares/nuevo'
                    ? MapPinned
                    : target.startsWith('/app/clases')
                      ? GraduationCap
                      : target.startsWith('/app/poderes/otros')
                        ? Sparkles
                        : BookOpen

            if (children?.length) {
              return (
                <div
                  key={label}
                  className="relative"
                  onMouseEnter={() => setOpenChildMenu(label)}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenChildMenu((current) =>
                        current === label ? null : label
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-label text-[10px] font-black uppercase tracking-[0.16em] text-slate-900 transition hover:bg-brand/10 hover:text-black"
                    aria-expanded={openChildMenu === label}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <OptionIcon className="h-4 w-4 shrink-0" />
                      {label}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                  {openChildMenu === label ? (
                    <div
                      className={cn(
                        compact
                          ? 'mx-3 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-surface py-1'
                          : 'absolute left-full top-0 z-50 ml-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-card'
                      )}
                    >
                      {children.map(([childLabel, childTarget, childIcon]) => {
                        const NestedIcon = childIcon

                        return (
                          <button
                            key={childLabel}
                            type="button"
                            onClick={() => onNavigate(childTarget)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left font-label text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 transition hover:bg-brand/10 hover:text-black"
                          >
                            <NestedIcon className="h-4 w-4 shrink-0" />
                            {childLabel}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            }

            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (!enabled) {
                    return
                  }

                  onNavigate(target)
                }}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left font-label text-[10px] font-black uppercase tracking-[0.16em] transition',
                  enabled
                    ? 'text-slate-900 hover:bg-brand/10 hover:text-black'
                    : 'cursor-not-allowed text-slate-400'
                )}
              >
                <OptionIcon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function BrandMark({ collapsed, onNavigate }) {
  return (
    <button
      type="button"
      onClick={onNavigate}
      className={cn(
        'min-w-0 text-left transition hover:opacity-90',
        collapsed
          ? 'flex w-full justify-center text-center'
          : 'inline-flex flex-col'
      )}
    >
      <span
        className={cn(
          'brand-mark-title font-display font-bold tracking-[-0.06em] text-white',
          collapsed ? 'text-[0.92rem] leading-none' : 'text-[1.55rem]'
        )}
      >
        <>
          <span className="brand-mark-accent text-brand">W</span>iki
          <span className="brand-mark-accent text-brand">C</span>odex
        </>
      </span>
    </button>
  )
}

function UserAvatar({
  imageUrl,
  alt,
  sizeClass = 'h-11 w-11',
  iconClass = 'h-5 w-5',
  roundedClass = 'rounded-lg',
  fallbackClassName = 'bg-white/8 text-brand',
}) {
  if (imageUrl) {
    return (
      <div
        className={cn(
          'overflow-hidden bg-white/10',
          sizeClass,
          roundedClass,
          fallbackClassName
        )}
      >
        <CloudinaryImage
          src={imageUrl}
          alt={alt}
          variant="avatar"
          sizes="64px"
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        sizeClass,
        roundedClass,
        fallbackClassName
      )}
    >
      <UserCircle2 className={iconClass} />
    </div>
  )
}

function SidebarLink({ item, collapsed, onLinkNavigate }) {
  return (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onLinkNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center font-label text-[11px] font-bold uppercase tracking-[0.16em] transition',
          collapsed ? 'justify-center rounded-lg px-3 py-3' : 'gap-3 px-5 py-3',
          isActive
            ? collapsed
              ? 'bg-[#2d2f2f] text-brand'
              : 'border-l-4 border-brand bg-[#2d2f2f] text-brand'
            : 'text-white/55 hover:bg-[#2d2f2f] hover:text-white'
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed ? item.label : null}
    </NavLink>
  )
}

function SidebarGroup({ group, collapsed, onLinkNavigate }) {
  const location = useLocation()
  const [openPath, setOpenPath] = useState(null)
  const isActive = group.items.some(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`)
  )
  const isExpanded = isActive || openPath === location.pathname

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() =>
          setOpenPath((value) =>
            value === location.pathname ? null : location.pathname
          )
        }
        title={collapsed ? group.label : undefined}
        className={cn(
          'flex w-full items-center font-label text-[11px] font-bold uppercase tracking-[0.16em] transition',
          collapsed ? 'justify-center rounded-lg px-3 py-3' : 'gap-3 px-5 py-3',
          isExpanded
            ? collapsed
              ? 'bg-[#2d2f2f] text-brand'
              : 'border-l-4 border-brand bg-[#2d2f2f] text-brand'
            : 'text-white/55 hover:bg-[#2d2f2f] hover:text-white'
        )}
        aria-expanded={isExpanded}
      >
        <group.icon className="h-4 w-4 shrink-0" />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 text-left">{group.label}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition',
                isExpanded && 'rotate-180'
              )}
            />
          </>
        ) : null}
      </button>

      <div
        className={cn(
          'grid overflow-hidden transition-all duration-200',
          isExpanded ? 'max-h-44 opacity-100' : 'max-h-0 opacity-0',
          isExpanded ? (collapsed ? 'gap-1 pt-1' : 'py-1') : 'py-0'
        )}
      >
        {group.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onLinkNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive: isItemActive }) =>
              cn(
                'flex items-center font-label text-[11px] font-bold uppercase tracking-[0.16em] transition',
                collapsed
                  ? 'justify-center rounded-lg px-3 py-3'
                  : 'ml-5 gap-3 px-5 py-2.5',
                isItemActive ? 'text-brand' : 'text-white/45 hover:text-white'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed ? item.label : null}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

function SidebarContent({
  collapsed,
  onBrandNavigate,
  onLinkNavigate,
  onToggle,
  showProfileLink = false,
}) {
  const { isAdmin, logout } = useAuth()

  return (
    <div
      className={cn(
        'flex h-screen flex-col overflow-y-auto overflow-x-hidden bg-[#121212] py-6 text-white',
        collapsed ? 'items-center' : ''
      )}
    >
      {collapsed ? (
        <div className="w-full px-2">
          <div className="flex min-h-[40px] items-start justify-center">
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/8 text-white/70 transition hover:bg-white/14 hover:text-white"
              aria-label="Desplegar menú lateral"
              title="Desplegar panel izquierdo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex justify-center">
            <BrandMark collapsed={collapsed} onNavigate={onBrandNavigate} />
          </div>
        </div>
      ) : (
        <div className="flex min-h-[64px] items-start gap-3 px-5">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/8 text-white/70 transition hover:bg-white/14 hover:text-white"
            aria-label="Plegar menú lateral"
            title="Plegar panel izquierdo"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 overflow-hidden pt-1">
            <BrandMark collapsed={collapsed} onNavigate={onBrandNavigate} />
          </div>
        </div>
      )}

      <nav
        className={cn(
          'mt-8 flex flex-1 flex-col gap-1',
          collapsed ? 'w-full px-3' : ''
        )}
      >
        {primaryLinks.map((item) => (
          <SidebarLink
            key={item.to}
            item={item}
            collapsed={collapsed}
            onLinkNavigate={onLinkNavigate}
          />
        ))}

        <SidebarGroup
          group={gameToolsGroup}
          collapsed={collapsed}
          onLinkNavigate={onLinkNavigate}
        />

        <SidebarLink
          item={rulesLink}
          collapsed={collapsed}
          onLinkNavigate={onLinkNavigate}
        />

        {isAdmin ? (
          <>
            <div
              className={cn(
                'my-3 h-px bg-white/8',
                collapsed ? 'mx-0' : 'mx-5'
              )}
            />
            {adminLinks.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                onLinkNavigate={onLinkNavigate}
              />
            ))}
          </>
        ) : null}

        {showProfileLink ? (
          <SidebarLink
            item={{ to: '/app/perfil', label: 'Perfil', icon: UserCircle2 }}
            collapsed={collapsed}
            onLinkNavigate={onLinkNavigate}
          />
        ) : null}
      </nav>

      <div className={cn('mt-6', collapsed ? 'w-full px-3' : 'px-5')}>
        <button
          type="button"
          onClick={logout}
          title="Salir"
          className={cn(
            'inline-flex items-center font-label text-[11px] font-bold uppercase tracking-[0.16em] text-white/55 transition hover:text-white',
            collapsed
              ? 'w-full justify-center rounded-lg bg-white/8 py-3'
              : 'gap-2'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed ? 'Salir' : null}
        </button>
      </div>
    </div>
  )
}

function UtilityRail({ collapsed, onToggle }) {
  const { user, isAdmin } = useAuth()
  const { paletteColor } = useTheme()
  const navigate = useNavigate()
  const quickNavStorageKey = getStorageUserKey(
    QUICK_NAV_BASE_STORAGE_KEY,
    user?.id
  )
  const sectionsStorageKey = getStorageUserKey(
    RIGHT_RAIL_SECTIONS_BASE_STORAGE_KEY,
    user?.id
  )
  const favoritesDisplayStorageKey = getStorageUserKey(
    FAVORITES_DISPLAY_BASE_STORAGE_KEY,
    user?.id
  )
  const [quickTargets, setQuickTargets] = useState(() =>
    readJsonStorage(quickNavStorageKey, DEFAULT_QUICK_NAV_TARGETS)
  )
  const [quickDraftTargets, setQuickDraftTargets] = useState(() =>
    readJsonStorage(quickNavStorageKey, DEFAULT_QUICK_NAV_TARGETS)
  )
  const [sectionsOpen, setSectionsOpen] = useState(() =>
    readJsonStorage(sectionsStorageKey, {
      quick: true,
      recent: true,
      favorites: true,
    })
  )
  const [isEditingQuickNav, setIsEditingQuickNav] = useState(false)
  const [recentActivity, setRecentActivity] = useState(() =>
    getRecentActivity().slice(0, 8)
  )
  const [allFavoriteItems, setAllFavoriteItems] = useState([])
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false)
  const [isFavoritesEditorOpen, setIsFavoritesEditorOpen] = useState(false)
  const [favoriteEditorMode, setFavoriteEditorMode] = useState('list')
  const [removedFavoriteIds, setRemovedFavoriteIds] = useState([])
  const [favoriteSearch, setFavoriteSearch] = useState('')
  const [favoriteGroupsOpen, setFavoriteGroupsOpen] = useState({
    character: true,
    object: true,
    place: true,
  })
  const [favoritesDisplay, setFavoritesDisplay] = useState(() =>
    readJsonStorage(favoritesDisplayStorageKey, {
      mode: 'latest',
      selectedIds: [],
    })
  )

  useEffect(() => {
    const storedTargets = readJsonStorage(
      quickNavStorageKey,
      DEFAULT_QUICK_NAV_TARGETS
    )
    setQuickTargets(storedTargets)
    setQuickDraftTargets(storedTargets)
  }, [quickNavStorageKey])

  useEffect(() => {
    setSectionsOpen(
      readJsonStorage(sectionsStorageKey, {
        quick: true,
        recent: true,
        favorites: true,
      })
    )
  }, [sectionsStorageKey])

  useEffect(() => {
    writeJsonStorage(quickNavStorageKey, quickTargets)
  }, [quickNavStorageKey, quickTargets])

  useEffect(() => {
    writeJsonStorage(sectionsStorageKey, sectionsOpen)
  }, [sectionsOpen, sectionsStorageKey])

  useEffect(() => {
    setFavoritesDisplay(
      readJsonStorage(favoritesDisplayStorageKey, {
        mode: 'latest',
        selectedIds: [],
      })
    )
  }, [favoritesDisplayStorageKey])

  useEffect(() => {
    writeJsonStorage(favoritesDisplayStorageKey, favoritesDisplay)
  }, [favoritesDisplay, favoritesDisplayStorageKey])

  useEffect(() => {
    function handleRecentUpdate(event) {
      const nextItems = Array.isArray(event.detail)
        ? event.detail
        : getRecentActivity()
      setRecentActivity(nextItems.slice(0, 8))
    }

    window.addEventListener(RECENT_ACTIVITY_EVENT, handleRecentUpdate)
    window.addEventListener('storage', handleRecentUpdate)

    return () => {
      window.removeEventListener(RECENT_ACTIVITY_EVENT, handleRecentUpdate)
      window.removeEventListener('storage', handleRecentUpdate)
    }
  }, [])

  useEffect(() => {
    let alive = true

    async function loadFavorites() {
      setIsLoadingFavorites(true)

      try {
        const result = await fetchFavorites({ limit: 200 })

        if (alive) {
          setAllFavoriteItems(result.items || [])
          setRemovedFavoriteIds((current) =>
            current.filter((favoriteId) =>
              (result.items || []).some((item) => item.id === favoriteId)
            )
          )
        }
      } catch {
        if (alive) {
          setAllFavoriteItems([])
        }
      } finally {
        if (alive) {
          setIsLoadingFavorites(false)
        }
      }
    }

    loadFavorites()
    window.addEventListener(FAVORITES_UPDATED_EVENT, loadFavorites)

    return () => {
      alive = false
      window.removeEventListener(FAVORITES_UPDATED_EVENT, loadFavorites)
    }
  }, [])

  function toggleSection(sectionKey) {
    setSectionsOpen((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }))
  }

  function toggleQuickTarget(target) {
    setQuickDraftTargets((current) => {
      if (current.includes(target)) {
        return current.filter((item) => item !== target)
      }

      return [...current, target]
    })
  }

  function startEditingQuickNav() {
    setQuickDraftTargets(quickTargets)
    setIsEditingQuickNav(true)
  }

  function cancelEditingQuickNav() {
    setQuickDraftTargets(quickTargets)
    setIsEditingQuickNav(false)
  }

  function saveQuickNav() {
    setQuickTargets(quickDraftTargets)
    setIsEditingQuickNav(false)
  }

  function toggleFavoriteGroup(groupId) {
    setFavoriteGroupsOpen((current) => ({
      ...current,
      [groupId]: current[groupId] === false,
    }))
  }

  function toggleSelectedFavorite(favoriteId) {
    setFavoritesDisplay((current) => {
      const selectedIds = Array.isArray(current.selectedIds)
        ? current.selectedIds
        : []

      if (selectedIds.includes(favoriteId)) {
        return {
          ...current,
          selectedIds: selectedIds.filter((id) => id !== favoriteId),
        }
      }

      if (selectedIds.length >= 8) {
        return current
      }

      return {
        ...current,
        selectedIds: [...selectedIds, favoriteId],
      }
    })
  }

  async function toggleFavoriteFromEditor(event, item) {
    event.stopPropagation()
    const isRemoved = removedFavoriteIds.includes(item.id)

    if (isRemoved) {
      setRemovedFavoriteIds((current) =>
        current.filter((favoriteId) => favoriteId !== item.id)
      )

      try {
        await api.put(`/favorites/${item.entityType}/${item.entityId}`, {
          favorito: true,
        })
      } catch {
        setRemovedFavoriteIds((current) =>
          current.includes(item.id) ? current : [...current, item.id]
        )
      }

      return
    }

    setRemovedFavoriteIds((current) =>
      current.includes(item.id) ? current : [...current, item.id]
    )
    setFavoritesDisplay((current) => ({
      ...current,
      selectedIds: (current.selectedIds || []).filter((id) => id !== item.id),
    }))

    try {
      await api.put(`/favorites/${item.entityType}/${item.entityId}`, {
        favorito: false,
      })
    } catch {
      setRemovedFavoriteIds((current) =>
        current.filter((favoriteId) => favoriteId !== item.id)
      )
    }
  }

  function closeFavoritesEditor() {
    setIsFavoritesEditorOpen(false)
    setFavoriteEditorMode('list')
    setFavoriteSearch('')
    setAllFavoriteItems((current) =>
      current.filter((item) => !removedFavoriteIds.includes(item.id))
    )
    setRemovedFavoriteIds([])
    window.dispatchEvent(new CustomEvent(FAVORITES_UPDATED_EVENT))
  }

  const validSelectedFavoriteIds = (favoritesDisplay.selectedIds || []).filter(
    (favoriteId) => allFavoriteItems.some((item) => item.id === favoriteId)
  )
  const visibleFavoriteItems =
    favoritesDisplay.mode === 'selected'
      ? allFavoriteItems
          .filter((item) => validSelectedFavoriteIds.includes(item.id))
          .slice(0, 8)
      : allFavoriteItems.slice(0, 8)
  function normalizeSearchText(value) {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  const favoriteSearchNormalized = normalizeSearchText(favoriteSearch.trim())
  const filteredFavoriteItems = favoriteSearchNormalized
    ? allFavoriteItems.filter(
        (item) =>
          normalizeSearchText(item.nombre).includes(favoriteSearchNormalized) ||
          normalizeSearchText(item.subtitulo).includes(favoriteSearchNormalized)
      )
    : allFavoriteItems
  const selectedFavoriteCount = validSelectedFavoriteIds.length

  function renderRailSection({ sectionKey, title, children }) {
    const isOpen = sectionsOpen[sectionKey] !== false

    return (
      <section className="mt-7 px-5">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={isOpen}
        >
          <span className="font-label text-[9px] font-bold uppercase tracking-[0.22em] text-ink-muted">
            {title}
          </span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-ink-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          )}
        </button>

        {isOpen ? <div className="mt-3">{children}</div> : null}
      </section>
    )
  }

  function renderEntityItem(item, { favorite = false } = {}) {
    const EntityIcon = getEntityIcon(item.entityType)

    return (
      <button
        key={`${item.entityType}-${item.entityId}`}
        type="button"
        onClick={() => item.urlDestino && navigate(item.urlDestino)}
        className="flex w-full items-center gap-3 rounded-lg bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-card"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand/10 text-brand">
          {item.imagenUrl ? (
            <CloudinaryImage
              src={item.imagenUrl}
              alt={item.nombre}
              variant="avatar"
              sizes="48px"
              className="h-full w-full object-cover"
            />
          ) : (
            <EntityIcon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold text-ink">
            {item.nombre}
          </p>
          <p className="truncate font-label text-[9px] font-bold uppercase tracking-[0.18em] text-ink-muted">
            {item.subtitulo || (favorite ? 'Favorito' : 'Detalle')}
          </p>
        </div>
        {favorite ? (
          <Star
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: paletteColor, fill: paletteColor }}
          />
        ) : null}
      </button>
    )
  }

  return (
    <aside className="hidden xl:sticky xl:top-0 xl:block xl:h-screen xl:bg-surface-strong">
      <div className="flex h-screen flex-col overflow-y-auto py-6">
        <div
          className={cn(
            'flex min-h-[64px] items-start',
            collapsed ? 'justify-center px-3' : 'justify-between px-5'
          )}
        >
          {!collapsed ? (
            <div className="flex flex-col items-center text-center">
              <NavLink to="/app/perfil" title="Perfil" className="block">
                <UserAvatar
                  imageUrl={user?.imagenPerfilUrl}
                  alt={user?.nombreUsuario || 'Perfil de usuario'}
                  sizeClass="h-16 w-16"
                  iconClass="h-7 w-7"
                  roundedClass="rounded-xl"
                  fallbackClassName="bg-[#121212] text-brand"
                />
              </NavLink>
              <h3 className="mt-4 font-display text-xl font-bold tracking-[-0.04em] text-ink">
                {user?.nombreUsuario || 'Cuenta'}
              </h3>
              {isAdmin ? (
                <p className="mt-1 font-label text-[9px] font-bold uppercase tracking-[0.24em] text-brand">
                  Administrador
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink-soft transition hover:text-ink"
            aria-label={
              collapsed ? 'Desplegar panel derecho' : 'Plegar panel derecho'
            }
            title={
              collapsed ? 'Desplegar panel derecho' : 'Plegar panel derecho'
            }
          >
            {collapsed ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>

        {collapsed ? (
          <div className="mt-6 flex flex-1 flex-col items-center gap-3 px-3">
            <NavLink
              to="/app/perfil"
              title="Perfil"
              className="block transition hover:-translate-y-0.5"
            >
              <UserAvatar
                imageUrl={user?.imagenPerfilUrl}
                alt={user?.nombreUsuario || 'Perfil de usuario'}
                sizeClass="h-11 w-11"
                iconClass="h-4 w-4"
                roundedClass="rounded-lg"
                fallbackClassName="bg-white text-brand"
              />
            </NavLink>
          </div>
        ) : (
          <>
            <section className="mt-11 px-5">
              <p className="font-label text-[9px] font-bold uppercase tracking-[0.22em] text-ink-muted">
                Navegación rápida
              </p>

              <div className="mt-3 space-y-2">
                {isEditingQuickNav ? (
                  <div className="rounded-2xl border border-brand/20 bg-white p-2 shadow-card">
                    <div className="mb-2 rounded-xl bg-brand/10 px-3 py-2">
                      <p className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-brand">
                        Elige tus accesos
                      </p>
                    </div>

                    <div className="space-y-1">
                      {QUICK_NAV_OPTIONS.map((item) => {
                        const isSelected = quickDraftTargets.includes(item.to)

                        return (
                          <button
                            key={item.to}
                            type="button"
                            onClick={() => toggleQuickTarget(item.to)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition',
                              isSelected
                                ? 'bg-brand/10 font-semibold text-ink'
                                : 'bg-surface text-ink-muted opacity-60 hover:opacity-100'
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">
                              {item.label}
                            </span>
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                isSelected
                                  ? 'border-brand bg-brand text-black'
                                  : 'border-stroke bg-white'
                              )}
                            >
                              {isSelected ? (
                                <Check className="h-3 w-3 stroke-[3]" />
                              ) : null}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={cancelEditingQuickNav}
                        className="rounded-lg border border-stroke px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-danger hover:text-danger"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveQuickNav}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] text-black transition hover:brightness-95"
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {QUICK_NAV_OPTIONS.filter((item) =>
                      quickTargets.includes(item.to)
                    ).map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition',
                            isActive
                              ? 'bg-white font-semibold text-brand'
                              : 'text-ink-soft hover:bg-white hover:text-ink'
                          )
                        }
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    ))}

                    <button
                      type="button"
                      onClick={startEditingQuickNav}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-ink-soft transition hover:bg-white hover:text-ink"
                      aria-expanded={isEditingQuickNav}
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className="truncate">Añadir</span>
                    </button>
                  </div>
                )}
              </div>
            </section>

            {renderRailSection({
              sectionKey: 'recent',
              title: 'Actividad reciente',
              children: (
                <div className="space-y-2">
                  {recentActivity.length ? (
                    recentActivity.map((item) => renderEntityItem(item))
                  ) : (
                    <p className="rounded-lg bg-white px-3 py-4 text-xs leading-5 text-ink-soft">
                      Entra en fichas o reglamentos para verlos aquí.
                    </p>
                  )}
                </div>
              ),
            })}

            {renderRailSection({
              sectionKey: 'favorites',
              title: 'Favoritos',
              children: (
                <div className="space-y-2">
                  {isLoadingFavorites ? (
                    <p className="rounded-lg bg-white px-3 py-4 text-xs text-ink-soft">
                      Cargando favoritos...
                    </p>
                  ) : null}

                  {!isLoadingFavorites && visibleFavoriteItems.length
                    ? visibleFavoriteItems.map((item) =>
                        renderEntityItem(item, { favorite: true })
                      )
                    : null}

                  {!isLoadingFavorites && !visibleFavoriteItems.length ? (
                    <p className="rounded-lg bg-white px-3 py-4 text-xs leading-5 text-ink-soft">
                      {allFavoriteItems.length
                        ? 'Elige hasta 8 favoritos para mostrarlos aqui.'
                        : 'Marca fichas con la estrella para tenerlas a mano.'}
                    </p>
                  ) : null}

                  {!isLoadingFavorites && allFavoriteItems.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFavoriteEditorMode('list')
                        setIsFavoritesEditorOpen(true)
                      }}
                      className="mt-2 flex w-full items-center justify-center rounded-lg border border-stroke bg-white px-3 py-3 font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand/45 hover:text-brand"
                    >
                      Editar favoritos
                    </button>
                  ) : null}
                </div>
              ),
            })}

            {isFavoritesEditorOpen ? (
              <div className="fixed right-8 top-24 z-50 w-[min(34rem,calc(100vw-3rem))] overflow-hidden rounded-3xl border border-stroke bg-white shadow-glow">
                <div className="flex items-start justify-between gap-4 border-b border-stroke px-5 py-4">
                  <div>
                    <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
                      Favoritos
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {favoriteEditorMode === 'list'
                        ? 'Abre cualquier favorito o quitalo con la estrella.'
                        : 'Configura cuáles aparecen en el menú lateral.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeFavoritesEditor}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-strong hover:text-ink"
                    aria-label="Cerrar editor de favoritos"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-4 p-5">
                  {favoriteEditorMode === 'list' ? (
                    <button
                      type="button"
                      onClick={() => setFavoriteEditorMode('configure')}
                      className="inline-flex items-center justify-center rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand transition hover:bg-brand/15"
                    >
                      Elegir favoritos del menú
                    </button>
                  ) : (
                    <div className="grid gap-3">
                      <button
                        type="button"
                        onClick={() => setFavoriteEditorMode('list')}
                        className="justify-self-start font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:text-brand"
                      >
                        Volver a la lista
                      </button>
                      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-1">
                        <button
                          type="button"
                          onClick={() =>
                            setFavoritesDisplay((current) => ({
                              ...current,
                              mode: 'latest',
                            }))
                          }
                          className={cn(
                            'rounded-xl px-3 py-3 font-label text-[10px] font-black uppercase tracking-[0.14em] transition',
                            favoritesDisplay.mode === 'latest'
                              ? 'bg-white text-brand shadow-card'
                              : 'text-ink-soft hover:text-ink'
                          )}
                        >
                          Últimos 8
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFavoritesDisplay((current) => ({
                              ...current,
                              mode: 'selected',
                            }))
                          }
                          className={cn(
                            'rounded-xl px-3 py-3 font-label text-[10px] font-black uppercase tracking-[0.14em] transition',
                            favoritesDisplay.mode === 'selected'
                              ? 'bg-white text-brand shadow-card'
                              : 'text-ink-soft hover:text-ink'
                          )}
                        >
                          Elegidos ({selectedFavoriteCount}/8)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      value={favoriteSearch}
                      onChange={(event) =>
                        setFavoriteSearch(event.target.value)
                      }
                      className="archive-input h-11 w-full rounded-xl pl-10 text-sm"
                      placeholder="Buscar favoritos por nombre"
                    />
                  </div>

                  <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                    {FAVORITE_GROUPS.map((group) => {
                      const groupItems = filteredFavoriteItems.filter(
                        (item) => item.entityType === group.id
                      )
                      const isGroupOpen = favoriteGroupsOpen[group.id] !== false

                      return (
                        <section
                          key={group.id}
                          className="overflow-hidden rounded-2xl border border-stroke bg-surface"
                        >
                          <button
                            type="button"
                            onClick={() => toggleFavoriteGroup(group.id)}
                            className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left"
                          >
                            <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink">
                              {group.label}
                            </span>
                            <span className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                              {groupItems.length}
                              {isGroupOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </span>
                          </button>

                          {isGroupOpen ? (
                            <div className="grid gap-2 p-3">
                              {groupItems.length ? (
                                groupItems.map((item) => {
                                  const isSelected =
                                    validSelectedFavoriteIds.includes(item.id)
                                  const isSelectionMode =
                                    favoriteEditorMode === 'configure' &&
                                    favoritesDisplay.mode === 'selected'
                                  const isSelectionFull =
                                    selectedFavoriteCount >= 8 && !isSelected
                                  const isRemoved = removedFavoriteIds.includes(
                                    item.id
                                  )
                                  const EntityIcon = getEntityIcon(
                                    item.entityType
                                  )
                                  const isItemDisabled =
                                    isSelectionMode && isSelectionFull

                                  function handleFavoriteItemAction() {
                                    if (isItemDisabled) {
                                      return
                                    }

                                    if (isSelectionMode) {
                                      toggleSelectedFavorite(item.id)
                                      return
                                    }

                                    if (favoriteEditorMode === 'configure') {
                                      return
                                    }

                                    if (!isRemoved && item.urlDestino) {
                                      closeFavoritesEditor()
                                      navigate(item.urlDestino)
                                    }
                                  }

                                  return (
                                    <div
                                      key={item.id}
                                      role="button"
                                      tabIndex={isItemDisabled ? -1 : 0}
                                      onClick={handleFavoriteItemAction}
                                      onKeyDown={(event) => {
                                        if (
                                          event.key === 'Enter' ||
                                          event.key === ' '
                                        ) {
                                          event.preventDefault()
                                          handleFavoriteItemAction()
                                        }
                                      }}
                                      aria-disabled={isItemDisabled}
                                      className={cn(
                                        'grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-card',
                                        isItemDisabled &&
                                          'cursor-not-allowed opacity-45',
                                        isSelectionMode &&
                                          isSelected &&
                                          'ring-1 ring-brand/40',
                                        isRemoved && 'opacity-45 grayscale'
                                      )}
                                    >
                                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-brand/10 text-brand">
                                        {item.imagenUrl ? (
                                          <CloudinaryImage
                                            src={item.imagenUrl}
                                            alt={item.nombre}
                                            variant="avatar"
                                            sizes="48px"
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <EntityIcon className="h-4 w-4" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-ink">
                                          {item.nombre}
                                        </p>
                                        <p className="truncate font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted">
                                          {item.subtitulo || group.label}
                                        </p>
                                      </div>
                                      {isSelectionMode ? (
                                        <span
                                          className={cn(
                                            'flex h-5 w-5 items-center justify-center rounded border',
                                            isSelected
                                              ? 'border-brand bg-brand text-black'
                                              : 'border-stroke bg-surface'
                                          )}
                                        >
                                          {isSelected ? (
                                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                                          ) : null}
                                        </span>
                                      ) : favoriteEditorMode === 'list' ? (
                                        <button
                                          type="button"
                                          onClick={(event) =>
                                            toggleFavoriteFromEditor(
                                              event,
                                              item
                                            )
                                          }
                                          onKeyDown={(event) => {
                                            if (
                                              event.key === 'Enter' ||
                                              event.key === ' '
                                            ) {
                                              toggleFavoriteFromEditor(
                                                event,
                                                item
                                              )
                                            }
                                          }}
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-brand/10"
                                          aria-label={
                                            isRemoved
                                              ? 'Volver a marcar favorito'
                                              : 'Quitar de favoritos'
                                          }
                                          title={
                                            isRemoved
                                              ? 'Volver a marcar favorito'
                                              : 'Quitar de favoritos'
                                          }
                                        >
                                          <Star
                                            className="h-4 w-4"
                                            style={{
                                              color: isRemoved
                                                ? undefined
                                                : paletteColor,
                                              fill: isRemoved
                                                ? 'transparent'
                                                : paletteColor,
                                            }}
                                          />
                                        </button>
                                      ) : (
                                        <span className="h-5 w-5" />
                                      )}
                                    </div>
                                  )
                                })
                              ) : (
                                <p className="rounded-xl bg-white px-3 py-4 text-sm text-ink-soft">
                                  No hay favoritos en esta sección.
                                </p>
                              )}
                            </div>
                          ) : null}
                        </section>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        <div className={cn('mt-auto pt-6', collapsed ? 'px-3' : 'px-5')}>
          <NavLink
            to={RIGHT_RAIL_INFO_LINK.to}
            title={RIGHT_RAIL_INFO_LINK.label}
            className={({ isActive }) =>
              cn(
                'flex items-center font-label text-[10px] font-black uppercase tracking-[0.16em] transition',
                collapsed
                  ? 'h-10 w-10 justify-center rounded-lg'
                  : 'gap-3 rounded-xl px-4 py-3',
                isActive
                  ? 'text-brand'
                  : 'text-ink-muted/80 hover:bg-brand/5 hover:text-brand'
              )
            }
          >
            <RIGHT_RAIL_INFO_LINK.icon className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>{RIGHT_RAIL_INFO_LINK.label}</span> : null}
          </NavLink>
        </div>
      </div>
    </aside>
  )
}

function SettingsDropdown({
  isOpen,
  isReadingLeftHidden,
  isReadingRightHidden,
  onToggleReadingLeft,
  onToggleReadingRight,
  isDarkMode,
  isDarkModeLocked,
  paletteColor,
  paletteDraft,
  setPaletteDraft,
  isSavingVisual,
  onToggleDarkMode,
  onSavePalette,
  onLogout,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed left-4 right-4 top-[4.75rem] z-50 max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-2xl border border-stroke bg-white shadow-card lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:w-80 lg:max-h-none lg:overflow-hidden">
      <div className="border-b border-stroke/70 px-5 py-4">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
          Ajustes rapidos
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Lectura, aspecto visual y salida de cuenta.
        </p>
      </div>

      <div className="grid gap-4 p-4">
        <div className="hidden gap-3 rounded-xl border border-stroke bg-surface p-4 lg:grid">
          <div>
            <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink">
              Modo lectura
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              Oculta cada menú lateral por separado para ganar espacio.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-stroke bg-white p-2 shadow-inner">
            {[
              {
                label: 'Izquierdo',
                description: 'Navegación',
                active: isReadingLeftHidden,
                onClick: onToggleReadingLeft,
                icon: ChevronLeft,
              },
              {
                label: 'Derecho',
                description: 'Actividad',
                active: isReadingRightHidden,
                onClick: onToggleReadingRight,
                icon: ChevronRight,
              },
            ].map((item) => {
              const ItemIcon = item.icon

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    'group flex min-h-24 flex-col justify-between rounded-xl border px-3 py-3 text-left transition',
                    item.active
                      ? 'border-brand bg-brand/10 text-ink shadow-card'
                      : 'border-transparent bg-surface text-ink-soft hover:border-brand/40 hover:bg-white hover:text-brand'
                  )}
                  aria-pressed={item.active}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition',
                        item.active
                          ? 'border-brand bg-brand text-black'
                          : 'border-stroke bg-white text-ink-muted group-hover:text-brand'
                      )}
                    >
                      <ItemIcon className="h-4 w-4" />
                    </span>
                  </span>
                  <span>
                    <span className="block font-label text-[10px] font-black uppercase tracking-[0.16em]">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-4">
                      {item.active ? 'Oculto' : item.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {!isDarkModeLocked ? (
          <div className="rounded-xl border border-stroke bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink">
                  Modo oscuro
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Activa una lectura nocturna.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleDarkMode}
                disabled={isSavingVisual}
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-lg border transition disabled:opacity-50',
                  isDarkMode
                    ? 'border-brand bg-brand text-black'
                    : 'border-stroke bg-white text-ink-soft hover:text-brand'
                )}
                aria-label={
                  isDarkMode ? 'Desactivar modo oscuro' : 'Activar modo oscuro'
                }
              >
                {isDarkMode ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-stroke bg-surface p-4">
          <div className="flex items-start gap-3">
            <Palette className="mt-0.5 h-5 w-5 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink">
                Paleta de color
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Cambia el color principal de WikiCodex.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <input
              type="color"
              value={paletteDraft}
              onChange={(event) => setPaletteDraft(event.target.value)}
              className="h-11 w-14 cursor-pointer rounded-lg border border-stroke bg-white p-1"
              aria-label="Seleccionar color principal"
            />
            <div className="min-w-0 flex-1">
              <div
                className="h-4 rounded-full border border-black/10"
                style={{ backgroundColor: paletteDraft }}
              />
              <p className="mt-1 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-muted">
                {paletteDraft.toUpperCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={onSavePalette}
              disabled={isSavingVisual || paletteDraft === paletteColor}
              className="theme-solid-button rounded-md px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Guardar
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {VISUAL_PALETTE_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setPaletteDraft(color)}
                className={cn(
                  'h-7 w-7 rounded-md border transition hover:scale-105',
                  paletteDraft.toLowerCase() === color.toLowerCase()
                    ? 'border-ink ring-2 ring-brand/30'
                    : 'border-black/10'
                )}
                style={{ backgroundColor: color }}
                aria-label={`Usar color ${color}`}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-between gap-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-left font-label text-[10px] font-black uppercase tracking-[0.18em] text-danger transition hover:bg-danger hover:text-white"
        >
          Salir
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function ReadingModeNavigation({ onNavigate }) {
  const { isAdmin } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const navigationGroups = [
    {
      label: 'Secciones',
      items: [...primaryLinks, rulesLink],
    },
    {
      label: 'Herramientas',
      items: [
        { to: '/app/herramientas', label: 'Herramientas', icon: Gamepad2 },
        ...gameToolLinks,
      ],
    },
    {
      label: 'Reglamento',
      items: [
        { to: '/app/reglamento/general', label: 'Reglamento estándar' },
        {
          to: '/app/reglamento/referencia-rapida',
          label: 'Referencia rápida',
        },
        { to: '/app/reglamento/sets', label: 'Sets de reglas' },
        { to: '/app/reglamento/recursos', label: 'Recursos externos' },
      ],
    },
    {
      label: 'Cuenta',
      items: [
        { to: '/app/perfil', label: 'Perfil', icon: UserCircle2 },
        { to: '/app/informacion', label: 'Información', icon: Info },
        ...(isAdmin ? adminLinks : []),
      ],
    },
  ]

  function handleNavigate(target) {
    setIsOpen(false)
    onNavigate(target)
  }

  return (
    <div className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex h-11 min-w-56 items-center justify-between gap-3 rounded-xl border border-brand/30 bg-surface-strong px-4 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft shadow-card transition hover:border-brand/60 hover:text-brand"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        Secciones
        <ChevronDown
          className={cn('h-4 w-4 transition', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-stroke bg-white p-3 shadow-glow"
          role="menu"
          aria-label="Navegar por secciones"
        >
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {navigationGroups.map((group) => (
              <section key={group.label}>
                <p className="px-2 pb-1 font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                  {group.label}
                </p>
                <div className="grid gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon || ScrollText

                    return (
                      <button
                        key={item.to}
                        type="button"
                        onClick={() => handleNavigate(item.to)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink-soft transition hover:bg-surface-strong hover:text-ink"
                        role="menuitem"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-brand" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function AppShell() {
  const navigate = useNavigate()
  const { logout, updateProfile } = useAuth()
  const {
    mode,
    paletteColor,
    sheetVisualMode,
    isDarkMode,
    isDarkModeLocked,
    setMode,
    setPaletteColor,
  } = useTheme()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsDesktopRef = useRef(null)
  const settingsMobileRef = useRef(null)
  const globalSearchRef = useRef(null)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const [globalSearchItems, setGlobalSearchItems] = useState([])
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const [isGlobalSearchLoading, setIsGlobalSearchLoading] = useState(false)
  const [globalSearchError, setGlobalSearchError] = useState('')
  const [isSavingVisual, setIsSavingVisual] = useState(false)
  const [paletteDraft, setPaletteDraft] = useState(paletteColor)
  const [isReadingLeftHidden, setIsReadingLeftHidden] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return (
      window.localStorage.getItem(READING_LEFT_STORAGE_KEY) === 'true' ||
      window.localStorage.getItem(READING_MODE_STORAGE_KEY) === 'true'
    )
  })
  const [isReadingRightHidden, setIsReadingRightHidden] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return (
      window.localStorage.getItem(READING_RIGHT_STORAGE_KEY) === 'true' ||
      window.localStorage.getItem(READING_MODE_STORAGE_KEY) === 'true'
    )
  })

  useEffect(() => {
    setPaletteDraft(paletteColor)
  }, [paletteColor])

  useEffect(() => {
    const isReadingMode = isReadingLeftHidden && isReadingRightHidden

    window.localStorage.setItem(
      READING_LEFT_STORAGE_KEY,
      String(isReadingLeftHidden)
    )
    window.localStorage.setItem(
      READING_RIGHT_STORAGE_KEY,
      String(isReadingRightHidden)
    )
    window.localStorage.setItem(READING_MODE_STORAGE_KEY, String(isReadingMode))

    if (isReadingLeftHidden) {
      setIsSidebarOpen(false)
    }
  }, [isReadingLeftHidden, isReadingRightHidden])

  useEffect(() => {
    if (!isSidebarOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isSidebarOpen])

  useEffect(() => {
    if (!isSettingsOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      const target = event.target
      const insideDesktop = settingsDesktopRef.current?.contains(target)
      const insideMobile = settingsMobileRef.current?.contains(target)

      if (!insideDesktop && !insideMobile) {
        setIsSettingsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isSettingsOpen])

  useEffect(() => {
    if (!isCreateOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!event.target.closest('[data-create-menu-root]')) {
        setIsCreateOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isCreateOpen])

  useEffect(() => {
    const query = globalSearchQuery.trim()

    if (!query) {
      setGlobalSearchItems([])
      setGlobalSearchError('')
      setIsGlobalSearchLoading(false)
      return undefined
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(
      async () => {
        setIsGlobalSearchLoading(true)
        setGlobalSearchError('')

        try {
          const result = await fetchGlobalSearch({
            query,
            limit: 6,
            signal: controller.signal,
          })

          setGlobalSearchItems(result.items || [])
          setIsGlobalSearchOpen(true)
        } catch (error) {
          if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
            return
          }

          setGlobalSearchItems([])
          setGlobalSearchError('No se pudo completar la búsqueda.')
        } finally {
          if (!controller.signal.aborted) {
            setIsGlobalSearchLoading(false)
          }
        }
      },
      query.length < 3 ? 420 : 280
    )

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [globalSearchQuery])

  useEffect(() => {
    if (!isGlobalSearchOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!globalSearchRef.current?.contains(event.target)) {
        setIsGlobalSearchOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isGlobalSearchOpen])

  function handleGlobalSearchNavigate(item) {
    setIsGlobalSearchOpen(false)
    setGlobalSearchQuery('')
    setGlobalSearchItems([])
    navigate(item.url)
  }

  async function persistVisualSettings(nextSettings) {
    setIsSavingVisual(true)

    try {
      await updateProfile({
        temaModo: nextSettings.mode,
        temaColorHex: nextSettings.paletteColor,
        modoVisualFichas: nextSettings.sheetVisualMode,
      })
    } catch {
      // The theme is still applied locally; profile persistence can be retried.
    } finally {
      setIsSavingVisual(false)
    }
  }

  async function handleToggleDarkMode() {
    if (isDarkModeLocked) {
      return
    }

    const nextMode = mode === 'dark' ? 'light' : 'dark'
    setMode(nextMode)
    await persistVisualSettings({
      mode: nextMode,
      paletteColor,
      sheetVisualMode,
    })
  }

  async function handleSavePalette() {
    setPaletteColor(paletteDraft)
    await persistVisualSettings({
      mode,
      paletteColor: paletteDraft,
      sheetVisualMode,
    })
  }

  function handleLogout() {
    setIsSettingsOpen(false)
    logout()
    navigate('/', { replace: true })
  }

  function handleDemoInternalLinkClick(event) {
    if (!isDemoMode || event.defaultPrevented || event.button !== 0) {
      return
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    const anchor = event.target.closest('a[href]')

    if (!anchor || anchor.hasAttribute('download')) {
      return
    }

    const rawHref = anchor.getAttribute('href') || ''
    let target = ''

    if (rawHref.startsWith('/app')) {
      target = rawHref
    } else {
      try {
        const parsed = new URL(anchor.href)
        if (
          parsed.origin === window.location.origin &&
          parsed.pathname.startsWith('/app')
        ) {
          target = `${parsed.pathname}${parsed.search}${parsed.hash}`
        }
      } catch {
        target = ''
      }
    }

    if (!target) {
      return
    }

    event.preventDefault()
    navigate(target)
  }

  const isReadingMode = isReadingLeftHidden || isReadingRightHidden
  const outletLeftCollapsed = isReadingLeftHidden || isLeftCollapsed
  const outletRightCollapsed = isReadingRightHidden || isRightCollapsed
  const gridClasses = cn(
    'grid min-h-screen',
    isReadingLeftHidden
      ? 'lg:grid-cols-[1fr]'
      : isLeftCollapsed
        ? 'lg:grid-cols-[96px_1fr]'
        : 'lg:grid-cols-[240px_1fr]',
    isReadingLeftHidden && isReadingRightHidden
      ? 'xl:grid-cols-[1fr]'
      : isReadingLeftHidden
        ? isRightCollapsed
          ? 'xl:grid-cols-[1fr_84px]'
          : 'xl:grid-cols-[1fr_290px]'
        : isReadingRightHidden
          ? isLeftCollapsed
            ? 'xl:grid-cols-[96px_1fr]'
            : 'xl:grid-cols-[240px_1fr]'
          : isRightCollapsed
            ? isLeftCollapsed
              ? 'xl:grid-cols-[96px_1fr_84px]'
              : 'xl:grid-cols-[240px_1fr_84px]'
            : isLeftCollapsed
              ? 'xl:grid-cols-[96px_1fr_290px]'
              : 'xl:grid-cols-[240px_1fr_290px]'
  )

  return (
    <div
      className="min-h-screen bg-surface"
      onClickCapture={handleDemoInternalLinkClick}
      style={{
        '--left-rail-width': isReadingLeftHidden
          ? '0px'
          : isLeftCollapsed
            ? '96px'
            : '240px',
        '--right-rail-width': isReadingRightHidden
          ? '0px'
          : isRightCollapsed
            ? '84px'
            : '290px',
      }}
    >
      <div className={gridClasses}>
        {!isReadingLeftHidden ? (
          <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen">
            <SidebarContent
              collapsed={isLeftCollapsed}
              onBrandNavigate={() => navigate('/app')}
              onLinkNavigate={undefined}
              onToggle={() => setIsLeftCollapsed((value) => !value)}
              showProfileLink={isReadingRightHidden}
            />
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-col">
          <div className="sticky top-0 z-30 bg-surface/88 backdrop-blur">
            <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:h-16 lg:px-8">
              <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-6">
                <div
                  ref={globalSearchRef}
                  className="relative w-full max-w-3xl"
                >
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="text"
                    value={globalSearchQuery}
                    onChange={(event) => {
                      setGlobalSearchQuery(event.target.value)
                      setIsGlobalSearchOpen(true)
                    }}
                    onFocus={() => {
                      if (globalSearchQuery.trim()) {
                        setIsGlobalSearchOpen(true)
                      }
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        globalSearchItems.length > 0
                      ) {
                        event.preventDefault()
                        handleGlobalSearchNavigate(globalSearchItems[0])
                      }

                      if (event.key === 'Escape') {
                        setIsGlobalSearchOpen(false)
                      }
                    }}
                    placeholder="Buscar personajes, objetos, lugares, hechizos..."
                    className="archive-input rounded-full pl-11 pr-4"
                  />
                  {isGlobalSearchOpen && globalSearchQuery.trim() ? (
                    <div className="fixed left-4 right-4 top-[4.75rem] z-50 overflow-hidden rounded-2xl border border-stroke bg-white shadow-card lg:absolute lg:left-0 lg:right-0 lg:top-full lg:mt-2">
                      <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto py-2 lg:max-h-96">
                        {isGlobalSearchLoading ? (
                          <div className="px-4 py-3 text-sm text-ink-soft">
                            Buscando...
                          </div>
                        ) : null}

                        {!isGlobalSearchLoading &&
                        !globalSearchError &&
                        globalSearchItems.length
                          ? globalSearchItems.map((item) => {
                              const Icon = getEntityIcon(item.type)

                              return (
                                <a
                                  key={`${item.type}-${item.id}`}
                                  href={item.url}
                                  onClick={(event) => {
                                    if (
                                      event.button !== 0 ||
                                      event.metaKey ||
                                      event.ctrlKey ||
                                      event.shiftKey ||
                                      event.altKey
                                    ) {
                                      return
                                    }

                                    event.preventDefault()
                                    handleGlobalSearchNavigate(item)
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand/5"
                                >
                                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                                    <Icon className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate font-display text-sm font-bold text-ink">
                                      {item.name}
                                    </span>
                                    <span className="mt-0.5 block font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted">
                                      {GLOBAL_SEARCH_LABELS[item.type] ||
                                        'Resultado'}
                                    </span>
                                  </span>
                                </a>
                              )
                            })
                          : null}

                        {!isGlobalSearchLoading && globalSearchError ? (
                          <div className="px-4 py-3 text-sm text-danger">
                            {globalSearchError}
                          </div>
                        ) : null}

                        {!isGlobalSearchLoading &&
                        !globalSearchError &&
                        !globalSearchItems.length ? (
                          <div className="px-4 py-3 text-sm text-ink-soft">
                            No hay resultados visibles para esta búsqueda.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="hidden">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen((value) => !value)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand text-black transition hover:brightness-95"
                    aria-expanded={isCreateOpen}
                    aria-label="Abrir menú de creación"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" />
                  </button>

                  {isCreateOpen ? (
                    <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                      {[
                        ['Crear Personaje', '/app/personajes/nuevo', true],
                        ['Crear Objeto', '/app/objetos/nuevo', true],
                        ['Crear Lugar', '/app/lugares/nuevo', true],
                        ['Crear Hechizo', '/app/poderes/hechizos/nuevo', true],
                        ['Crear Otro Poder', '/app/poderes/otros/nuevo', true],
                        ['Crear Clase', '/app/clases/nuevo', true],
                        ['Crear Dote', '/app/clases/dotes/nuevo', true],
                        ['Crear Campaña', '/app/campanas/nuevo', true],
                      ].map(([label, target, enabled]) => {
                        const OptionIcon =
                          target === '/app/personajes/nuevo'
                            ? UserCircle2
                            : target === '/app/objetos/nuevo'
                              ? Sword
                              : target === '/app/lugares/nuevo'
                                ? MapPinned
                                : target === '/app/clases/nuevo' ||
                                    target === '/app/clases/dotes/nuevo'
                                  ? GraduationCap
                                  : target.startsWith('/app/poderes/otros')
                                    ? Sparkles
                                    : BookOpen

                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              if (!enabled) {
                                return
                              }

                              setIsCreateOpen(false)
                              navigate(target)
                            }}
                            className={cn(
                              'flex w-full items-center gap-3 px-4 py-3 text-left font-label text-[10px] font-black uppercase tracking-[0.16em] transition',
                              enabled
                                ? 'text-slate-900 hover:bg-brand/10 hover:text-black'
                                : 'cursor-not-allowed text-slate-400'
                            )}
                          >
                            <OptionIcon className="h-4 w-4 shrink-0" />
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="lg:hidden">
                  <CreateDropdown
                    compact
                    isOpen={isCreateOpen}
                    onToggle={() => setIsCreateOpen((value) => !value)}
                    onNavigate={(target) => {
                      setIsCreateOpen(false)
                      navigate(target)
                    }}
                  />
                </div>

                <div className="hidden items-center gap-2 lg:flex">
                  <div className="hidden">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen((value) => !value)}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 font-label text-[11px] font-black uppercase tracking-[0.12em] text-black transition hover:brightness-95"
                      aria-expanded={isCreateOpen}
                      aria-label="Abrir menú de creación"
                    >
                      <Plus className="h-4 w-4 stroke-[3]" />
                      Crear
                    </button>

                    {isCreateOpen ? (
                      <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                        {[
                          ['Crear Personaje', '/app/personajes/nuevo', true],
                          ['Crear Objeto', '/app/objetos/nuevo', true],
                          ['Crear Lugar', '/app/lugares/nuevo', true],
                          [
                            'Crear Hechizo',
                            '/app/poderes/hechizos/nuevo',
                            true,
                          ],
                          [
                            'Crear Otro Poder',
                            '/app/poderes/otros/nuevo',
                            true,
                          ],
                          ['Crear Clase', '/app/clases/nuevo', true],
                          ['Crear Dote', '/app/clases/dotes/nuevo', true],
                          ['Crear Campaña', '/app/campanas/nuevo', true],
                        ].map(([label, target, enabled]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              if (!enabled) {
                                return
                              }

                              setIsCreateOpen(false)
                              navigate(target)
                            }}
                            className={cn(
                              'block w-full px-4 py-3 text-left font-label text-[10px] font-black uppercase tracking-[0.16em] transition',
                              enabled
                                ? 'text-slate-900 hover:bg-brand/10 hover:text-black'
                                : 'cursor-not-allowed text-slate-400'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="hidden items-center gap-3 lg:flex">
                {isReadingLeftHidden ? (
                  <ReadingModeNavigation
                    onNavigate={(target) => navigate(target)}
                  />
                ) : null}

                <CreateDropdown
                  isOpen={isCreateOpen}
                  onToggle={() => setIsCreateOpen((value) => !value)}
                  onNavigate={(target) => {
                    setIsCreateOpen(false)
                    navigate(target)
                  }}
                />

                <NotificationBell
                  paletteColor={paletteColor}
                  onNavigate={(target) => navigate(target)}
                />
                <div ref={settingsDesktopRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen((value) => !value)
                      setIsCreateOpen(false)
                    }}
                    className={cn(
                      'rounded-lg p-2 text-ink-soft transition hover:bg-surface-strong hover:text-brand',
                      isSettingsOpen && 'bg-surface-strong text-brand'
                    )}
                    aria-expanded={isSettingsOpen}
                    aria-label="Configuracion"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                  <SettingsDropdown
                    isOpen={isSettingsOpen}
                    isReadingLeftHidden={isReadingLeftHidden}
                    isReadingRightHidden={isReadingRightHidden}
                    onToggleReadingLeft={() =>
                      setIsReadingLeftHidden((value) => !value)
                    }
                    onToggleReadingRight={() =>
                      setIsReadingRightHidden((value) => !value)
                    }
                    isDarkMode={isDarkMode}
                    isDarkModeLocked={isDarkModeLocked}
                    paletteColor={paletteColor}
                    paletteDraft={paletteDraft}
                    setPaletteDraft={setPaletteDraft}
                    isSavingVisual={isSavingVisual}
                    onToggleDarkMode={handleToggleDarkMode}
                    onSavePalette={handleSavePalette}
                    onLogout={handleLogout}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 lg:hidden">
                <NotificationBell
                  paletteColor={paletteColor}
                  onNavigate={(target) => navigate(target)}
                />
              </div>

              <div ref={settingsMobileRef} className="relative lg:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen((value) => !value)
                    setIsCreateOpen(false)
                  }}
                  className={cn(
                    'inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface-strong text-ink-soft transition hover:bg-white hover:text-brand',
                    isSettingsOpen && 'bg-white text-brand'
                  )}
                  aria-expanded={isSettingsOpen}
                  aria-label="Configuracion"
                >
                  <Settings className="h-5 w-5" />
                </button>
                <SettingsDropdown
                  isOpen={isSettingsOpen}
                  isReadingLeftHidden={isReadingLeftHidden}
                  isReadingRightHidden={isReadingRightHidden}
                  onToggleReadingLeft={() =>
                    setIsReadingLeftHidden((value) => !value)
                  }
                  onToggleReadingRight={() =>
                    setIsReadingRightHidden((value) => !value)
                  }
                  isDarkMode={isDarkMode}
                  isDarkModeLocked={isDarkModeLocked}
                  paletteColor={paletteColor}
                  paletteDraft={paletteDraft}
                  setPaletteDraft={setPaletteDraft}
                  isSavingVisual={isSavingVisual}
                  onToggleDarkMode={handleToggleDarkMode}
                  onSavePalette={handleSavePalette}
                  onLogout={handleLogout}
                />
              </div>

              {!isReadingLeftHidden ? (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface-strong text-ink transition hover:bg-white lg:hidden"
                  aria-label="Abrir navegacion"
                >
                  <Menu className="h-5 w-5" />
                </button>
              ) : null}
            </header>
          </div>

          <main className="min-h-[calc(100vh-4rem)] px-4 py-5 sm:px-6 lg:px-8">
            {isDemoMode ? <DemoModeNotice /> : null}
            <Outlet
              context={{
                isLeftCollapsed: outletLeftCollapsed,
                isRightCollapsed: outletRightCollapsed,
                isReadingMode,
              }}
            />
          </main>
        </div>

        {!isReadingRightHidden ? (
          <UtilityRail
            collapsed={isRightCollapsed}
            onToggle={() => setIsRightCollapsed((value) => !value)}
          />
        ) : null}
      </div>

      {isSidebarOpen && !isReadingLeftHidden ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Cerrar navegacion"
          />
          <div className="absolute inset-y-0 right-0 min-w-[250px] w-[min(50vw,320px)] shadow-glow">
            <SidebarContent
              onBrandNavigate={() => {
                setIsSidebarOpen(false)
                navigate('/app')
              }}
              onLinkNavigate={() => setIsSidebarOpen(false)}
              onToggle={() => setIsSidebarOpen(false)}
              collapsed={false}
              showProfileLink
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
