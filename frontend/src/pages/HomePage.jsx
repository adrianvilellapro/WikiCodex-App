import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Link,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom'
import { UserRound } from 'lucide-react'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { ObjectPreviewImage } from '../components/ui/ObjectPreviewImage'
import { PlacePreviewImage } from '../components/ui/PlacePreviewImage'
import { api } from '../services/http'
import { fetchObjects } from './object-detail/api'
import { fetchPlaces } from './place-detail/api'

const HOME_RETURN_STORAGE_KEY = 'wikicodex:return-to-home'

async function fetchRecentCharacters() {
  const { data } = await api.get('/characters/recent', {
    params: {
      limit: 20,
    },
  })

  return data
}

async function fetchRecentObjects() {
  return fetchObjects({ limit: 20 })
}

async function fetchRecentPlaces() {
  return fetchPlaces({ limit: 20 })
}

function CharacterCard({ item }) {
  const isPreviewOnly = item.modoVista === 'preview'
  const location = useLocation()

  function rememberHomeScrollPosition() {
    sessionStorage.setItem(
      HOME_RETURN_STORAGE_KEY,
      JSON.stringify({
        pathname: location.pathname,
        scrollY: window.scrollY,
      })
    )
  }

  return (
    <Link
      to={`/app/personajes/${item.id}`}
      onClick={rememberHomeScrollPosition}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="archive-card-virtual archive-responsive-card group block rounded-lg bg-white p-2 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="archive-responsive-image relative h-96 overflow-hidden rounded-md bg-surface-strong">
        {item.imagenPrincipalUrl ? (
          <CloudinaryImage
            src={item.imagenPrincipalUrl}
            alt={item.nombre}
            variant="card"
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 33vw, 50vw"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
            <UserRound className="h-12 w-12" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="archive-responsive-body px-2 pb-2 pt-4">
        <h3 className="truncate font-display text-xl font-bold tracking-[-0.05em] text-ink">
          {item.nombre}
        </h3>
        <p className="mt-1 truncate text-sm text-ink-soft">
          {item.titulo || 'Sin titulo registrado'}
        </p>
        <div className="mt-3">
          <span
            className={`archive-chip ${
              isPreviewOnly
                ? 'border-slate-300 bg-slate-100 text-slate-600'
                : 'border-brand/40 bg-brand/10 text-brand'
            }`}
          >
            {isPreviewOnly ? 'Solo vista previa' : 'Acceso completo'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function ObjectCard({ item }) {
  const isPreviewOnly = item.modoVista === 'preview'
  const location = useLocation()

  function rememberHomeScrollPosition() {
    sessionStorage.setItem(
      HOME_RETURN_STORAGE_KEY,
      JSON.stringify({
        pathname: location.pathname,
        scrollY: window.scrollY,
      })
    )
  }

  return (
    <Link
      to={`/app/objetos/${item.id}`}
      onClick={rememberHomeScrollPosition}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="archive-card-virtual archive-responsive-card group block rounded-lg bg-white p-2 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="archive-responsive-image relative h-72 overflow-hidden rounded-md bg-surface-strong">
        <ObjectPreviewImage
          src={item.imagenPrincipalUrl}
          alt={item.nombre}
          className="h-full w-full"
          sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 50vw"
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="archive-responsive-body px-2 pb-2 pt-4">
        <h3 className="truncate font-display text-xl font-bold tracking-[-0.05em] text-ink">
          {item.nombre}
        </h3>
        <p className="mt-1 truncate text-sm text-ink-soft">
          {item.tier?.nombre || 'Objeto'}
        </p>
        <div className="mt-3">
          <span
            className={`archive-chip ${
              isPreviewOnly
                ? 'border-slate-300 bg-slate-100 text-slate-600'
                : 'border-brand/40 bg-brand/10 text-brand'
            }`}
          >
            {isPreviewOnly ? 'Solo vista previa' : 'Acceso completo'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function PlaceCard({ item }) {
  const isPreviewOnly = item.modoVista === 'preview'
  const location = useLocation()

  function rememberHomeScrollPosition() {
    sessionStorage.setItem(
      HOME_RETURN_STORAGE_KEY,
      JSON.stringify({
        pathname: location.pathname,
        scrollY: window.scrollY,
      })
    )
  }

  return (
    <Link
      to={`/app/lugares/${item.id}`}
      onClick={rememberHomeScrollPosition}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="archive-card-virtual archive-responsive-card group block rounded-lg bg-white p-2 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
    >
      <PlacePreviewImage
        src={item.imagenPrincipalUrl}
        alt={item.nombre}
        className="archive-responsive-image h-72 rounded-md"
        sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 50vw"
      />

      <div className="archive-responsive-body px-2 pb-2 pt-4">
        <p className="font-label text-[9px] font-black uppercase tracking-[0.22em] text-brand">
          {item.tipo?.nombre || 'Lugar'}
        </p>
        <h3 className="mt-1 truncate font-display text-xl font-bold tracking-[-0.05em] text-ink">
          {item.nombre}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-soft">
          {item.descripcion || 'Lugar sin descripción visible.'}
        </p>
        <div className="mt-3">
          <span
            className={`archive-chip ${
              isPreviewOnly
                ? 'border-slate-300 bg-slate-100 text-slate-600'
                : 'border-brand/40 bg-brand/10 text-brand'
            }`}
          >
            {isPreviewOnly ? 'Solo vista previa' : 'Acceso completo'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function CharacterGridSkeleton({ expandedGrid }) {
  return (
    <div
      className={
        expandedGrid
          ? 'archive-responsive-grid grid grid-cols-2 gap-4 lg:grid-cols-6'
          : 'archive-responsive-grid grid grid-cols-2 gap-4 lg:grid-cols-5'
      }
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg bg-white p-2 opacity-45 shadow-card"
        >
          <div className="h-96 rounded-md bg-surface-strong" />
          <div className="space-y-2 px-2 pb-2 pt-4">
            <div className="h-5 w-3/4 rounded bg-surface-strong" />
            <div className="h-4 w-1/2 rounded bg-surface-strong" />
            <div className="h-6 w-24 rounded bg-surface-strong" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function HomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const expandedGrid =
    Boolean(outletContext.isLeftCollapsed) &&
    Boolean(outletContext.isRightCollapsed)
  const expandedObjectGrid = expandedGrid

  const { data, isLoading, isError } = useQuery({
    queryKey: ['characters', 'recent', 20],
    queryFn: fetchRecentCharacters,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
  const {
    data: objectData,
    isLoading: isObjectsLoading,
    isError: isObjectsError,
  } = useQuery({
    queryKey: ['objects', 'recent', 20],
    queryFn: fetchRecentObjects,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
  const {
    data: placeData,
    isLoading: isPlacesLoading,
    isError: isPlacesError,
  } = useQuery({
    queryKey: ['places', 'recent', 20],
    queryFn: fetchRecentPlaces,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const recentCharacters = data?.items || []
  const totalVisibleCharacters = data?.meta?.totalVisible || 0
  const recentObjects = objectData?.items || []
  const totalVisibleObjects = objectData?.meta?.totalVisible || 0
  const recentPlaces = placeData?.items || []
  const totalVisiblePlaces = placeData?.meta?.totalVisible || 0

  useEffect(() => {
    if (typeof location.state?.restoreScrollY !== 'number') {
      const storedReturnTo = sessionStorage.getItem(HOME_RETURN_STORAGE_KEY)

      if (!storedReturnTo) {
        return
      }

      try {
        const parsed = JSON.parse(storedReturnTo)

        if (parsed?.pathname !== location.pathname) {
          return
        }

        requestAnimationFrame(() => {
          window.scrollTo({
            top: parsed.scrollY || 0,
            left: 0,
            behavior: 'auto',
          })
          sessionStorage.removeItem(HOME_RETURN_STORAGE_KEY)
        })
      } catch {
        sessionStorage.removeItem(HOME_RETURN_STORAGE_KEY)
      }

      return
    }

    const restoreScrollY = location.state.restoreScrollY

    requestAnimationFrame(() => {
      window.scrollTo({ top: restoreScrollY, left: 0, behavior: 'auto' })
      sessionStorage.removeItem(HOME_RETURN_STORAGE_KEY)
      navigate(location.pathname, { replace: true, state: {} })
    })
  }, [location.pathname, location.state, navigate])

  return (
    <section className="grid gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.24em] text-ink-muted">
            Inicio
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.06em] text-ink">
            Personajes recientes
          </h1>
        </div>
        <p className="hidden items-center gap-2 font-label text-[11px] font-bold uppercase tracking-[0.14em] text-brand sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-brand" />
          {totalVisibleCharacters} personajes visibles en WikiCodex
        </p>
      </div>

      {isLoading ? <CharacterGridSkeleton expandedGrid={expandedGrid} /> : null}

      {!isLoading && isError ? (
        <article className="panel px-6 py-8 text-sm text-danger">
          No se pudieron cargar los personajes recientes. Revisa la sesion o el
          estado del backend.
        </article>
      ) : null}

      {!isLoading && !isError && recentCharacters.length === 0 ? (
        <article className="panel px-6 py-8 text-sm text-ink-soft">
          Todavia no hay personajes visibles en WikiCodex. En cuanto creemos los
          primeros personajes, apareceran aqui los 20 mas recientes.
        </article>
      ) : null}

      {!isLoading && !isError && recentCharacters.length > 0 ? (
        <div
          className={
            expandedGrid
              ? 'archive-responsive-grid grid grid-cols-2 gap-4 lg:grid-cols-6'
              : 'archive-responsive-grid grid grid-cols-2 gap-4 lg:grid-cols-5'
          }
        >
          {recentCharacters.map((item) => (
            <CharacterCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}

      <article className="panel px-6 py-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
              Archivo reciente
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
              Objetos recientes
            </h2>
          </div>
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
            {totalVisibleObjects} objetos visibles
          </span>
        </div>

        {isObjectsLoading ? (
          <div
            className={
              expandedObjectGrid
                ? 'archive-responsive-grid mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6'
                : 'archive-responsive-grid mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'
            }
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg bg-white p-2 opacity-45 shadow-card"
              >
                <div className="h-60 rounded-md bg-surface-strong" />
                <div className="space-y-2 px-2 pb-2 pt-4">
                  <div className="h-5 w-3/4 rounded bg-surface-strong" />
                  <div className="h-4 w-1/2 rounded bg-surface-strong" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isObjectsLoading && isObjectsError ? (
          <p className="mt-5 text-sm text-danger">
            No se pudieron cargar los objetos recientes.
          </p>
        ) : null}

        {!isObjectsLoading && !isObjectsError && recentObjects.length ? (
          <div
            className={
              expandedObjectGrid
                ? 'archive-responsive-grid mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6'
                : 'archive-responsive-grid mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'
            }
          >
            {recentObjects.map((item) => (
              <ObjectCard key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {!isObjectsLoading && !isObjectsError && !recentObjects.length ? (
          <p className="mt-5 text-sm text-ink-soft">
            Todavia no hay objetos visibles en WikiCodex.
          </p>
        ) : null}
      </article>

      <article className="panel px-6 py-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
              Archivo reciente
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
              Lugares recientes
            </h2>
          </div>
          <span className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
            {totalVisiblePlaces} lugares visibles
          </span>
        </div>

        {isPlacesLoading ? (
          <div
            className={
              expandedObjectGrid
                ? 'archive-responsive-grid mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6'
                : 'archive-responsive-grid mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'
            }
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg bg-white p-2 opacity-45 shadow-card"
              >
                <div className="h-72 rounded-md bg-surface-strong" />
                <div className="space-y-2 px-2 pb-2 pt-4">
                  <div className="h-5 w-3/4 rounded bg-surface-strong" />
                  <div className="h-4 w-1/2 rounded bg-surface-strong" />
                  <div className="h-6 w-24 rounded bg-surface-strong" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isPlacesLoading && isPlacesError ? (
          <p className="mt-5 text-sm text-danger">
            No se pudieron cargar los lugares recientes.
          </p>
        ) : null}

        {!isPlacesLoading && !isPlacesError && recentPlaces.length ? (
          <div
            className={
              expandedObjectGrid
                ? 'archive-responsive-grid mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6'
                : 'archive-responsive-grid mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'
            }
          >
            {recentPlaces.map((item) => (
              <PlaceCard key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {!isPlacesLoading && !isPlacesError && !recentPlaces.length ? (
          <p className="mt-5 text-sm text-ink-soft">
            Todavía no hay lugares visibles en WikiCodex.
          </p>
        ) : null}
      </article>
    </section>
  )
}
