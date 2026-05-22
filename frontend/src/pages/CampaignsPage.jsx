import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  Plus,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { cn } from '../lib/cn'
import { fetchCampaigns } from './campaign-detail/api'

function CampaignCard({ campaign }) {
  const location = useLocation()

  return (
    <Link
      to={`/app/campanas/${campaign.id}`}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="theme-sheet-card archive-responsive-card group block overflow-hidden border shadow-card transition hover:-translate-y-1 hover:border-brand/50"
    >
      <div className="theme-brand-gradient archive-responsive-image relative min-h-56 overflow-hidden p-5 text-white sm:p-6">
        {campaign.imagenUrl ? (
          <CloudinaryImage
            src={campaign.imagenUrl}
            alt={campaign.nombre}
            variant="card"
            sizes="(min-width: 1280px) 26vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-300 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
        <div className="absolute right-4 top-4 max-w-[calc(100%-2rem)] rounded-full bg-black/30 px-3 py-1 font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand sm:right-6 sm:top-6">
          {campaign.rolEnCampana || 'Miembro'}
        </div>
        <div className="absolute bottom-5 left-5 right-5 sm:bottom-6 sm:left-6 sm:right-6">
          <p className="font-label text-[9px] font-black uppercase tracking-[0.24em] text-brand">
            Campaña activa
          </p>
          <h2 className="mt-2 line-clamp-3 break-words font-display text-3xl font-bold tracking-normal [overflow-wrap:anywhere] sm:line-clamp-2 sm:text-4xl sm:tracking-[-0.06em]">
            {campaign.nombre}
          </h2>
        </div>
      </div>

      <div className="archive-responsive-body p-6">
        <p className="line-clamp-4 text-sm leading-7 text-ink-soft">
          {campaign.descripcion || 'Sin descripción registrada.'}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            {
              icon: Users,
              value: campaign.totalJugadores,
              label: 'Jugadores',
            },
            {
              icon: BookOpen,
              value: campaign.totalAventuras,
              label: 'Aventuras',
            },
            {
              icon: Shield,
              value: campaign.totalArcos,
              label: 'Arcos',
            },
            {
              icon: CalendarDays,
              value: campaign.totalPartidas,
              label: 'Partidas',
            },
          ].map((item) => {
            const ItemIcon = item.icon

            return (
              <div
                key={item.label}
                className="rounded-xl border border-stroke bg-surface px-4 py-3 transition group-hover:border-brand/35 group-hover:bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <ItemIcon className="h-4 w-4 text-brand" />
                  <span className="font-display text-2xl font-bold leading-none text-ink">
                    {item.value || 0}
                  </span>
                </div>
                <p className="mt-2 font-label text-[9px] font-black uppercase tracking-[0.18em] text-ink-muted">
                  {item.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </Link>
  )
}

export function CampaignsPage() {
  const outletContext = useOutletContext() || {}
  const hasCollapsedSidebar = Boolean(
    outletContext.isLeftCollapsed || outletContext.isRightCollapsed
  )
  const expandedGrid = Boolean(
    outletContext.isLeftCollapsed && outletContext.isRightCollapsed
  )
  const { data, isLoading, isError } = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
    staleTime: 60 * 1000,
  })
  const campaigns = useMemo(() => data || [], [data])
  const stats = useMemo(
    () => ({
      players: campaigns.reduce(
        (total, campaign) => total + (campaign.totalJugadores || 0),
        0
      ),
      adventures: campaigns.reduce(
        (total, campaign) => total + (campaign.totalAventuras || 0),
        0
      ),
      sessions: campaigns.reduce(
        (total, campaign) => total + (campaign.totalPartidas || 0),
        0
      ),
    }),
    [campaigns]
  )

  return (
    <div
      className={cn(
        'mx-auto w-full',
        hasCollapsedSidebar ? 'max-w-none' : 'max-w-7xl'
      )}
    >
      <section className="theme-sheet-shell overflow-hidden shadow-card">
        <div className="theme-sheet-frame border px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-label text-[10px] font-black uppercase tracking-[0.24em] text-brand">
                Campañas
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
                Campañas activas
              </h1>
              <p className="theme-sheet-copy mt-4 max-w-3xl text-base leading-8">
                Consulta las campañas visibles para tu usuario. Cada campaña
                tiene ahora su propia ficha de detalle, creación y edición.
              </p>
            </div>
            <Link
              to="/app/campanas/nuevo"
              className="theme-solid-button inline-flex items-center justify-center gap-2 px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.18em]"
            >
              <Plus className="h-4 w-4" />
              Crear campaña
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div className="theme-sheet-soft border px-4 py-3">
              <p className="font-display text-2xl font-bold text-ink">
                {campaigns.length}
              </p>
              <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                Activas
              </p>
            </div>
            <div className="theme-sheet-soft border px-4 py-3">
              <p className="font-display text-2xl font-bold text-ink">
                {stats.players}
              </p>
              <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                Jugadores
              </p>
            </div>
            <div className="theme-sheet-soft border px-4 py-3">
              <p className="font-display text-2xl font-bold text-ink">
                {stats.adventures}
              </p>
              <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                Aventuras
              </p>
            </div>
            <div className="theme-sheet-soft border px-4 py-3">
              <p className="font-display text-2xl font-bold text-ink">
                {stats.sessions}
              </p>
              <p className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                Partidas
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        {isLoading ? (
          <div className="theme-sheet-card border p-8 text-sm text-ink-soft shadow-card">
            Cargando campañas...
          </div>
        ) : null}

        {isError ? (
          <div className="theme-sheet-card border border-danger/40 p-8 text-sm font-semibold text-danger shadow-card">
            No se pudieron cargar las campañas.
          </div>
        ) : null}

        {!isLoading && !isError && !campaigns.length ? (
          <div className="theme-sheet-card border p-8 text-center shadow-card">
            <Sparkles className="mx-auto h-10 w-10 text-brand" />
            <h2 className="mt-4 font-display text-2xl font-bold text-ink">
              Aún no hay campañas visibles
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-soft">
              Crea una campaña o pide a un master que te añada como jugador.
            </p>
            <Link
              to="/app/campanas/nuevo"
              className="theme-solid-button mt-5 inline-flex px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.18em]"
            >
              Crear campaña
            </Link>
          </div>
        ) : null}

        <div
          className={cn(
            'archive-responsive-grid campaigns-mobile-list grid gap-5',
            campaigns.length > 0 &&
              (expandedGrid
                ? 'sm:grid-cols-2 lg:grid-cols-4'
                : 'sm:grid-cols-2 lg:grid-cols-3')
          )}
        >
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      </section>
    </div>
  )
}
