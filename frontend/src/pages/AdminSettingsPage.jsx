import { createElement, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Database,
  KeyRound,
  Lock,
  RefreshCcw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

import { useAuth } from '../features/auth/auth-context'
import { cn } from '../lib/cn'
import { api } from '../services/http'

const EMPTY_CREATE_FORM = {
  nombreUsuario: '',
  contrasena: '',
  rolCodigo: 'jugador',
}
const EMPTY_USERS = []
const EMPTY_CAMPAIGNS = []

const STAT_LABELS = [
  ['usuarios', 'Usuarios', Users],
  ['administradores', 'Admins', Shield],
  ['campanas', 'Campañas', Database],
  ['personajes', 'Personajes', Activity],
  ['criaturas', 'Criaturas', Activity],
  ['objetos', 'Objetos', Database],
  ['lugares', 'Lugares', Database],
  ['hechizos', 'Hechizos', Database],
  ['poderes', 'Poderes', Database],
  ['comentarios', 'Comentarios', Activity],
  ['favoritos', 'Favoritos', Activity],
  ['sesionesAdminActivas', 'Sesiones admin', Lock],
]

function getApiMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    'No se pudo completar la operación.'
  )
}

async function fetchAdminDashboard() {
  const { data } = await api.get('/admin/dashboard')
  return data
}

async function fetchAdminUsers() {
  const { data } = await api.get('/admin/users')
  return data.items || []
}

async function fetchAdminCampaigns() {
  const { data } = await api.get('/admin/campaigns')
  return data.items || []
}

function StatCard({ label, value, Icon }) {
  return (
    <article className="min-w-0 rounded-2xl border border-stroke bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="break-words font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted [overflow-wrap:anywhere]">
          {label}
        </p>
        {createElement(Icon, { className: 'h-4 w-4 text-brand' })}
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-[-0.05em] text-ink">
        {value ?? 0}
      </p>
    </article>
  )
}

function UserContentSummary({ counts }) {
  if (!counts) {
    return <span className="text-ink-muted">Sin datos</span>
  }

  const total =
    counts.personajesCreados +
    counts.objetos +
    counts.lugares +
    counts.hechizos +
    counts.poderes +
    counts.campanasCreadas +
    counts.comentarios

  return (
    <span>
      {total} vinculados · {counts.campanasMaster} master ·{' '}
      {counts.personajesPropios} propios
    </span>
  )
}

function CampaignContentSummary({ counts }) {
  if (!counts) {
    return <span className="text-ink-muted">Sin datos</span>
  }

  const total =
    counts.personajes +
    counts.objetos +
    counts.lugares +
    counts.poderes +
    counts.hechizos +
    counts.partidas +
    counts.aventuras +
    counts.arcos +
    counts.conceptos

  return (
    <span>
      {total} contenidos - {counts.jugadores} jugadores - {counts.personajes}{' '}
      personajes
    </span>
  )
}

function DestructiveActionDialog({ action, isSaving, onCancel, onConfirm }) {
  const [password, setPassword] = useState('')

  if (!action) {
    return null
  }

  const isUser = action.type === 'user'
  const title = isUser
    ? `Borrar usuario ${action.target.nombreUsuario}`
    : `Borrar campana ${action.target.nombre}`
  const detail = isUser
    ? 'Se borrara su contenido propio y se desvincularan sus elementos de otros contenidos.'
    : 'Se borrara la campana y su contenido interno. Los elementos compartidos con otras campanas se conservaran y se desvincularan.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!password.trim()) {
            return
          }
          onConfirm(password)
        }}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-danger/35 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-stroke px-5 py-4">
          <div className="min-w-0">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-danger">
              Confirmacion destructiva
            </p>
            <h2 className="mt-2 break-words font-display text-2xl font-bold text-ink [overflow-wrap:anywhere]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stroke bg-white text-ink-soft transition hover:border-danger hover:text-danger disabled:opacity-45"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-5">
          <div className="rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm leading-6 text-danger">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{detail}</p>
            </div>
          </div>

          <label className="grid gap-2">
            <span className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-danger">
              Clave especial
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={10}
              autoFocus
              className="archive-input h-12 rounded-xl"
              placeholder="Clave destructiva"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-stroke bg-surface px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-xl border border-stroke bg-white px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-45"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving || password.length < 10}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 className="h-4 w-4" />
            Borrar definitivamente
          </button>
        </div>
      </form>
    </div>
  )
}

