import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  BookOpen,
  Brush,
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  KeyRound,
  MapPinned,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Sparkles,
  Sword,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'

import { CloudinaryImage } from '../components/ui/CloudinaryImage'
import { ObjectPreviewImage } from '../components/ui/ObjectPreviewImage'
import { PlacePreviewImage } from '../components/ui/PlacePreviewImage'
import { WikiText } from '../components/wiki/WikiText'
import { WikiTextArea } from '../components/wiki/WikiTextArea'
import { useAuth } from '../features/auth/auth-context'
import {
  DEFAULT_THEME_SETTINGS,
  normalizeSheetVisualMode,
  useTheme,
} from '../features/theme/theme-context'
import { useIncrementalCardFeed } from '../hooks/useIncrementalCardFeed'
import {
  ACCEPTED_IMAGE_INPUT_TYPES,
  signAndUploadManagedImage,
} from '../lib/image-upload'
import { api } from '../services/http'

const EMPTY_ITEMS = []

const defaultSavedTraitForm = {
  tipoRasgoId: '',
  nombre: '',
  descripcion: '',
}

const SHEET_VISUAL_MODE_OPTIONS = [
  {
    value: 'wikicodex',
    title: 'WikiCodex',
    text: 'Vista actual con el color de la aplicación y modo oscuro completo.',
  },
  {
    value: 'legacy',
    title: 'Legado',
    text: 'Modo visual basado en "Wikirol".',
  },
  {
    value: 'arcane-night',
    title: 'Nocturno Arcano',
    text: 'Interfaz oscura, mística y contrastada con acentos arcanos.',
  },
  {
    value: 'ancient-parchment',
    title: 'Pergamino Antiguo',
    text: 'Papel cálido, bordes envejecidos y lectura de mesa clásica.',
  },
  {
    value: 'ink-paper',
    title: 'Tinta y Papel',
    text: 'Blanco limpio, tinta marcada y líneas sobrias de cuaderno.',
  },
  {
    value: 'grimoire',
    title: 'Grimorio',
    text: 'Tonos violetas, dorados rituales y sensación de libro mágico.',
  },
  {
    value: 'high-contrast',
    title: 'Alto contraste',
    text: 'Contraste reforzado para priorizar legibilidad y foco visual.',
  },
]

const SHEET_VISUAL_SUCCESS_MESSAGES = {
  wikicodex: 'La vista WikiCodex vuelve a estar activa.',
  legacy: 'El modo Legado ya está activo.',
  'arcane-night': 'Nocturno Arcano ya está activo.',
  'ancient-parchment': 'Pergamino Antiguo ya está activo.',
  'ink-paper': 'Tinta y Papel ya está activo.',
  grimoire: 'Grimorio ya está activo.',
  'high-contrast': 'Alto contraste ya está activo.',
}

async function fetchMyCharacters({ limit, cursor }) {
  const { data } = await api.get('/users/me/characters', {
    params: {
      limit,
      cursor,
    },
  })

  return data
}

async function fetchMyObjects({ limit, cursor }) {
  const { data } = await api.get('/users/me/objects', {
    params: {
      limit,
      cursor,
    },
  })

  return data
}

async function fetchMyPlaces({ limit, cursor }) {
  const { data } = await api.get('/users/me/places', {
    params: {
      limit,
      cursor,
    },
  })

  return data
}

async function fetchMySpells({ limit, cursor }) {
  const { data } = await api.get('/users/me/spells', {
    params: {
      limit,
      cursor,
    },
  })

  return data
}

async function fetchMyPowers({ limit, cursor }) {
  const { data } = await api.get('/users/me/powers', {
    params: {
      limit,
      cursor,
    },
  })

  return data
}

async function fetchMyCampaigns() {
  const { data } = await api.get('/users/me/campaigns')
  return data.items
}

async function fetchSavedTraits() {
  const { data } = await api.get('/users/me/saved-traits')
  return data
}

async function createSavedTrait(payload) {
  const { data } = await api.post('/users/me/saved-traits', payload)
  return data.item
}

async function updateSavedTrait({ traitId, payload }) {
  const { data } = await api.patch(`/users/me/saved-traits/${traitId}`, payload)
  return data.item
}

async function deleteSavedTrait(traitId) {
  await api.delete(`/users/me/saved-traits/${traitId}`)
}

async function signAndUploadProfileImage(file) {
  return signAndUploadManagedImage({
    file,
    entityType: 'perfil',
    campaignId: null,
    tags: ['perfil'],
    fallbackErrorMessage: 'No se pudo subir la imagen a Cloudinary.',
  })
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getSavedTraitSourceType(trait) {
  return trait?.origenTipo || 'usuario'
}

function getSavedTraitSourceKey(trait) {
  const sourceType = getSavedTraitSourceType(trait)
  return `${sourceType}:${trait?.origenEntidadId || trait?.origenGrupoId || ''}`
}

function getSavedTraitSourceLabel(trait) {
  const sourceType = getSavedTraitSourceType(trait)
  const typeLabel =
    sourceType === 'dote'
      ? 'Dote'
      : sourceType === 'subclase'
        ? 'Subclase'
        : sourceType === 'clase'
          ? 'Clase'
          : 'Usuario'

  return trait?.origenEntidadNombre
    ? `${typeLabel} · ${trait.origenEntidadNombre}`
    : typeLabel
}

function AccountSection({ title, icon, open, onToggle, children }) {
  const SectionIcon = icon

  return (
    <div className="rounded-xl border border-stroke/70 bg-white/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
      >
        <span className="inline-flex items-center gap-3">
          <SectionIcon className="h-5 w-5 text-brand" />
          <span className="font-display text-lg font-semibold text-ink">
            {title}
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 text-ink-muted transition ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open ? (
        <div className="border-t border-stroke/70 p-4">{children}</div>
      ) : null}
    </div>
  )
}

