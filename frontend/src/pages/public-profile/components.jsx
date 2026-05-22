import { Link, useLocation } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  MapPinned,
  Pencil,
  Shield,
  Sparkles,
  Sword,
  UserRound,
  Users,
} from 'lucide-react'

import { CloudinaryImage } from '../../components/ui/CloudinaryImage'
import { ObjectPreviewImage } from '../../components/ui/ObjectPreviewImage'
import { PlacePreviewImage } from '../../components/ui/PlacePreviewImage'

export function PublicProfileLoading() {
  return (
    <section className="grid gap-6">
      <article className="panel overflow-hidden">
        <div className="theme-header-surface h-16" />
        <div className="grid gap-6 px-6 py-8">
          <div className="h-44 rounded-xl bg-surface-strong/60" />
          <div className="h-64 rounded-xl bg-surface-strong/50" />
        </div>
      </article>
    </section>
  )
}

export function PublicProfileError() {
  return (
    <section className="grid gap-6">
      <article className="panel px-6 py-8 text-sm text-danger">
        No se pudo cargar la ficha pública del usuario.
      </article>
    </section>
  )
}

export function PublicProfileHeader({
  user,
  isOwnProfile = false,
  editLink,
  previewLink,
  backLink = '/app',
  backState,
  rightActions,
}) {
  return (
    <div className="theme-header-surface overflow-hidden border-b-2 border-brand">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <Link
          to={backLink}
          state={backState}
          className="theme-header-button inline-flex h-11 w-11 items-center justify-center rounded-full border transition"
          aria-label="Volver"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <h1 className="flex-1 text-center font-headline text-xl font-black uppercase tracking-[0.28em] text-brand sm:text-2xl">
          Ficha Publica
        </h1>

        <div className="flex min-w-[11rem] justify-end gap-2">
          {rightActions ? (
            rightActions
          ) : (
            <>
              {previewLink ? (
                <Link
                  to={previewLink}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white/80 transition hover:border-brand/50 hover:text-white"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Link>
              ) : null}
              {isOwnProfile && editLink ? (
                <Link
                  to={editLink}
                  className="brand-button inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] transition hover:bg-brand-strong"
                >
                  <Pencil className="h-4 w-4" />
                  Personalizar
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 px-5 py-5 backdrop-blur-sm">
          <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,11rem)_1fr]">
            <div className="theme-header-card mx-auto w-full max-w-[11rem] overflow-hidden rounded-[1.4rem] border border-brand/30">
              {user?.imagenPerfilUrl ? (
                <CloudinaryImage
                  src={user.imagenPerfilUrl}
                  alt={user.nombreUsuario}
                  variant="profileAvatar"
                  sizes="176px"
                  className="block h-auto w-full"
                  loading="eager"
                />
              ) : (
                <div className="theme-brand-radial flex aspect-[3/4] w-full items-center justify-center text-brand">
                  <Shield className="h-12 w-12" />
                </div>
              )}
            </div>

            <div className="min-w-0 text-center sm:text-left">
              <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand/90">
                Archivo del usuario
              </p>
              <h2 className="mt-3 font-display text-4xl font-black tracking-[-0.06em] text-white sm:text-5xl">
                {user?.nombreUsuario}
              </h2>
              <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                  <Shield className="h-4 w-4" />
                  {user?.rol?.nombre || 'Cuenta normal'}
                </span>
                {isOwnProfile ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
                    Vista propia
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PublicProfileStats({ stats }) {
  const items = [
    {
      key: 'personajes',
      label: 'Personajes públicos',
      value: stats?.personajesPublicos || 0,
      icon: Sword,
    },
    {
      key: 'master',
      label: 'Campañas como master',
      value: stats?.campanasComoMaster || 0,
      icon: Sparkles,
    },
    {
      key: 'jugador',
      label: 'Campañas como jugador',
      value: stats?.campanasComoJugador || 0,
      icon: Users,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon

        return (
          <div
            key={item.key}
            className="rounded-2xl border border-stroke/70 bg-white px-5 py-5 shadow-card"
          >
            <p className="inline-flex items-center gap-2 font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
              <Icon className="h-4 w-4 text-brand" />
              {item.label}
            </p>
            <p className="mt-3 font-display text-3xl font-black tracking-[-0.06em] text-ink">
              {item.value}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function FeaturedCharacterCard({
  character,
  title = 'Personaje destacado',
  emptyTitle = 'Todavía no hay personaje destacado',
  emptyDescription = 'Puedes elegir uno en el editor de la ficha pública.',
  actionLabel = 'Ver personaje',
  actionIcon = Sword,
  getDetailPath = (item) => `/app/personajes/${item.id}`,
  getSubtitle = (item) => item.titulo || 'Sin titulo registrado.',
  children,
}) {
  const FeaturedActionIcon = actionIcon

  return (
    <article className="rounded-[1.7rem] border border-stroke/70 bg-white p-4 shadow-card sm:p-5">
      <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
        {title}
      </p>

      {character ? (
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
          <div className="theme-header-card relative overflow-hidden rounded-[1.45rem] border border-brand/40 p-3">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.28rem]">
              <div className="theme-brand-orbit absolute inset-[-52%] animate-[spin_6.5s_linear_infinite]" />
              <div className="theme-brand-orbit-inner absolute inset-[5px] rounded-[1.04rem]" />
            </div>
            <div className="relative overflow-hidden rounded-[1.08rem] bg-surface-strong">
              {character.imagenPrincipalUrl || character.imagenUrl ? (
                <CloudinaryImage
                  src={character.imagenPrincipalUrl || character.imagenUrl}
                  alt={character.nombre}
                  variant="card"
                  sizes="(min-width: 1024px) 32vw, 100vw"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="theme-brand-gradient flex aspect-[3/4] w-full items-center justify-center text-brand">
                  <UserRound className="h-12 w-12" />
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <p className="font-label text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted">
              Seleccion del perfil
            </p>
            <h3 className="mt-3 font-display text-3xl font-black tracking-[-0.05em] text-ink">
              {character.nombre}
            </h3>
            <p className="mt-2 text-base leading-7 text-ink-soft">
              {getSubtitle(character)}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to={getDetailPath(character)}
                className="theme-solid-button inline-flex items-center gap-2 rounded-full px-4 py-2 font-label text-[10px] font-black uppercase tracking-[0.16em] transition"
              >
                <FeaturedActionIcon className="h-4 w-4" />
                {actionLabel}
              </Link>
            </div>

            {children ? <div className="mt-5">{children}</div> : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[1.4rem] border border-dashed border-stroke bg-surface-strong/35 px-5 py-8">
          <h3 className="font-display text-2xl font-black tracking-[-0.05em] text-ink">
            {emptyTitle}
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft">
            {emptyDescription}
          </p>
          {children ? <div className="mt-5">{children}</div> : null}
        </div>
      )}
    </article>
  )
}

function PublicProfileFeaturedTile({
  item,
  title,
  path,
  icon: Icon,
  subtitle,
  type,
  featured = false,
  compact = false,
  roomy = false,
}) {
  const location = useLocation()
  const FallbackIcon = Icon

  if (!item) {
    return null
  }

  const imageUrl = item.imagenPrincipalUrl || item.imagenUrl || null
  const isSpell = type === 'spell'
  const isPower = type === 'power'
  const isCharacter = type === 'character'
  const isObject = type === 'object'
  const imageClass = isCharacter
    ? roomy
      ? 'max-h-[21rem] rounded-[1.08rem]'
      : 'max-h-80 rounded-[1.08rem]'
    : isObject
      ? roomy
        ? 'max-h-80 rounded-[1.08rem]'
        : 'max-h-64 rounded-[1.08rem]'
      : featured
        ? roomy
          ? 'max-h-72 rounded-[1.08rem]'
          : 'max-h-56 rounded-[1.08rem]'
        : compact
          ? 'max-h-48 rounded-[0.9rem]'
          : roomy
            ? 'max-h-64 rounded-[0.9rem]'
            : 'max-h-56 rounded-[0.9rem]'
  const fallbackClass = isCharacter
    ? roomy
      ? 'h-72 w-56 rounded-[1.08rem]'
      : 'h-64 w-52 rounded-[1.08rem]'
    : isObject
      ? roomy
        ? 'h-64 w-60 rounded-[1.08rem]'
        : 'h-52 w-52 rounded-[1.08rem]'
      : featured
        ? roomy
          ? 'h-56 w-52 rounded-[1.08rem]'
          : 'h-48 w-48 rounded-[1.08rem]'
        : compact
          ? 'h-40 w-44 rounded-[0.9rem]'
          : roomy
            ? 'h-52 w-52 rounded-[0.9rem]'
            : 'h-44 w-48 rounded-[0.9rem]'
  const sizes = featured
    ? '(min-width: 1280px) 38vw, 100vw'
    : '(min-width: 1280px) 18vw, (min-width: 768px) 35vw, 100vw'

  function renderImage() {
    if (imageUrl) {
      return (
        <CloudinaryImage
          src={imageUrl}
          alt={item.nombre}
          variant="detail"
          sizes={sizes}
          className={`block h-auto w-auto max-w-full object-contain transition duration-500 group-hover:scale-[1.02] ${imageClass}`}
        />
      )
    }

    return (
      <div
        className={`theme-brand-gradient flex items-center justify-center text-brand ${fallbackClass}`}
      >
        <FallbackIcon className={featured ? 'h-14 w-14' : 'h-9 w-9'} />
      </div>
    )
  }

  return (
    <Link
      to={path}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
      className={`group relative grid h-full overflow-hidden rounded-[1.35rem] border bg-surface transition hover:shadow-glow ${
        isSpell ? 'theme-header-card border-brand/40 p-3' : 'border-stroke'
      } ${
        featured
          ? isCharacter
            ? 'gap-3 p-3 2xl:grid-cols-[minmax(14rem,19rem)_minmax(0,1fr)]'
            : isObject
              ? 'gap-3 p-3 2xl:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)]'
              : 'gap-3 p-3 2xl:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)]'
          : isSpell
            ? ''
            : 'p-3'
      }`}
      aria-label={`Ver ${title.toLowerCase()} ${item.nombre}`}
    >
      {isSpell ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="theme-brand-orbit absolute inset-[-58%] animate-[spin_6.5s_linear_infinite]" />
          <div className="theme-brand-orbit-inner absolute inset-[4px] rounded-[inherit]" />
        </div>
      ) : null}

      {!isSpell ? (
        <div
          className={`theme-header-card relative w-full max-w-full self-center justify-self-center overflow-hidden border border-brand/35 bg-surface-strong ${
            featured ? 'rounded-[1.45rem] p-2' : 'rounded-[1.15rem] p-1.5'
          }`}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
            <div className="theme-brand-orbit absolute inset-[-58%] animate-[spin_6.5s_linear_infinite]" />
            <div className="theme-brand-orbit-inner absolute inset-[4px] rounded-[inherit]" />
          </div>
          <div className="relative flex items-center justify-center overflow-hidden rounded-[inherit] bg-transparent">
            {renderImage()}
          </div>
        </div>
      ) : null}

      <div
        className={`relative min-w-0 ${
          isSpell
            ? 'self-center rounded-[1rem] border border-stroke bg-surface p-4 shadow-sm'
            : featured
              ? 'p-4'
              : 'px-3 pb-3 pt-3'
        }`}
      >
        <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
          {title}
        </p>
        <h3
          className={`mt-2 line-clamp-3 break-words font-display font-black leading-tight tracking-[-0.05em] text-ink ${
            featured ? 'text-3xl' : compact ? 'text-xl' : 'text-2xl'
          }`}
        >
          {item.nombre}
        </h3>
        <p className="mt-2 line-clamp-3 break-words text-sm font-semibold leading-6 text-ink-soft">
          {subtitle}
        </p>
        {isSpell ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="archive-chip">Hechizo</span>
              <span className="archive-chip">
                {Number(item.nivel) === 0 ? 'Truco' : `Nivel ${item.nivel}`}
              </span>
              {item.escuela ? (
                <span className="archive-chip">{item.escuela}</span>
              ) : null}
            </div>
            <p
              className={`mt-4 text-sm leading-7 text-ink-soft ${
                compact ? 'line-clamp-2' : 'line-clamp-4'
              }`}
            >
              {item.descripcion || 'Este hechizo no tiene descripción pública.'}
            </p>
          </>
        ) : null}
        {isPower ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="archive-chip">Otro poder</span>
              {(item.categorias || []).slice(0, 3).map((category) => (
                <span
                  key={category.id || category.nombre}
                  className="archive-chip"
                >
                  {category.nombre}
                </span>
              ))}
            </div>
            <p
              className={`mt-4 text-sm leading-7 text-ink-soft ${
                compact ? 'line-clamp-2' : 'line-clamp-4'
              }`}
            >
              {item.descripcion || 'Este poder no tiene descripción pública.'}
            </p>
          </>
        ) : null}
      </div>
    </Link>
  )
}

export function PublicProfileFeaturedShowcase({
  character,
  object,
  place,
  session,
  spell,
  power,
}) {
  const items = [
    character
      ? {
          key: 'character',
          item: character,
          title: 'Personaje destacado',
          path: `/app/personajes/${character.id}`,
          icon: UserRound,
          subtitle: character.titulo || 'Sin titulo registrado.',
          type: 'character',
          priority: true,
        }
      : null,
    object
      ? {
          key: 'object',
          item: object,
          title: 'Objeto destacado',
          path: `/app/objetos/${object.id}`,
          icon: Sword,
          subtitle: object.tier?.nombre || 'Objeto público',
          type: 'object',
        }
      : null,
    place
      ? {
          key: 'place',
          item: place,
          title: 'Lugar destacado',
          path: `/app/lugares/${place.id}`,
          icon: MapPinned,
          subtitle: place.tipo?.nombre || place.descripcion || 'Lugar',
          type: 'place',
        }
      : null,
    session
      ? {
          key: 'session',
          item: session,
          title: 'Partida destacada',
          path: `/app/campanas/${session.campanaId}/partidas/${session.id}`,
          icon: CalendarDays,
          subtitle: session.campana?.nombre || 'Partida',
          type: 'session',
        }
      : null,
    spell
      ? {
          key: 'spell',
          item: spell,
          title: 'Hechizo destacado',
          path: `/app/poderes/hechizos/${spell.id}`,
          icon: BookOpen,
          subtitle: `${Number(spell.nivel) === 0 ? 'Truco' : `Nivel ${spell.nivel}`}${
            spell.escuela ? ` - ${spell.escuela}` : ''
          }`,
          type: 'spell',
        }
      : null,
    power
      ? {
          key: 'power',
          item: power,
          title: 'Poder destacado',
          path: `/app/poderes/otros/${power.id}`,
          icon: Sparkles,
          subtitle: power.categorias?.length
            ? power.categorias.map((category) => category.nombre).join(', ')
            : power.descripcion || 'Poder',
          type: 'power',
        }
      : null,
  ].filter(Boolean)
  const hasCharacter = Boolean(character)
  const hasObject = Boolean(object)
  const gridClass =
    items.length <= 1 ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-12'
  const showcaseHeightClass =
    items.length <= 2
      ? 'xl:min-h-[28rem]'
      : items.length <= 4
        ? 'xl:min-h-[30rem]'
        : 'xl:min-h-[32rem]'

  function getSpanClass(featuredItem, index) {
    if (items.length <= 1) {
      return 'sm:col-span-2 xl:col-span-12'
    }

    if (hasCharacter) {
      if (items.length === 2) {
        return featuredItem.key === 'character'
          ? 'xl:col-span-7'
          : 'xl:col-span-5'
      }

      if (items.length === 3) {
        return featuredItem.key === 'character'
          ? 'sm:col-span-2 xl:col-span-6'
          : 'xl:col-span-3'
      }

      if (items.length === 4) {
        if (featuredItem.key === 'character') {
          return 'sm:col-span-2 xl:col-span-7'
        }

        if (featuredItem.key === 'object') {
          return 'xl:col-span-5'
        }

        return 'xl:col-span-6'
      }

      if (items.length === 5) {
        if (featuredItem.key === 'character') {
          return 'sm:col-span-2 xl:col-span-5'
        }

        if (featuredItem.key === 'object') {
          return 'sm:col-span-2 xl:col-span-4'
        }

        return index === 2 ? 'xl:col-span-3' : 'xl:col-span-6'
      }

      if (featuredItem.key === 'character') {
        return hasObject
          ? 'sm:col-span-2 xl:col-span-5'
          : 'sm:col-span-2 xl:col-span-6'
      }

      if (featuredItem.key === 'object') {
        return 'sm:col-span-2 xl:col-span-4'
      }

      if (featuredItem.key === 'spell') {
        return 'xl:col-span-3'
      }

      return 'xl:col-span-4'
    }

    if (items.length === 2) {
      return 'xl:col-span-6'
    }

    if (items.length === 3) {
      return 'xl:col-span-4'
    }

    if (items.length === 4) {
      return 'xl:col-span-6'
    }

    if (items.length === 5) {
      return index < 2 ? 'xl:col-span-6' : 'xl:col-span-4'
    }

    return featuredItem.key === 'spell' ? 'xl:col-span-3' : 'xl:col-span-4'
  }

  if (!items.length) {
    return (
      <article className="rounded-[1.7rem] border border-stroke/70 bg-white p-4 shadow-card sm:p-5">
        <div className="rounded-[1.4rem] border border-dashed border-stroke bg-surface-strong/35 px-5 py-8">
          <h3 className="font-display text-2xl font-black tracking-[-0.05em] text-ink">
            Todavía no hay destacados
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft">
            Este usuario aún no ha elegido elementos para su expositor público.
          </p>
        </div>
      </article>
    )
  }

  return (
    <article
      className={`rounded-[1.7rem] border border-stroke/70 bg-white p-4 shadow-card sm:p-5 ${showcaseHeightClass}`}
    >
      <div
        className={`grid h-full auto-rows-[minmax(12rem,auto)] grid-flow-dense gap-4 xl:auto-rows-fr ${gridClass}`}
      >
        {items.map((featuredItem, index) => {
          const spanClass = getSpanClass(featuredItem, index)
          const compact =
            items.length >= 5 &&
            !featuredItem.priority &&
            featuredItem.key !== 'object'
          const roomy = items.length <= 3

          return (
            <div key={featuredItem.key} className={spanClass}>
              <PublicProfileFeaturedTile
                item={featuredItem.item}
                title={featuredItem.title}
                path={featuredItem.path}
                icon={featuredItem.icon}
                subtitle={featuredItem.subtitle}
                type={featuredItem.type}
                featured={featuredItem.priority}
                compact={compact}
                roomy={roomy}
              />
            </div>
          )
        })}
      </div>
    </article>
  )
}

export function PublicProfileCharacterCard({ item }) {
  const location = useLocation()
  const visibilityLabel =
    item.modoVista === 'preview' ? 'Vista previa' : 'Visible completo'

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
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="archive-chip">Personaje</span>
          <span
            className={`archive-chip ${
              item.modoVista === 'preview'
                ? 'bg-surface-strong text-ink-soft'
                : 'bg-brand/10 text-brand'
            }`}
          >
            {visibilityLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function PublicProfileObjectCard({ item }) {
  const location = useLocation()
  const visibilityLabel =
    item.modoVista === 'preview' ? 'Vista previa' : 'Visible completo'

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
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="archive-chip">Objeto</span>
          <span
            className={`archive-chip ${
              item.modoVista === 'preview'
                ? 'bg-surface-strong text-ink-soft'
                : 'bg-brand/10 text-brand'
            }`}
          >
            {visibilityLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function PublicProfilePlaceCard({ item }) {
  const location = useLocation()
  const visibilityLabel =
    item.modoVista === 'preview' ? 'Vista previa' : 'Visible completo'

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
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="archive-chip">Lugar</span>
          <span
            className={`archive-chip ${
              item.modoVista === 'preview'
                ? 'bg-surface-strong text-ink-soft'
                : 'bg-brand/10 text-brand'
            }`}
          >
            {visibilityLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function PublicProfileSpellCard({ item }) {
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
            {item.esPublico ? 'Público' : 'Visible por permisos'}
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
export function PublicProfilePlaceholderCard({ item, label }) {
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

export function PublicProfilePowerCard({ item }) {
  const location = useLocation()

  return (
    <Link
      to={`/app/poderes/otros/${item.id}`}
      state={{
        returnTo: {
          pathname: location.pathname,
          scrollY: window.scrollY,
        },
      }}
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
          {item.modoVista === 'preview' ? (
            <span className="archive-chip">Vista previa</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

export function PublicProfileEntriesSection({
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
            Archivo visible
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
                  <PublicProfileCharacterCard key={item.id} item={item} />
                ) : (
                  <PublicProfilePlaceholderCard
                    key={item.id}
                    item={item}
                    label={label}
                  />
                )
              )
            ) : (
              <div className="col-span-full rounded-lg border border-stroke/70 bg-white/60 px-5 py-6 text-sm text-ink-soft">
                No hay {title.toLowerCase()} visibles en esta ficha pública.
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
              <Sparkles className="h-4 w-4" />
              Mostrar solo 10 ultimos
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export function PublicProfileDescription({
  description,
  editable = false,
  value,
  onChange,
  maxLength = 4000,
}) {
  return (
    <article className="rounded-[1.7rem] border border-stroke/70 bg-white p-5 shadow-card">
      <p className="font-label text-[10px] font-black uppercase tracking-[0.22em] text-brand">
        Descripción del perfil
      </p>

      {editable ? (
        <textarea
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          rows={8}
          className="archive-input mt-4 min-h-52 resize-y"
          placeholder="Escribe la presentación pública del perfil, tono del archivo, notas de ambientación o cualquier frase que quieras mostrar."
        />
      ) : (
        <div className="mt-4 rounded-[1.2rem] border border-stroke/70 bg-surface-strong/25 px-5 py-5">
          <p className="whitespace-pre-wrap text-sm leading-8 text-ink-soft">
            {description?.trim()
              ? description
              : 'Este perfil todavía no tiene descripción pública.'}
          </p>
        </div>
      )}
    </article>
  )
}