function PasswordResetForm({ user, onSubmit, isSaving }) {
  const [password, setPassword] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-brand/35 bg-brand/10 px-3 font-label text-[9px] font-black uppercase tracking-[0.14em] text-brand transition hover:bg-brand hover:text-black min-[2200px]:w-auto"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Cambiar contraseña
      </button>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!password.trim()) {
          return
        }
        onSubmit(user.id, password).then(() => {
          setPassword('')
          setIsOpen(false)
        })
      }}
      className="grid min-w-0 gap-2 rounded-xl border border-brand/25 bg-brand/5 p-2 sm:grid-cols-[minmax(15rem,1fr)_auto_auto] min-[2200px]:col-span-2 min-[2200px]:min-w-[26rem] min-[2200px]:grid-cols-[minmax(17rem,1fr)_auto_auto] min-[2200px]:bg-transparent min-[2200px]:p-0"
    >
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        type="password"
        minLength={10}
        autoFocus
        placeholder="Nueva contraseña"
        className="archive-input h-10 min-w-[15rem] rounded-xl text-xs min-[2200px]:min-w-[17rem]"
      />
      <button
        type="submit"
        disabled={isSaving || password.length < 10}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3 font-label text-[9px] font-black uppercase tracking-[0.14em] text-brand transition hover:bg-brand hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Cambiar
      </button>
      <button
        type="button"
        onClick={() => {
          setPassword('')
          setIsOpen(false)
        }}
        disabled={isSaving}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-stroke bg-white px-3 font-label text-[9px] font-black uppercase tracking-[0.14em] text-ink-soft transition hover:border-danger hover:text-danger disabled:opacity-45"
      >
        Cancelar
      </button>
    </form>
  )
}

function BlockerList({ blockers }) {
  if (!blockers) {
    return null
  }

  const active = Object.entries(blockers).filter(([, value]) => value > 0)

  if (!active.length) {
    return null
  }

  return (
    <div className="mt-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
      <p className="font-bold">Contenido que bloquea el borrado:</p>
      <p className="mt-1">
        {active.map(([key, value]) => `${key}: ${value}`).join(' · ')}
      </p>
    </div>
  )
}

function AdminAuditList({ entries = [] }) {
  if (!entries.length) {
    return (
      <p className="mt-4 rounded-2xl border border-stroke bg-white px-4 py-3 text-sm text-ink-muted">
        Todavía no hay acciones administrativas registradas.
      </p>
    )
  }

  return (
    <div className="mt-4 min-w-0 divide-y divide-stroke overflow-hidden rounded-2xl border border-stroke bg-white">
      {entries.map((entry) => (
        <article key={entry.id} className="px-4 py-3">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-bold text-ink [overflow-wrap:anywhere] sm:truncate">
                {entry.resumen || entry.accion}
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-ink-muted [overflow-wrap:anywhere]">
                {entry.actorNombreUsuario || 'Administrador eliminado'} ·{' '}
                {entry.entidadTipo || 'sistema'}
              </p>
            </div>
            <time className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted sm:text-right">
              {new Date(entry.creadoEn).toLocaleDateString()}
            </time>
          </div>
        </article>
      ))}
    </div>
  )
}