function ProfileCharacterCard({ item }) {
  const location = useLocation()

  return (
    <Link
      to={`/app/personajes/${item.id}`}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="archive-card-virtual archive-responsive-card group block rounded-lg bg-white p-2 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="archive-responsive-image relative h-72 overflow-hidden rounded-md bg-surface-strong">
        {item.imagenPrincipalUrl ? (
          <CloudinaryImage
            src={item.imagenPrincipalUrl}
            alt={item.nombre}
            variant="card"
            sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 50vw"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="theme-brand-gradient flex h-full w-full items-center justify-center text-brand">
            <UserRound className="h-12 w-12" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="archive-responsive-body px-2 pb-2 pt-4">
        <h3 className="truncate font-display text-xl font-bold tracking-[-0.05em] text-ink">
          {item.nombre}
        </h3>
        <p className="mt-1 truncate text-sm text-ink-soft">
          {item.titulo || 'Sin titulo registrado'}
        </p>
        <div className="mt-3">
          <span className="archive-chip">Personaje</span>
        </div>
      </div>
    </Link>
  )
}

function ProfileObjectCard({ item }) {
  const location = useLocation()

  return (
    <Link
      to={`/app/objetos/${item.id}`}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="archive-card-virtual archive-responsive-card group block rounded-lg bg-white p-2 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="archive-responsive-image relative h-80 overflow-hidden rounded-md bg-surface-strong">
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
          {item.tier?.nombre || 'Objeto sin tier'}
        </p>
        <div className="mt-3">
          <span className="archive-chip">Objeto</span>
        </div>
      </div>
    </Link>
  )
}

function ProfilePlaceCard({ item }) {
  const location = useLocation()

  return (
    <Link
      to={`/app/lugares/${item.id}`}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="archive-card-virtual archive-responsive-card group block rounded-lg bg-white p-2 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="archive-responsive-image relative h-72 overflow-hidden rounded-md bg-surface-strong">
        <PlacePreviewImage
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
          {item.tipo?.nombre || 'Lugar sin clasificar'}
        </p>
        <div className="mt-3">
          <span className="archive-chip">Lugar</span>
        </div>
      </div>
    </Link>
  )
}

function ProfileSpellCard({ item }) {
  const location = useLocation()

  return (
    <Link
      to={`/app/poderes/hechizos/${item.id}`}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className="archive-card-virtual archive-responsive-card group block rounded-lg bg-white p-4 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
    >
      <div className="archive-responsive-body">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
          Hechizo
        </p>
        <h3 className="truncate font-display text-xl font-bold tracking-[-0.05em] text-ink">
          {item.nombre}
        </h3>
        <p className="mt-1 truncate text-sm text-ink-soft">
          {Number(item.nivel) === 0 ? 'Truco' : `Nivel ${item.nivel}`}
          {item.escuela ? ` · ${item.escuela}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="archive-chip">Hechizo</span>
          <span className="archive-chip">
            {item.esPúblico ? 'Público' : 'Privado'}
          </span>
          {item.escuela ? (
            <span className="archive-chip">{item.escuela}</span>
          ) : null}
        </div>
        <p className="mt-4 line-clamp-4 text-sm leading-7 text-ink-soft">
          {item.descripcion || 'Este hechizo no tiene descripcion registrada.'}
        </p>
      </div>
    </Link>
  )
}
function PlaceholderCard({ item, label }) {
  return (
    <article className="archive-card-virtual archive-responsive-card group rounded-lg bg-white p-2 shadow-card transition hover:-translate-y-1 hover:shadow-glow">
      <div
        className="archive-responsive-image relative h-72 overflow-hidden rounded-md"
        style={{ background: item.imagen }}
      >
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
      </div>

      <div className="archive-responsive-body px-2 pb-2 pt-4">
        <h3 className="truncate font-display text-xl font-bold tracking-[-0.05em] text-ink">
          {item.nombre}
        </h3>
        <p className="mt-1 truncate text-sm text-ink-soft">{item.titulo}</p>
        <div className="mt-3">
          <span className="archive-chip">{label}</span>
        </div>
      </div>
    </article>
  )
}

function ProfilePowerCard({ item }) {
  return (
    <Link
      to={`/app/poderes/otros/${item.id}`}
      className="archive-card-virtual archive-responsive-card group block rounded-lg bg-white p-4 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
    >
      {item.imagenUrl ? (
        <CloudinaryImage
          src={item.imagenUrl}
          alt={item.nombre}
          variant="card"
          sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 50vw"
          className="archive-responsive-image h-44 w-full rounded-md object-cover"
          loading="lazy"
        />
      ) : (
        <div className="theme-brand-gradient archive-responsive-image flex h-32 w-full items-center justify-center rounded-md text-brand">
          <Sparkles className="h-10 w-10" />
        </div>
      )}
      <div className="archive-responsive-body pt-4">
        <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-brand">
          Otro poder
        </p>
        <h3 className="mt-2 truncate font-display text-2xl font-bold tracking-[-0.05em] text-ink">
          {item.nombre}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-soft">
          {item.descripcion || 'Sin descripcion registrada.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(item.categorias || []).slice(0, 3).map((category) => (
            <span key={category.id || category.nombre} className="archive-chip">
              {category.nombre}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}

function EntrySection({
  title,
  label,
  icon,
  items,
  shownCount,
  totalCount,
  canLoadMore,
  canLoadLess,
  isLoading,
  isDynamic = false,
  renderItem,
  open,
  onToggle,
  onLoadMore,
  onLoadLess,
  onLoadAll,
  onShowRecent,
  expandedGrid = false,
}) {
  const SectionIcon = icon

  return (
    <article className="panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-3 px-6 py-6 text-left sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
            Ultimas entradas
          </p>
          <h2 className="mt-2 inline-flex items-center gap-3 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
            {SectionIcon ? (
              <SectionIcon className="h-6 w-6 text-brand" />
            ) : null}
            {title}
            <ChevronDown
              className={`h-5 w-5 text-brand transition ${
                open ? 'rotate-180' : ''
              }`}
            />
          </h2>
        </div>
        <span className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
          {shownCount} mostrados de {totalCount}
        </span>
      </button>

      {open ? (
        <div className="border-t border-stroke/70 px-6 pb-6 pt-5">
          <div
            className={
              expandedGrid
                ? 'archive-responsive-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6'
                : 'archive-responsive-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'
            }
          >
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-lg bg-white p-2 opacity-45 shadow-card"
                >
                  <div className="h-72 rounded-md bg-surface-strong" />
                  <div className="space-y-2 px-2 pb-2 pt-4">
                    <div className="h-5 w-3/4 rounded bg-surface-strong" />
                    <div className="h-4 w-1/2 rounded bg-surface-strong" />
                  </div>
                </div>
              ))
            ) : items.length ? (
              items.map((item) =>
                renderItem ? (
                  renderItem(item)
                ) : isDynamic ? (
                  <ProfileCharacterCard key={item.id} item={item} />
                ) : (
                  <PlaceholderCard key={item.id} item={item} label={label} />
                )
              )
            ) : (
              <div className="col-span-full rounded-lg border border-stroke/70 bg-white/60 px-5 py-6 text-sm text-ink-soft">
                Todavia no hay {title.toLowerCase()} creados por tu cuenta.
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={!canLoadMore || isLoading}
              className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronDown className="h-4 w-4" />
              Cargar 10 más
            </button>
            <button
              type="button"
              onClick={onLoadLess}
              disabled={!canLoadLess || isLoading}
              className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronUp className="h-4 w-4" />
              Cargar 10 menos
            </button>
            <button
              type="button"
              onClick={onLoadAll}
              disabled={!canLoadMore || isLoading}
              className="theme-solid-button inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45"
            >
              Cargar todos
            </button>
            <button
              type="button"
              onClick={onShowRecent}
              disabled={!canLoadLess || isLoading}
              className="inline-flex items-center gap-2 rounded-md bg-surface-strong px-4 py-2.5 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft transition hover:bg-white hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw className="h-4 w-4" />
              Mostrar solo 10 ultimos
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function PowersEntryGroup({ open, onToggle, children }) {
  return (
    <article className="panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-3 px-6 py-6 text-left sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
            Biblioteca de usuario
          </p>
          <h2 className="mt-2 inline-flex items-center gap-3 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
            <BookOpen className="h-6 w-6 text-brand" />
            Poderes
            <ChevronDown
              className={`h-5 w-5 text-brand transition ${
                open ? 'rotate-180' : ''
              }`}
            />
          </h2>
        </div>
      </button>

      {open ? (
        <div className="border-t border-stroke/70 px-4 pb-5 pt-4 sm:pl-10 sm:pr-6">
          {children}
        </div>
      ) : null}
    </article>
  )
}

function CampaignsPanel({ campaigns, isLoading, open, onToggle }) {
  return (
    <article className="panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-6 text-left"
      >
        <div>
          <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
            Mesa y aventura
          </p>
          <h3 className="mt-2 inline-flex items-center gap-3 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
            <BookOpen className="h-6 w-6 text-brand" />
            Mis campañas
          </h3>
        </div>
        <ChevronDown
          className={`h-6 w-6 text-brand transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="grid gap-3 border-t border-stroke/70 px-6 pb-6 pt-5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-20 rounded-xl border border-stroke/70 bg-white/50"
              />
            ))
          ) : campaigns.length ? (
            campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                to="/app/campanas"
                className="group rounded-xl border border-stroke/80 bg-white/70 px-4 py-4 transition hover:border-brand hover:shadow-glow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-display text-lg font-bold tracking-[-0.04em] text-ink">
                      {campaign.nombre}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                      {campaign.descripcion || 'Sin descripción registrada.'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 font-label text-[9px] font-black uppercase tracking-[0.16em] text-brand">
                    {campaign.rolEnCampana}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  <span>{campaign.totalJugadores} jugadores</span>
                  <span>{campaign.totalAventuras} aventuras</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-stroke bg-white/50 px-4 py-6 text-sm text-ink-soft">
              Aun no participas en ninguna campaña.
            </div>
          )}
        </div>
      ) : null}
    </article>
  )
}

function SavedTraitsPanel({
  data,
  isLoading,
  open,
  onToggle,
  openCreate,
  openList,
  onToggleCreate,
  onToggleList,
  search,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  sourceEntityFilter,
  onSourceEntityFilterChange,
  form,
  onFormChange,
  editingTraitId,
  onEdit,
  onCancelEdit,
  onSubmit,
  onDelete,
  isSaving,
  deletingTraitId,
  error,
}) {
  const traitTypes = data?.tiposRasgo || []
  const traits = data?.items || EMPTY_ITEMS
  const normalizedSearch = normalizeText(search)
  const sourceOptions = useMemo(() => {
    const map = new Map()

    for (const trait of traits) {
      const sourceType = getSavedTraitSourceType(trait)

      if (!['clase', 'subclase'].includes(sourceType)) {
        continue
      }

      const key = getSavedTraitSourceKey(trait)

      if (!map.has(key)) {
        map.set(key, { key, label: getSavedTraitSourceLabel(trait) })
      }
    }

    return Array.from(map.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    )
  }, [traits])
  const visibleTraits = traits.filter((trait) => {
    const sourceType = getSavedTraitSourceType(trait)

    if (sourceFilter === 'user' && sourceType !== 'usuario') {
      return false
    }

    if (
      sourceFilter === 'class' &&
      !['clase', 'subclase'].includes(sourceType)
    ) {
      return false
    }

    if (sourceFilter === 'class' && sourceEntityFilter !== 'all') {
      if (getSavedTraitSourceKey(trait) !== sourceEntityFilter) {
        return false
      }
    }

    if (sourceFilter === 'feat' && sourceType !== 'dote') {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return (
      normalizeText(trait.nombre).includes(normalizedSearch) ||
      normalizeText(trait.descripcion).includes(normalizedSearch) ||
      normalizeText(trait.tipoRasgo?.nombre).includes(normalizedSearch) ||
      normalizeText(trait.origenEntidadNombre).includes(normalizedSearch) ||
      normalizeText(trait.origenRasgoNombre).includes(normalizedSearch)
    )
  })

  return (
    <article className="panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-6 text-left"
      >
        <div>
          <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
            Biblioteca personal
          </p>
          <h3 className="mt-2 inline-flex items-center gap-3 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
            Rasgos guardados
          </h3>
        </div>
        <ChevronDown
          className={`h-6 w-6 text-brand transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="grid gap-3 border-t border-stroke/70 px-6 pb-6 pt-5">
          <AccountSection
            title={editingTraitId ? 'Editar rasgo' : 'Crear rasgo'}
            icon={Plus}
            open={openCreate}
            onToggle={onToggleCreate}
          >
            <form onSubmit={onSubmit} className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
                  {editingTraitId ? 'Editando plantilla' : 'Nueva plantilla'}
                </p>
                {editingTraitId ? (
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted hover:text-danger"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </button>
                ) : null}
              </div>

              <select
                value={form.tipoRasgoId}
                onChange={(event) =>
                  onFormChange({ ...form, tipoRasgoId: event.target.value })
                }
                className="archive-input"
              >
                <option value="">Tipo de rasgo</option>
                {traitTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.nombre}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={form.nombre}
                onChange={(event) =>
                  onFormChange({ ...form, nombre: event.target.value })
                }
                placeholder="Nombre del rasgo"
                maxLength={200}
                className="archive-input"
              />

              <WikiTextArea
                value={form.descripcion}
                onChange={(event) =>
                  onFormChange({ ...form, descripcion: event.target.value })
                }
                placeholder="Descripcion reutilizable"
                rows={4}
                className="archive-input min-h-28 resize-y"
              />

              {error ? (
                <p className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  isSaving ||
                  !form.tipoRasgoId ||
                  !form.nombre.trim() ||
                  !form.descripcion.trim()
                }
                className="inline-flex w-fit items-center gap-2 rounded-md bg-brand px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45"
              >
                {editingTraitId ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingTraitId ? 'Guardar rasgo' : 'Crear rasgo'}
              </button>
            </form>
          </AccountSection>

          <AccountSection
            title="Ver rasgos guardados"
            icon={Search}
            open={openList}
            onToggle={onToggleList}
          >
            <div className="grid gap-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Buscar rasgos guardados..."
                  className="archive-input pl-10"
                />
              </label>

              <div className="flex flex-wrap gap-2">
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
                      onSourceFilterChange(value)

                      if (value !== 'class') {
                        onSourceEntityFilterChange('all')
                      }
                    }}
                    className={`rounded-md border px-3 py-2 font-label text-[9px] font-black uppercase tracking-[0.14em] transition ${
                      sourceFilter === value
                        ? 'border-brand bg-brand/15 text-brand'
                        : 'border-stroke bg-white text-ink-soft hover:border-brand/40 hover:text-brand'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {sourceFilter === 'class' ? (
                <select
                  value={sourceEntityFilter}
                  onChange={(event) =>
                    onSourceEntityFilterChange(event.target.value)
                  }
                  className="archive-input rounded-xl"
                >
                  <option value="all">Todas las clases y subclases</option>
                  {sourceOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}

              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-28 rounded-xl border border-stroke/70 bg-surface-strong/60"
                    />
                  ))
                ) : visibleTraits.length ? (
                  visibleTraits.map((trait) => (
                    <article
                      key={trait.id}
                      className="theme-sheet-card rounded-xl border p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-label text-[9px] font-black uppercase tracking-[0.18em] text-brand">
                            {trait.tipoRasgo?.nombre || 'Sin tipo'}
                          </span>
                          {getSavedTraitSourceType(trait) !== 'usuario' ? (
                            <span className="ml-2 font-label text-[9px] font-black uppercase tracking-[0.12em] text-ink-muted">
                              {getSavedTraitSourceLabel(trait)}
                            </span>
                          ) : null}
                          <h4 className="mt-1 font-display text-lg font-bold tracking-[-0.04em] text-ink">
                            {trait.nombre}
                          </h4>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => onEdit(trait)}
                            className="rounded-md border border-stroke bg-surface-strong p-2 text-ink-muted transition hover:border-brand hover:bg-white/10 hover:text-brand"
                            title="Editar rasgo"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(trait.id)}
                            disabled={deletingTraitId === trait.id}
                            className="rounded-md border border-stroke bg-surface-strong p-2 text-ink-muted transition hover:border-danger hover:bg-white/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-45"
                            title="Borrar rasgo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-ink-soft">
                        <WikiText text={trait.descripcion} />
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-stroke bg-surface-strong/45 px-4 py-6 text-sm text-ink-soft">
                    No hay rasgos guardados que coincidan con la búsqueda.
                  </div>
                )}
              </div>
            </div>
          </AccountSection>
        </div>
      ) : null}
    </article>
  )
}