export function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM)
  const [registrationDraft, setRegistrationDraft] = useState({
    maxUsuarios: '',
    registroHabilitado: null,
    nuevaClaveRegistro: '',
  })
  const [feedback, setFeedback] = useState('')
  const [blockers, setBlockers] = useState(null)
  const [zoneUnlocked, setZoneUnlocked] = useState(false)
  const [zonePassword, setZonePassword] = useState('')
  const [zoneFeedback, setZoneFeedback] = useState('')
  const [zoneExpiresAt, setZoneExpiresAt] = useState(null)
  const [destructiveAction, setDestructiveAction] = useState(null)

  const dashboardQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: fetchAdminDashboard,
    staleTime: 30 * 1000,
    enabled: zoneUnlocked,
  })
  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchAdminUsers,
    staleTime: 30 * 1000,
    enabled: zoneUnlocked,
  })
  const campaignsQuery = useQuery({
    queryKey: ['admin', 'campaigns'],
    queryFn: fetchAdminCampaigns,
    staleTime: 30 * 1000,
    enabled: zoneUnlocked,
  })

  const dashboard = dashboardQuery.data
  const users = usersQuery.data || EMPTY_USERS
  const campaigns = campaignsQuery.data || EMPTY_CAMPAIGNS
  const sortedUsers = useMemo(
    () =>
      [...users].sort((left, right) =>
        String(left.nombreUsuario).localeCompare(String(right.nombreUsuario))
      ),
    [users]
  )
  const sortedCampaigns = useMemo(
    () =>
      [...campaigns].sort((left, right) =>
        String(left.nombre).localeCompare(String(right.nombre))
      ),
    [campaigns]
  )

  const refreshAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  useEffect(() => {
    if (!zoneExpiresAt) {
      return undefined
    }

    const remainingMs = Math.max(
      new Date(zoneExpiresAt).getTime() - Date.now(),
      0
    )
    const timeoutId = window.setTimeout(() => {
      setZoneUnlocked(false)
      setZoneExpiresAt(null)
      setZoneFeedback('La zona administrativa ha caducado. Vuelve a entrar.')
      queryClient.removeQueries({ queryKey: ['admin'] })
    }, remainingMs)

    return () => window.clearTimeout(timeoutId)
  }, [queryClient, zoneExpiresAt])

  const unlockAdminZoneMutation = useMutation({
    mutationFn: async (claveZonaAdmin) => {
      const { data } = await api.post('/admin/zone/unlock', {
        claveZonaAdmin,
      })
      return data.zonaAdmin
    },
    onSuccess: (zonaAdmin) => {
      setZoneUnlocked(true)
      setZonePassword('')
      setZoneFeedback('')
      setZoneExpiresAt(zonaAdmin?.expiraEn || null)
      refreshAdminData()
    },
    onError: (error) => setZoneFeedback(getApiMessage(error)),
  })

  const createUserMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/admin/users', payload)
      return data.item
    },
    onSuccess: (createdUser) => {
      setFeedback(`Usuario ${createdUser.nombreUsuario} creado correctamente.`)
      setCreateForm(EMPTY_CREATE_FORM)
      refreshAdminData()
    },
    onError: (error) => setFeedback(getApiMessage(error)),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, nuevaContrasena }) => {
      const { data } = await api.patch(`/admin/users/${userId}/password`, {
        nuevaContrasena,
      })
      return data
    },
    onSuccess: () => {
      setFeedback('Contraseña actualizada correctamente.')
      refreshAdminData()
    },
    onError: (error) => setFeedback(getApiMessage(error)),
  })

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId, claveDestructiva }) => {
      const { data } = await api.delete(`/admin/users/${userId}`, {
        data: { claveDestructiva },
      })
      return data
    },
    onSuccess: () => {
      setFeedback('Usuario y contenido vinculado borrados correctamente.')
      setBlockers(null)
      setDestructiveAction(null)
      refreshAdminData()
    },
    onError: (error) => {
      setFeedback(getApiMessage(error))
      setBlockers(error?.response?.data?.details?.blockers || null)
    },
  })

  const deleteCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, claveDestructiva }) => {
      const { data } = await api.delete(`/admin/campaigns/${campaignId}`, {
        data: { claveDestructiva },
      })
      return data
    },
    onSuccess: () => {
      setFeedback('Campana y contenido interno borrados correctamente.')
      setBlockers(null)
      setDestructiveAction(null)
      refreshAdminData()
    },
    onError: (error) => setFeedback(getApiMessage(error)),
  })

  const registrationMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.patch('/settings/registration', payload)
      return data
    },
    onSuccess: () => {
      setFeedback('Configuración de registro actualizada.')
      refreshAdminData()
    },
    onError: (error) => setFeedback(getApiMessage(error)),
  })

  const registrationCodeMutation = useMutation({
    mutationFn: async (nuevaClaveRegistro) => {
      const { data } = await api.patch('/settings/registration/code', {
        nuevaClaveRegistro,
      })
      return data
    },
    onSuccess: () => {
      setFeedback('Clave de registro actualizada.')
      setRegistrationDraft((current) => ({
        ...current,
        nuevaClaveRegistro: '',
      }))
    },
    onError: (error) => setFeedback(getApiMessage(error)),
  })

  function updateCreateForm(patch) {
    setCreateForm((current) => ({ ...current, ...patch }))
  }

  function resetPassword(userId, nuevaContrasena) {
    return resetPasswordMutation.mutateAsync({ userId, nuevaContrasena })
  }

  function deleteUser(targetUser) {
    setDestructiveAction({ type: 'user', target: targetUser })
  }

  function deleteCampaign(targetCampaign) {
    setDestructiveAction({ type: 'campaign', target: targetCampaign })
  }

  function confirmDestructiveAction(claveDestructiva) {
    if (!destructiveAction) {
      return
    }

    if (destructiveAction.type === 'user') {
      deleteUserMutation.mutate({
        userId: destructiveAction.target.id,
        claveDestructiva,
      })
      return
    }

    deleteCampaignMutation.mutate({
      campaignId: destructiveAction.target.id,
      claveDestructiva,
    })
  }

  if (!zoneUnlocked) {
    return (
      <section className="grid min-w-0 gap-4 pb-8 sm:gap-6">
        <div className="panel min-w-0 overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="font-label text-[10px] font-black uppercase tracking-[0.24em] text-brand">
                Administración
              </p>
              <h1 className="mt-3 break-words font-display text-3xl font-bold tracking-[-0.05em] text-ink [overflow-wrap:anywhere] sm:text-4xl">
                Zona segura
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft [overflow-wrap:anywhere]">
                Introduce la clave de zona administrativa para abrir las
                herramientas sensibles de WikiCodex.
              </p>
            </div>
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand sm:w-auto">
              <Lock className="h-4 w-4" />
              Reautenticación
            </div>
          </div>
        </div>

        <article className="panel min-w-0 max-w-xl p-4 sm:p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (zonePassword.length < 10) {
                return
              }
              unlockAdminZoneMutation.mutate(zonePassword)
            }}
            className="grid min-w-0 gap-3"
          >
            <label className="grid min-w-0 gap-2">
              <span className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                Clave de zona
              </span>
              <input
                value={zonePassword}
                onChange={(event) => setZonePassword(event.target.value)}
                type="password"
                minLength={10}
                autoFocus
                className="archive-input h-12 min-w-0 rounded-xl"
                placeholder="Clave de administración"
              />
            </label>
            <button
              type="submit"
              disabled={
                unlockAdminZoneMutation.isPending || zonePassword.length < 10
              }
              className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Shield className="h-4 w-4" />
              Entrar en administración
            </button>
          </form>

          {zoneFeedback ? (
            <p className="mt-4 min-w-0 break-words rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger [overflow-wrap:anywhere]">
              {zoneFeedback}
            </p>
          ) : null}
        </article>
      </section>
    )
  }

  const registration = dashboard?.registro
  const registrationEnabled =
    registrationDraft.registroHabilitado ??
    Boolean(registration?.configuracion?.registroHabilitado)

  return (
    <section className="grid min-w-0 gap-4 pb-8 sm:gap-6">
      {destructiveAction ? (
        <DestructiveActionDialog
          key={`${destructiveAction.type}-${destructiveAction.target.id}`}
          action={destructiveAction}
          isSaving={
            deleteUserMutation.isPending || deleteCampaignMutation.isPending
          }
          onCancel={() => setDestructiveAction(null)}
          onConfirm={confirmDestructiveAction}
        />
      ) : null}

      <div className="panel min-w-0 overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.24em] text-brand">
              Administración
            </p>
            <h1 className="mt-3 break-words font-display text-3xl font-bold tracking-[-0.05em] text-ink [overflow-wrap:anywhere] sm:text-4xl">
              Panel de control
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft [overflow-wrap:anywhere]">
              Estadísticas globales, usuarios, registro y herramientas críticas
              para mantener WikiCodex bajo control.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAdminData}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand sm:w-auto"
          >
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="min-w-0 break-words rounded-2xl border border-brand/30 bg-brand/10 px-4 py-4 text-sm font-semibold text-brand [overflow-wrap:anywhere] sm:px-5">
          {feedback}
          <BlockerList blockers={blockers} />
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {STAT_LABELS.map(([key, label, Icon]) => (
          <StatCard
            key={key}
            label={label}
            value={dashboard?.estadisticas?.[key]}
            Icon={Icon}
          />
        ))}
      </div>

      <div className="grid min-w-0 gap-5">
        <article className="panel min-w-0 overflow-hidden p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                Usuarios
              </p>
              <h2 className="mt-2 break-words font-display text-2xl font-bold text-ink [overflow-wrap:anywhere]">
                Cuentas y credenciales
              </h2>
            </div>
            <span className="archive-chip self-start sm:self-auto">
              {users.length} cuentas
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-stroke">
            <div className="hidden grid-cols-[minmax(10rem,1fr)_7rem_minmax(10rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_5.5rem] gap-3 border-b border-stroke bg-surface-strong px-4 py-3 font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted min-[2200px]:grid">
              <span>Usuario</span>
              <span>Rol</span>
              <span>Actividad</span>
              <span className="col-span-2">Contraseña</span>
              <span>Acciones</span>
            </div>

            <div className="divide-y divide-stroke bg-white">
              {usersQuery.isLoading ? (
                <p className="px-4 py-6 text-sm text-ink-soft">
                  Cargando usuarios...
                </p>
              ) : null}

              {sortedUsers.map((item) => {
                const isSelf = item.id === user?.id
                return (
                  <div
                    key={item.id}
                    className="grid min-w-0 gap-3 px-4 py-4 min-[2200px]:grid-cols-[minmax(10rem,1fr)_7rem_minmax(10rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_5.5rem] min-[2200px]:items-center"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-ink [overflow-wrap:anywhere] min-[2200px]:truncate">
                        {item.nombreUsuario}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Alta: {new Date(item.creadoEn).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="grid gap-1">
                      <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted min-[2200px]:hidden">
                        Rol
                      </span>
                      <span
                        className={cn(
                          'archive-chip justify-self-start',
                          item.rol?.codigo === 'administrador'
                            ? 'border-brand/40 bg-brand/10 text-brand'
                            : ''
                        )}
                      >
                        {item.rol?.nombre || 'Sin rol'}
                      </span>
                    </div>
                    <div className="grid min-w-0 gap-1 text-xs leading-5 text-ink-soft">
                      <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted min-[2200px]:hidden">
                        Actividad
                      </span>
                      <UserContentSummary counts={item.conteos} />
                    </div>
                    <PasswordResetForm
                      user={item}
                      onSubmit={resetPassword}
                      isSaving={resetPasswordMutation.isPending}
                    />
                    <button
                      type="button"
                      onClick={() => deleteUser(item)}
                      disabled={isSelf || deleteUserMutation.isPending}
                      title={
                        isSelf
                          ? 'No puedes borrar tu propia cuenta'
                          : 'Borrar usuario y contenido'
                      }
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 font-label text-[9px] font-black uppercase tracking-[0.14em] text-danger transition hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-45 min-[2200px]:w-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Borrar
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </article>

        <article className="panel min-w-0 overflow-hidden p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                Campanas
              </p>
              <h2 className="mt-2 break-words font-display text-2xl font-bold text-ink [overflow-wrap:anywhere]">
                Mundos y partidas
              </h2>
            </div>
            <span className="archive-chip self-start sm:self-auto">
              {campaigns.length} campanas
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-stroke">
            <div className="hidden grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.8fr)_minmax(12rem,1fr)_5.5rem] gap-3 border-b border-stroke bg-surface-strong px-4 py-3 font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted min-[1800px]:grid">
              <span>Campana</span>
              <span>Master</span>
              <span>Contenido</span>
              <span>Acciones</span>
            </div>

            <div className="divide-y divide-stroke bg-white">
              {campaignsQuery.isLoading ? (
                <p className="px-4 py-6 text-sm text-ink-soft">
                  Cargando campanas...
                </p>
              ) : null}

              {!campaignsQuery.isLoading && !sortedCampaigns.length ? (
                <p className="px-4 py-6 text-sm text-ink-soft">
                  No hay campanas creadas.
                </p>
              ) : null}

              {sortedCampaigns.map((item) => (
                <div
                  key={item.id}
                  className="grid min-w-0 gap-3 px-4 py-4 min-[1800px]:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.8fr)_minmax(12rem,1fr)_5.5rem] min-[1800px]:items-center"
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-ink [overflow-wrap:anywhere] min-[1800px]:truncate">
                      {item.nombre}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Actualizada:{' '}
                      {new Date(item.actualizadoEn).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-1 text-xs leading-5 text-ink-soft">
                    <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted min-[1800px]:hidden">
                      Master
                    </span>
                    <span className="break-words [overflow-wrap:anywhere]">
                      {item.master?.nombreUsuario || 'Sin master'}
                    </span>
                  </div>
                  <div className="grid min-w-0 gap-1 text-xs leading-5 text-ink-soft">
                    <span className="font-label text-[9px] font-black uppercase tracking-[0.16em] text-ink-muted min-[1800px]:hidden">
                      Contenido
                    </span>
                    <CampaignContentSummary counts={item.conteos} />
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCampaign(item)}
                    disabled={deleteCampaignMutation.isPending}
                    title="Borrar campana y contenido interno"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 font-label text-[9px] font-black uppercase tracking-[0.14em] text-danger transition hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-45 min-[1800px]:w-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Borrar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="grid min-w-0 gap-5 md:grid-cols-2">
          <article className="panel min-w-0 p-4 sm:p-5">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
              Crear cuenta
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                createUserMutation.mutate(createForm)
              }}
              className="mt-4 grid gap-3"
            >
              <input
                value={createForm.nombreUsuario}
                onChange={(event) =>
                  updateCreateForm({ nombreUsuario: event.target.value })
                }
                className="archive-input h-11 rounded-xl"
                placeholder="Nombre de usuario"
              />
              <input
                value={createForm.contrasena}
                onChange={(event) =>
                  updateCreateForm({ contrasena: event.target.value })
                }
                type="password"
                minLength={10}
                className="archive-input h-11 rounded-xl"
                placeholder="Contraseña temporal"
              />
              <div className="rounded-xl border border-stroke bg-white px-4 py-3 text-sm font-semibold text-ink-soft">
                Rol: Jugador
              </div>
              <button
                type="submit"
                disabled={
                  createUserMutation.isPending ||
                  !createForm.nombreUsuario.trim() ||
                  createForm.contrasena.length < 10
                }
                className="theme-solid-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <UserPlus className="h-4 w-4" />
                Crear usuario
              </button>
            </form>
          </article>

          <article className="panel min-w-0 p-4 sm:p-5">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
              Registro
            </p>
            <div className="mt-3 rounded-2xl border border-stroke bg-white p-4 text-sm leading-6 text-ink-soft">
              <p>
                Usuarios: {registration?.capacidad?.totalUsuarios ?? '-'} /{' '}
                {registration?.configuracion?.maxUsuarios ?? '-'}
              </p>
              <p>
                Plazas libres: {registration?.capacidad?.plazasRestantes ?? '-'}
              </p>
              <p>
                Estado:{' '}
                {registration?.configuracion?.registroHabilitado
                  ? 'abierto'
                  : 'cerrado'}
              </p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const payload = {}
                if (registrationDraft.maxUsuarios) {
                  payload.maxUsuarios = Number(registrationDraft.maxUsuarios)
                }
                payload.registroHabilitado = registrationEnabled
                registrationMutation.mutate(payload)
              }}
              className="mt-4 grid gap-3"
            >
              <input
                value={registrationDraft.maxUsuarios}
                onChange={(event) =>
                  setRegistrationDraft((current) => ({
                    ...current,
                    maxUsuarios: event.target.value,
                  }))
                }
                className="archive-input h-11 rounded-xl"
                inputMode="numeric"
                placeholder="Nuevo máximo de usuarios"
              />
              <label className="flex items-center gap-2 rounded-xl border border-stroke bg-white px-3 py-3 text-sm font-semibold text-ink-soft">
                <input
                  type="checkbox"
                  checked={registrationEnabled}
                  onChange={(event) =>
                    setRegistrationDraft((current) => ({
                      ...current,
                      registroHabilitado: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                Registro abierto
              </label>
              <button
                type="submit"
                disabled={registrationMutation.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-45"
              >
                <RefreshCcw className="h-4 w-4" />
                Guardar registro
              </button>
            </form>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (registrationDraft.nuevaClaveRegistro.length >= 10) {
                  registrationCodeMutation.mutate(
                    registrationDraft.nuevaClaveRegistro
                  )
                }
              }}
              className="mt-4 grid gap-3 border-t border-stroke pt-4"
            >
              <input
                value={registrationDraft.nuevaClaveRegistro}
                onChange={(event) =>
                  setRegistrationDraft((current) => ({
                    ...current,
                    nuevaClaveRegistro: event.target.value,
                  }))
                }
                type="password"
                minLength={10}
                className="archive-input h-11 rounded-xl"
                placeholder="Nueva clave de registro"
              />
              <button
                type="submit"
                disabled={
                  registrationCodeMutation.isPending ||
                  registrationDraft.nuevaClaveRegistro.length < 10
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand transition hover:bg-brand hover:text-black disabled:opacity-45"
              >
                <KeyRound className="h-4 w-4" />
                Cambiar clave
              </button>
            </form>
          </article>

          <article className="panel min-w-0 p-4 sm:p-5">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
              Auditoría
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink">
              Últimas acciones
            </h2>
            <AdminAuditList entries={dashboard?.auditoriaReciente || []} />
          </article>

          <article className="min-w-0 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm leading-6 text-danger sm:p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Las acciones de administrador quedan auditadas. El borrado de
                usuarios y campanas exige una clave destructiva adicional para
                evitar perdida accidental de datos.
              </p>
            </div>
          </article>
        </aside>
      </div>
    </section>
  )
}