export function ProfilePage() {
  const outletContext = useOutletContext() || {}
  const expandedGrid = Boolean(
    outletContext.isLeftCollapsed && outletContext.isRightCollapsed
  )
  const queryClient = useQueryClient()
  const { user, isAdmin, updateProfile, changePassword, normalizeApiError } =
    useAuth()
  const {
    isDarkMode,
    isDarkModeLocked,
    mode,
    paletteColor,
    sheetVisualMode,
    setMode,
    setPaletteColor,
    setSheetVisualMode,
    resetTheme,
  } = useTheme()
  const avatarInputRef = useRef(null)
  const [profileName, setProfileName] = useState(user?.nombreUsuario || '')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [isNameConfirmOpen, setIsNameConfirmOpen] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [avatarDraft, setAvatarDraft] = useState(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    contrasenaActual: '',
    nuevaContrasena: '',
    confirmarContrasena: '',
  })
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savedTraitForm, setSavedTraitForm] = useState(defaultSavedTraitForm)
  const [savedTraitError, setSavedTraitError] = useState('')
  const [editingTraitId, setEditingTraitId] = useState(null)
  const [savedTraitSearch, setSavedTraitSearch] = useState('')
  const [savedTraitSourceFilter, setSavedTraitSourceFilter] = useState('all')
  const [savedTraitSourceEntityFilter, setSavedTraitSourceEntityFilter] =
    useState('all')
  const [paletteDraft, setPaletteDraft] = useState(paletteColor)
  const [visualMessage, setVisualMessage] = useState('')
  const [visualError, setVisualError] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isSavingVisual, setIsSavingVisual] = useState(false)
  const [openAccountSections, setOpenAccountSections] = useState({
    datos: false,
    password: false,
  })
  const [openProfileSections, setOpenProfileSections] = useState({
    campaigns: false,
    userManagement: false,
    visual: false,
    savedTraits: false,
  })
  const [openSavedTraitSections, setOpenSavedTraitSections] = useState({
    create: false,
    list: false,
  })
  const [isVisualModePickerOpen, setIsVisualModePickerOpen] = useState(false)
  const [openEntrySections, setOpenEntrySections] = useState({
    personajes: false,
    objetos: false,
    lugares: false,
    poderes: false,
    hechizos: false,
    otrosPoderes: false,
  })

  useEffect(() => {
    setProfileName(user?.nombreUsuario || '')
  }, [user?.nombreUsuario])

  useEffect(() => {
    setPaletteDraft(paletteColor)
  }, [paletteColor])

  useEffect(
    () => () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    },
    [avatarPreviewUrl]
  )

  const charactersQuery = useQuery({
    queryKey: ['profile', 'characters'],
    queryFn: () =>
      fetchMyCharacters({
        limit: 10,
        cursor: null,
      }),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const objectsQuery = useQuery({
    queryKey: ['profile', 'objects'],
    queryFn: () =>
      fetchMyObjects({
        limit: 10,
        cursor: null,
      }),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const placesQuery = useQuery({
    queryKey: ['profile', 'places'],
    queryFn: () =>
      fetchMyPlaces({
        limit: 10,
        cursor: null,
      }),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const spellsQuery = useQuery({
    queryKey: ['profile', 'spells'],
    queryFn: () =>
      fetchMySpells({
        limit: 10,
        cursor: null,
      }),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const powersQuery = useQuery({
    queryKey: ['profile', 'powers'],
    queryFn: () =>
      fetchMyPowers({
        limit: 10,
        cursor: null,
      }),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const campaignsQuery = useQuery({
    queryKey: ['profile', 'campaigns'],
    queryFn: fetchMyCampaigns,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const savedTraitsQuery = useQuery({
    queryKey: ['profile', 'saved-traits'],
    queryFn: fetchSavedTraits,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const createSavedTraitMutation = useMutation({
    mutationFn: createSavedTrait,
    onSuccess: () => {
      setSavedTraitForm(defaultSavedTraitForm)
      queryClient.invalidateQueries({ queryKey: ['profile', 'saved-traits'] })
    },
    onError: (error) => {
      setSavedTraitError(
        normalizeApiError(error, 'No se pudo crear el rasgo guardado.')
      )
    },
  })

  const updateSavedTraitMutation = useMutation({
    mutationFn: updateSavedTrait,
    onSuccess: () => {
      setSavedTraitForm(defaultSavedTraitForm)
      setEditingTraitId(null)
      queryClient.invalidateQueries({ queryKey: ['profile', 'saved-traits'] })
    },
    onError: (error) => {
      setSavedTraitError(
        normalizeApiError(error, 'No se pudo editar el rasgo guardado.')
      )
    },
  })

  const deleteSavedTraitMutation = useMutation({
    mutationFn: deleteSavedTrait,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'saved-traits'] })
    },
  })

  async function saveProfileName() {
    setProfileMessage('')
    setProfileError('')
    setIsSavingProfile(true)
    setIsNameConfirmOpen(false)

    try {
      await updateProfile({ nombreUsuario: profileName.trim() })
      setProfileMessage('Nombre actualizado correctamente.')
    } catch (error) {
      setProfileError(
        normalizeApiError(error, 'No se pudo actualizar el perfil.')
      )
    } finally {
      setIsSavingProfile(false)
    }
  }

  function handleProfileSubmit(event) {
    event.preventDefault()
    setProfileMessage('')
    setProfileError('')

    const nextName = profileName.trim()
    const currentName = String(user?.nombreUsuario || '').trim()

    if (!nextName) {
      setProfileError('El nombre de usuario no puede estar vacío.')
      return
    }

    if (nextName === currentName) {
      setProfileMessage('El nombre no ha cambiado.')
      return
    }

    setIsNameConfirmOpen(true)
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setAvatarMessage('')
    setAvatarError('')
    setAvatarDraft(file)

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }

    setAvatarPreviewUrl(URL.createObjectURL(file))
    event.target.value = ''
  }

  function handleDiscardAvatarDraft() {
    setAvatarDraft(null)
    setAvatarError('')
    setAvatarMessage('')

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl)
      setAvatarPreviewUrl('')
    }
  }

  async function handleConfirmAvatarUpload() {
    if (!avatarDraft) {
      return
    }

    setAvatarMessage('')
    setAvatarError('')
    setIsUploadingAvatar(true)

    try {
      const imageUrl = await signAndUploadProfileImage(avatarDraft)
      await updateProfile({ imagenPerfilUrl: imageUrl })
      handleDiscardAvatarDraft()
      setAvatarMessage('Foto de perfil actualizada correctamente.')
    } catch (error) {
      setAvatarError(
        normalizeApiError(error, 'No se pudo actualizar la foto de perfil.')
      )
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (passwordForm.nuevaContrasena !== passwordForm.confirmarContrasena) {
      setPasswordError('Las contrasenas no coinciden.')
      return
    }

    setIsSavingPassword(true)

    try {
      await changePassword({
        contrasenaActual: passwordForm.contrasenaActual,
        nuevaContrasena: passwordForm.nuevaContrasena,
      })
      setPasswordForm({
        contrasenaActual: '',
        nuevaContrasena: '',
        confirmarContrasena: '',
      })
      setPasswordMessage('Contrasena actualizada correctamente.')
    } catch (error) {
      setPasswordError(
        normalizeApiError(error, 'No se pudo cambiar la contrasena.')
      )
    } finally {
      setIsSavingPassword(false)
    }
  }

  function handleSavedTraitSubmit(event) {
    event.preventDefault()
    setSavedTraitError('')

    const payload = {
      tipoRasgoId: savedTraitForm.tipoRasgoId,
      nombre: savedTraitForm.nombre.trim(),
      descripcion: savedTraitForm.descripcion.trim(),
    }

    if (editingTraitId) {
      updateSavedTraitMutation.mutate({
        traitId: editingTraitId,
        payload,
      })
      return
    }

    createSavedTraitMutation.mutate(payload)
  }

  function handleEditSavedTrait(trait) {
    setEditingTraitId(trait.id)
    setSavedTraitError('')
    setOpenProfileSections((current) => ({ ...current, savedTraits: true }))
    setOpenSavedTraitSections((current) => ({ ...current, create: true }))
    setSavedTraitForm({
      tipoRasgoId: trait.tipoRasgoId,
      nombre: trait.nombre,
      descripcion: trait.descripcion,
    })
  }

  function handleCancelEditSavedTrait() {
    setEditingTraitId(null)
    setSavedTraitError('')
    setSavedTraitForm(defaultSavedTraitForm)
  }

  async function persistVisualSettings(
    nextSettings,
    { successMessage, onLocalApply, onLocalRollback } = {}
  ) {
    setVisualMessage('')
    setVisualError('')
    setIsSavingVisual(true)

    onLocalApply?.()

    try {
      await updateProfile({
        temaModo: nextSettings.mode,
        temaColorHex: nextSettings.paletteColor,
        modoVisualFichas: nextSettings.sheetVisualMode,
      })
      setVisualMessage(successMessage)
    } catch (error) {
      onLocalRollback?.()
      setVisualError(
        normalizeApiError(
          error,
          'No se pudo guardar la personalizacion visual.'
        )
      )
    } finally {
      setIsSavingVisual(false)
    }
  }

  async function handlePaletteApply() {
    const nextColor = paletteDraft
    const previousColor = paletteColor

    await persistVisualSettings(
      { mode, paletteColor: nextColor, sheetVisualMode },
      {
        successMessage: 'La nueva paleta principal ya esta aplicada.',
        onLocalApply: () => setPaletteColor(nextColor),
        onLocalRollback: () => setPaletteColor(previousColor),
      }
    )
  }

  async function handleThemeToggle() {
    if (isDarkModeLocked) {
      setVisualMessage(
        'Nocturno Arcano ya usa una vista oscura y bloquea este interruptor mientras este activo.'
      )
      setVisualError('')
      return
    }

    const nextMode = mode === 'dark' ? 'light' : 'dark'
    const previousMode = mode

    await persistVisualSettings(
      { mode: nextMode, paletteColor, sheetVisualMode },
      {
        successMessage:
          nextMode === 'dark'
            ? 'El modo oscuro ya esta activo.'
            : 'Se ha desactivado el modo oscuro.',
        onLocalApply: () => setMode(nextMode),
        onLocalRollback: () => setMode(previousMode),
      }
    )
  }

  async function handleThemeReset() {
    const previousSettings = {
      mode,
      paletteColor,
      sheetVisualMode,
    }

    setPaletteDraft(DEFAULT_THEME_SETTINGS.paletteColor)

    await persistVisualSettings(DEFAULT_THEME_SETTINGS, {
      successMessage: 'Se ha restaurado el tema base de WikiCodex.',
      onLocalApply: () => resetTheme(),
      onLocalRollback: () => {
        setMode(previousSettings.mode)
        setPaletteColor(previousSettings.paletteColor)
        setSheetVisualMode(previousSettings.sheetVisualMode)
        setPaletteDraft(previousSettings.paletteColor)
      },
    })
  }

  async function handleSheetVisualModeChange(nextMode) {
    const normalizedMode = normalizeSheetVisualMode(nextMode)
    const previousSettings = {
      mode,
      sheetVisualMode,
    }

    await persistVisualSettings(
      { mode: 'light', paletteColor, sheetVisualMode: normalizedMode },
      {
        successMessage:
          SHEET_VISUAL_SUCCESS_MESSAGES[normalizedMode] ||
          'El modo visual ya esta activo.',
        onLocalApply: () => {
          setSheetVisualMode(normalizedMode)
          setMode('light')
        },
        onLocalRollback: () => {
          setSheetVisualMode(previousSettings.sheetVisualMode)
          setMode(previousSettings.mode)
        },
      }
    )
  }

  function toggleEntrySection(sectionName) {
    setOpenEntrySections((current) => ({
      ...current,
      [sectionName]: !current[sectionName],
    }))
  }

  const characterFeed = useIncrementalCardFeed({
    seedKey: `${user?.id || 'anon'}:${charactersQuery.dataUpdatedAt}`,
    initialItems: charactersQuery.data?.items || EMPTY_ITEMS,
    initialTotal: charactersQuery.data?.meta?.total || 0,
    initialNextCursor: charactersQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: fetchMyCharacters,
  })

  const objectFeed = useIncrementalCardFeed({
    seedKey: `${user?.id || 'anon'}:${objectsQuery.dataUpdatedAt}`,
    initialItems: objectsQuery.data?.items || EMPTY_ITEMS,
    initialTotal: objectsQuery.data?.meta?.total || 0,
    initialNextCursor: objectsQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: fetchMyObjects,
  })

  const placeFeed = useIncrementalCardFeed({
    seedKey: `${user?.id || 'anon'}:${placesQuery.dataUpdatedAt}`,
    initialItems: placesQuery.data?.items || EMPTY_ITEMS,
    initialTotal: placesQuery.data?.meta?.total || 0,
    initialNextCursor: placesQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: fetchMyPlaces,
  })

  const spellFeed = useIncrementalCardFeed({
    seedKey: `${user?.id || 'anon'}:${spellsQuery.dataUpdatedAt}`,
    initialItems: spellsQuery.data?.items || EMPTY_ITEMS,
    initialTotal:
      spellsQuery.data?.meta?.total ||
      spellsQuery.data?.meta?.totalVisible ||
      0,
    initialNextCursor: spellsQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: fetchMySpells,
  })

  const powerFeed = useIncrementalCardFeed({
    seedKey: `${user?.id || 'anon'}:powers:${powersQuery.dataUpdatedAt}`,
    initialItems: powersQuery.data?.items || EMPTY_ITEMS,
    initialTotal:
      powersQuery.data?.meta?.total ||
      powersQuery.data?.meta?.totalVisible ||
      0,
    initialNextCursor: powersQuery.data?.meta?.nextCursor || null,
    pageSize: 10,
    fetchPage: fetchMyPowers,
  })

  const characterItems = characterFeed.items
  const characterTotal = characterFeed.total
  const characterShown = characterFeed.shownCount
  const objectItems = objectFeed.items
  const objectTotal = objectFeed.total
  const objectShown = objectFeed.shownCount
  const placeItems = placeFeed.items
  const placeTotal = placeFeed.total
  const placeShown = placeFeed.shownCount
  const spellItems = spellFeed.items
  const spellTotal = spellFeed.total
  const spellShown = spellFeed.shownCount
  const powerItems = powerFeed.items
  const powerTotal = powerFeed.total
  const powerShown = powerFeed.shownCount
  const campaigns = campaignsQuery.data || []
  const isSavingTrait =
    createSavedTraitMutation.isPending || updateSavedTraitMutation.isPending

  return (
    <section className="grid gap-6">
      <article className="panel px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_auto] lg:items-center">
          <div
            className={`relative w-full max-w-60 overflow-hidden rounded-xl border border-stroke shadow-card ${
              user?.imagenPerfilUrl
                ? 'bg-transparent'
                : 'h-72 bg-surface-strong'
            }`}
          >
            {user?.imagenPerfilUrl ? (
              <CloudinaryImage
                src={user.imagenPerfilUrl}
                alt={user.nombreUsuario}
                variant="profileAvatar"
                sizes="(min-width: 640px) 240px, 80vw"
                className="block h-auto w-full"
                loading="eager"
              />
            ) : (
              <div className="theme-brand-radial flex h-full w-full items-center justify-center text-brand">
                <UserRound className="h-20 w-20" />
              </div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_INPUT_TYPES}
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-brand">
              Perfil
            </p>
            <h2 className="mt-2 font-display text-4xl font-black tracking-[-0.06em] text-ink">
              {user?.nombreUsuario}
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                <Shield className="h-4 w-4" />
                {isAdmin
                  ? 'Administrador'
                  : user?.rol?.nombre || 'Cuenta normal'}
              </span>
            </div>
            {avatarError ? (
              <p className="mt-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
                {avatarError}
              </p>
            ) : null}
            {avatarMessage ? (
              <p className="mt-4 rounded-md bg-brand/10 px-4 py-3 text-sm font-semibold text-brand">
                {avatarMessage}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-start gap-3 lg:flex-col lg:items-end">
            {user?.id ? (
              <Link
                to={`/app/perfiles/${user.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
              >
                <Eye className="h-4 w-4" />
                Ver preview de tu ficha publica
              </Link>
            ) : null}

            <Link
              to="/app/perfil-publico/editar"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong"
            >
              <Pencil className="h-4 w-4" />
              Personalizar ficha del perfil público
            </Link>
          </div>
        </div>
      </article>

      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <AccountSection
          title="Gestion de usuario"
          icon={UserRound}
          open={openProfileSections.userManagement}
          onToggle={() =>
            setOpenProfileSections((current) => ({
              ...current,
              userManagement: !current.userManagement,
            }))
          }
        >
          <div className="grid gap-3">
            <AccountSection
              title="Datos de la cuenta"
              icon={UserRound}
              open={openAccountSections.datos}
              onToggle={() =>
                setOpenAccountSections((current) => ({
                  ...current,
                  datos: !current.datos,
                }))
              }
            >
              <form onSubmit={handleProfileSubmit} className="grid gap-4">
                <label className="block">
                  <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
                    Nombre de usuario
                  </span>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    maxLength={50}
                    className="archive-input mt-2"
                  />
                </label>

                {profileError ? (
                  <p className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
                    {profileError}
                  </p>
                ) : null}
                {profileMessage ? (
                  <p className="rounded-md bg-brand/10 px-4 py-3 text-sm font-semibold text-brand">
                    {profileMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="theme-solid-button inline-flex w-fit items-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserRound className="h-4 w-4" />
                  {isSavingProfile ? 'Guardando...' : 'Guardar nombre'}
                </button>

                <div className="rounded-xl border border-dashed border-stroke bg-white/50 p-4">
                  <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
                    Foto de perfil
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    Primero veras una preview local. Solo se subira a Cloudinary
                    cuando confirmes el cambio.
                  </p>

                  {avatarPreviewUrl ? (
                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                      <img
                        src={avatarPreviewUrl}
                        alt="Preview de nueva foto de perfil"
                        className="h-36 w-28 rounded-lg object-cover shadow-card"
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
                        >
                          <Camera className="h-4 w-4" />
                          Cambiarla
                        </button>
                        <button
                          type="button"
                          onClick={handleDiscardAvatarDraft}
                          className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-4 py-2.5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-danger transition hover:border-danger"
                        >
                          <X className="h-4 w-4" />
                          Descartarla
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmAvatarUpload}
                          disabled={isUploadingAvatar}
                          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Upload className="h-4 w-4" />
                          {isUploadingAvatar ? 'Subiendo...' : 'Guardar foto'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong"
                    >
                      <Upload className="h-4 w-4" />
                      Subir nueva foto
                    </button>
                  )}
                </div>
              </form>
            </AccountSection>

            <AccountSection
              title="Cambiar contrasena"
              icon={KeyRound}
              open={openAccountSections.password}
              onToggle={() =>
                setOpenAccountSections((current) => ({
                  ...current,
                  password: !current.password,
                }))
              }
            >
              <form onSubmit={handlePasswordSubmit} className="grid gap-4">
                {[
                  ['contrasenaActual', 'Contrasena actual'],
                  ['nuevaContrasena', 'Nueva contrasena'],
                  ['confirmarContrasena', 'Confirmar nueva contrasena'],
                ].map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
                      {label}
                    </span>
                    <input
                      type="password"
                      value={passwordForm[field]}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      className="archive-input mt-2"
                    />
                  </label>
                ))}

                {passwordError ? (
                  <p className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
                    {passwordError}
                  </p>
                ) : null}
                {passwordMessage ? (
                  <p className="rounded-md bg-brand/10 px-4 py-3 text-sm font-semibold text-brand">
                    {passwordMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="theme-solid-button inline-flex w-fit items-center gap-2 rounded-md px-5 py-3 font-label text-[10px] font-bold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  {isSavingPassword ? 'Guardando...' : 'Cambiar contrasena'}
                </button>
              </form>
            </AccountSection>
          </div>
        </AccountSection>

        <AccountSection
          title="Personalizacion visual"
          icon={Brush}
          open={openProfileSections.visual}
          onToggle={() =>
            setOpenProfileSections((current) => ({
              ...current,
              visual: !current.visual,
            }))
          }
        >
          <p className="text-sm leading-7 text-ink-soft">
            Desde aqui puedes activar el modo oscuro, elegir un modo visual y
            redefinir el color principal de la interfaz para que se refleje en
            botones, iconos, banners y acentos visuales.
          </p>

          {visualMessage ? (
            <p className="mt-4 rounded-md bg-brand/10 px-4 py-3 text-sm font-semibold text-brand">
              {visualMessage}
            </p>
          ) : null}
          {visualError ? (
            <p className="mt-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
              {visualError}
            </p>
          ) : null}
          {sheetVisualMode === 'arcane-night' ? (
            <p className="mt-4 flex items-start gap-3 rounded-md border border-brand/20 bg-brand/10 px-4 py-3 text-sm font-semibold leading-6 text-brand">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Nocturno Arcano ya es un modo oscuro. Mientras este activo, el
              interruptor de modo oscuro se desactiva y no aparece en la
              ruedecilla de ajustes.
            </p>
          ) : null}

          <div className="mt-5 grid gap-4">
            <div className="rounded-xl border border-stroke/70 bg-white/60 px-5 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">
                    Modo oscuro
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-soft">
                    {isDarkModeLocked
                      ? 'Nocturno Arcano gestiona la lectura oscura por si mismo.'
                      : 'Activa una lectura nocturna.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleThemeToggle}
                  disabled={isSavingVisual || isDarkModeLocked}
                  className={`inline-flex w-fit items-center gap-3 rounded-full border px-3 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] transition ${
                    isDarkMode
                      ? 'border-brand/30 bg-brand/10 text-brand'
                      : 'border-stroke bg-white text-ink-soft hover:border-brand hover:text-brand'
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                  aria-pressed={isDarkMode}
                >
                  <span
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${
                      isDarkMode ? 'bg-brand' : 'bg-surface-strong'
                    }`}
                  >
                    <span
                      className={`absolute h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        isDarkMode ? 'translate-x-8' : 'translate-x-1'
                      }`}
                    />
                  </span>
                  {isDarkModeLocked
                    ? 'Gestionado'
                    : isDarkMode
                      ? 'Activo'
                      : 'Desactivado'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-stroke/70 bg-white/60 px-5 py-5">
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setIsVisualModePickerOpen((current) => !current)
                  }
                  className="flex w-full items-center justify-between gap-4 text-left"
                  aria-expanded={isVisualModePickerOpen}
                >
                  <span>
                    <span className="block font-label text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">
                      Modo visual
                    </span>
                    <span className="mt-2 block max-w-2xl text-sm leading-7 text-ink-soft">
                      {
                        SHEET_VISUAL_MODE_OPTIONS.find(
                          (option) => option.value === sheetVisualMode
                        )?.title
                      }{' '}
                      activo. Al cambiar de modo, la interfaz vuelve a modo
                      luminoso de base.
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-brand transition ${
                      isVisualModePickerOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isVisualModePickerOpen ? (
                  <div className="border-t border-stroke/70 pt-4">
                    <p className="mb-3 max-w-2xl text-sm leading-7 text-ink-soft">
                      Elige la personalidad visual de la web y de las fichas.
                      WikiCodex mantiene el diseño actual; el resto de modos
                      ajustan fondos, letras, líneas y rebordes sin cambiar el
                      funcionamiento.
                    </p>

                    <div className="grid gap-2">
                      {SHEET_VISUAL_MODE_OPTIONS.map((option) => {
                        const isSelected = sheetVisualMode === option.value

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              handleSheetVisualModeChange(option.value)
                            }
                            disabled={isSavingVisual || isSelected}
                            className={`flex min-w-0 items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition ${
                              isSelected
                                ? 'border-brand bg-brand/10 text-brand'
                                : 'border-stroke bg-white text-ink-soft hover:border-brand hover:text-brand'
                            } disabled:cursor-not-allowed disabled:opacity-70`}
                            aria-pressed={isSelected}
                          >
                            <span className="min-w-0">
                              <span className="block font-label text-[10px] font-black uppercase tracking-[0.18em]">
                                {option.title}
                              </span>
                              <span className="mt-1 block text-sm leading-6">
                                {option.text}
                              </span>
                            </span>
                            <span
                              className={`h-3 w-3 shrink-0 rounded-full border ${
                                isSelected
                                  ? 'border-brand bg-brand'
                                  : 'border-stroke bg-transparent'
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-stroke/70 bg-white/60 px-5 py-5">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">
                    Paleta principal
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-soft">
                    Elige el color base de la aplicación. Verás la muestra a tu
                    lado y el cambio se aplicara al confirmar.
                  </p>
                </div>

                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-4 rounded-xl border border-stroke bg-surface-strong/60 px-4 py-3">
                      <input
                        type="color"
                        value={paletteDraft}
                        onChange={(event) => {
                          setPaletteDraft(event.target.value)
                          setVisualMessage('')
                          setVisualError('')
                        }}
                        className="h-14 w-14 cursor-pointer rounded-md border-0 bg-transparent p-0"
                        aria-label="Seleccionar color principal"
                      />
                      <span className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                        Selector
                      </span>
                    </label>

                    <div className="flex items-center gap-3 rounded-xl border border-stroke bg-white px-4 py-3">
                      <span
                        className="h-12 w-12 rounded-lg border border-black/10"
                        style={{ backgroundColor: paletteDraft }}
                      />
                      <div>
                        <p className="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                          Color elegido
                        </p>
                        <p className="mt-1 font-display text-lg font-bold text-ink">
                          {paletteDraft.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handlePaletteApply}
                      disabled={isSavingVisual || paletteDraft === paletteColor}
                      className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Save className="h-4 w-4" />
                      {isSavingVisual ? 'Guardando...' : 'Confirmar color'}
                    </button>
                    <button
                      type="button"
                      onClick={handleThemeReset}
                      disabled={isSavingVisual}
                      className="inline-flex items-center gap-2 rounded-md border border-stroke bg-white px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restablecer
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-stroke bg-surface-strong/30 px-4 py-4">
                  <p className="font-label text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">
                    Color aplicado ahora
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <span
                      className="h-10 w-10 rounded-lg border border-black/10"
                      style={{ backgroundColor: paletteColor }}
                    />
                    <span className="font-display text-lg font-bold text-ink">
                      {paletteColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AccountSection>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CampaignsPanel
          campaigns={campaigns}
          isLoading={campaignsQuery.isLoading}
          open={openProfileSections.campaigns}
          onToggle={() =>
            setOpenProfileSections((current) => ({
              ...current,
              campaigns: !current.campaigns,
            }))
          }
        />
        <SavedTraitsPanel
          data={savedTraitsQuery.data}
          isLoading={savedTraitsQuery.isLoading}
          open={openProfileSections.savedTraits}
          onToggle={() =>
            setOpenProfileSections((current) => ({
              ...current,
              savedTraits: !current.savedTraits,
            }))
          }
          openCreate={openSavedTraitSections.create}
          openList={openSavedTraitSections.list}
          onToggleCreate={() =>
            setOpenSavedTraitSections((current) => ({
              ...current,
              create: !current.create,
            }))
          }
          onToggleList={() =>
            setOpenSavedTraitSections((current) => ({
              ...current,
              list: !current.list,
            }))
          }
          search={savedTraitSearch}
          onSearchChange={setSavedTraitSearch}
          sourceFilter={savedTraitSourceFilter}
          onSourceFilterChange={setSavedTraitSourceFilter}
          sourceEntityFilter={savedTraitSourceEntityFilter}
          onSourceEntityFilterChange={setSavedTraitSourceEntityFilter}
          form={savedTraitForm}
          onFormChange={setSavedTraitForm}
          editingTraitId={editingTraitId}
          onEdit={handleEditSavedTrait}
          onCancelEdit={handleCancelEditSavedTrait}
          onSubmit={handleSavedTraitSubmit}
          onDelete={(traitId) => deleteSavedTraitMutation.mutate(traitId)}
          isSaving={isSavingTrait}
          deletingTraitId={deleteSavedTraitMutation.variables || null}
          error={savedTraitError}
        />
      </div>

      <EntrySection
        title="Personajes"
        label="Personaje"
        icon={UserRound}
        items={characterItems}
        shownCount={characterShown}
        totalCount={characterTotal}
        canLoadMore={characterFeed.canLoadMore}
        canLoadLess={characterFeed.canLoadLess}
        isLoading={charactersQuery.isLoading}
        isDynamic
        open={openEntrySections.personajes}
        onToggle={() => toggleEntrySection('personajes')}
        onLoadMore={characterFeed.loadMore}
        onLoadLess={characterFeed.loadLess}
        onLoadAll={characterFeed.loadAll}
        onShowRecent={characterFeed.showRecent}
        expandedGrid={expandedGrid}
      />

      <EntrySection
        title="Objetos"
        label="Objeto"
        icon={Sword}
        items={objectItems}
        shownCount={objectShown}
        totalCount={objectTotal}
        canLoadMore={objectFeed.canLoadMore}
        canLoadLess={objectFeed.canLoadLess}
        isLoading={objectsQuery.isLoading}
        renderItem={(item) => <ProfileObjectCard key={item.id} item={item} />}
        open={openEntrySections.objetos}
        onToggle={() => toggleEntrySection('objetos')}
        onLoadMore={objectFeed.loadMore}
        onLoadLess={objectFeed.loadLess}
        onLoadAll={objectFeed.loadAll}
        onShowRecent={objectFeed.showRecent}
        expandedGrid={expandedGrid}
      />

      <EntrySection
        title="Lugares"
        label="Lugar"
        icon={MapPinned}
        items={placeItems}
        shownCount={placeShown}
        totalCount={placeTotal}
        canLoadMore={placeFeed.canLoadMore}
        canLoadLess={placeFeed.canLoadLess}
        isLoading={placesQuery.isLoading}
        renderItem={(item) => <ProfilePlaceCard key={item.id} item={item} />}
        open={openEntrySections.lugares}
        onToggle={() => toggleEntrySection('lugares')}
        onLoadMore={placeFeed.loadMore}
        onLoadLess={placeFeed.loadLess}
        onLoadAll={placeFeed.loadAll}
        onShowRecent={placeFeed.showRecent}
        expandedGrid={expandedGrid}
      />

      <PowersEntryGroup
        open={openEntrySections.poderes}
        onToggle={() => toggleEntrySection('poderes')}
      >
        <EntrySection
          title="Hechizos"
          label="Hechizo"
          icon={BookOpen}
          items={spellItems}
          shownCount={spellShown}
          totalCount={spellTotal}
          canLoadMore={spellFeed.canLoadMore}
          canLoadLess={spellFeed.canLoadLess}
          isLoading={spellsQuery.isLoading}
          renderItem={(item) => <ProfileSpellCard key={item.id} item={item} />}
          open={openEntrySections.hechizos}
          onToggle={() => toggleEntrySection('hechizos')}
          onLoadMore={spellFeed.loadMore}
          onLoadLess={spellFeed.loadLess}
          onLoadAll={spellFeed.loadAll}
          onShowRecent={spellFeed.showRecent}
          expandedGrid={expandedGrid}
        />
        <div className="mt-4">
          <EntrySection
            title="Otros poderes"
            label="Poder"
            icon={Sparkles}
            items={powerItems}
            shownCount={powerShown}
            totalCount={powerTotal}
            canLoadMore={powerFeed.canLoadMore}
            canLoadLess={powerFeed.canLoadLess}
            isLoading={powersQuery.isLoading}
            renderItem={(item) => (
              <ProfilePowerCard key={item.id} item={item} />
            )}
            open={openEntrySections.otrosPoderes}
            onToggle={() => toggleEntrySection('otrosPoderes')}
            onLoadMore={powerFeed.loadMore}
            onLoadLess={powerFeed.loadLess}
            onLoadAll={powerFeed.loadAll}
            onShowRecent={powerFeed.showRecent}
            expandedGrid={expandedGrid}
          />
        </div>
      </PowersEntryGroup>

      {isNameConfirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setIsNameConfirmOpen(false)}
            aria-label="Cancelar cambio de nombre"
          />
          <article className="relative w-full max-w-md rounded-2xl border border-stroke bg-white p-6 shadow-glow">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-label text-[10px] font-black uppercase tracking-[0.2em] text-brand">
                  Confirmar cambio
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.05em] text-ink">
                  ¿Cambiar tu nombre de usuario?
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink-soft">
                  Vas a pasar de{' '}
                  <strong className="text-ink">{user?.nombreUsuario}</strong> a{' '}
                  <strong className="text-ink">{profileName.trim()}</strong>.
                  Este cambio afectará a cómo te ven otros usuarios.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsNameConfirmOpen(false)}
                className="inline-flex justify-center rounded-md border border-stroke bg-white px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] text-ink-soft transition hover:border-brand hover:text-brand"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveProfileName}
                disabled={isSavingProfile}
                className="theme-solid-button inline-flex justify-center rounded-md px-5 py-3 font-label text-[10px] font-black uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingProfile ? 'Guardando...' : 'Sí, cambiar nombre'}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}
