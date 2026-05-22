import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronDown,
  MapPinned,
  Sparkles,
  Sword,
  UserRound,
} from 'lucide-react'
import { useLocation, useOutletContext, useParams } from 'react-router-dom'

import { CommentsSection } from '../components/comments/CommentsSection'
import { useAuth } from '../features/auth/auth-context'
import {
  getThemeVariables,
  normalizeHexColor,
} from '../features/theme/theme-context'
import { useIncrementalCardFeed } from '../hooks/useIncrementalCardFeed'
import {
  fetchPublicProfile,
  fetchPublicProfileCharacters,
  fetchPublicProfileObjects,
  fetchPublicProfilePlaces,
  fetchPublicProfilePowers,
  fetchPublicProfileSpells,
} from './public-profile/api'
import {
  PublicProfileDescription,
  PublicProfileEntriesSection,
  PublicProfileError,
  PublicProfileFeaturedShowcase,
  PublicProfileHeader,
  PublicProfileLoading,
  PublicProfileObjectCard,
  PublicProfilePlaceCard,
  PublicProfilePowerCard,
  PublicProfileSpellCard,
  PublicProfileStats,
} from './public-profile/components'

const EMPTY_ITEMS = []

function PublicPowersEntryGroup({ open, onToggle, children }) {
  return (
    <article className="panel overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-3 px-6 py-6 text-left sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.22em] text-ink-muted">
            Biblioteca pública
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

export function PublicProfilePage() {
  const { userId } = useParams()
  const location = useLocation()
  const outletContext = useOutletContext() || {}
  const expandedGrid = Boolean(
    outletContext.isLeftCollapsed && outletContext.isRightCollapsed
  )
  const { user } = useAuth()
  const [openSections, setOpenSections] = useState({
    personajes: true,
    objetos: false,
    lugares: false,
    poderes: false,
    hechizos: false,
    otrosPoderes: false,
  })

  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: () => fetchPublicProfile(userId),
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const characterFeed = useIncrementalCardFeed({
    seedKey: `${userId}:${dataUpdatedAt}`,
    initialItems: data?.entradas?.personajes?.items || EMPTY_ITEMS,
    initialTotal: data?.entradas?.personajes?.totalVisible || 0,
    initialNextCursor: data?.entradas?.personajes?.nextCursor || null,
    pageSize: 10,
    fetchPage: ({ limit, cursor }) =>
      fetchPublicProfileCharacters(userId, { limit, cursor }),
  })
  const objectFeed = useIncrementalCardFeed({
    seedKey: `${userId}:objects:${dataUpdatedAt}`,
    initialItems: data?.entradas?.objetos?.items || EMPTY_ITEMS,
    initialTotal: data?.entradas?.objetos?.totalVisible || 0,
    initialNextCursor: data?.entradas?.objetos?.nextCursor || null,
    pageSize: 10,
    fetchPage: ({ limit, cursor }) =>
      fetchPublicProfileObjects(userId, { limit, cursor }),
  })
  const placeFeed = useIncrementalCardFeed({
    seedKey: `${userId}:places:${dataUpdatedAt}`,
    initialItems: data?.entradas?.lugares?.items || EMPTY_ITEMS,
    initialTotal: data?.entradas?.lugares?.totalVisible || 0,
    initialNextCursor: data?.entradas?.lugares?.nextCursor || null,
    pageSize: 10,
    fetchPage: ({ limit, cursor }) =>
      fetchPublicProfilePlaces(userId, { limit, cursor }),
  })
  const spellFeed = useIncrementalCardFeed({
    seedKey: `${userId}:spells:${dataUpdatedAt}`,
    initialItems: data?.entradas?.hechizos?.items || EMPTY_ITEMS,
    initialTotal: data?.entradas?.hechizos?.totalVisible || 0,
    initialNextCursor: data?.entradas?.hechizos?.nextCursor || null,
    pageSize: 10,
    fetchPage: ({ limit, cursor }) =>
      fetchPublicProfileSpells(userId, { limit, cursor }),
  })
  const powerFeed = useIncrementalCardFeed({
    seedKey: `${userId}:powers:${dataUpdatedAt}`,
    initialItems: data?.entradas?.poderes?.items || EMPTY_ITEMS,
    initialTotal: data?.entradas?.poderes?.totalVisible || 0,
    initialNextCursor: data?.entradas?.poderes?.nextCursor || null,
    pageSize: 10,
    fetchPage: ({ limit, cursor }) =>
      fetchPublicProfilePowers(userId, { limit, cursor }),
  })
  const profileThemeStyle = useMemo(
    () =>
      getThemeVariables(
        normalizeHexColor(data?.item?.usuario?.temaColorHex || '#026b00')
      ),
    [data?.item?.usuario?.temaColorHex]
  )

  if (isLoading) {
    return <PublicProfileLoading />
  }

  if (isError || !data) {
    return <PublicProfileError />
  }

  const preview = location.state?.publicProfilePreview
  const isPreviewingDraft = Boolean(
    preview?.userId && preview.userId === userId
  )
  const profileItem = isPreviewingDraft
    ? {
        ...data.item,
        perfil: {
          ...(data.item?.perfil || {}),
          descripcion: preview.descripcion || '',
          personajeDestacado: preview.personajeDestacado || null,
          objetoDestacado: preview.objetoDestacado || null,
          lugarDestacado: preview.lugarDestacado || null,
          partidaDestacada: preview.partidaDestacada || null,
          hechizoDestacado: preview.hechizoDestacado || null,
          poderDestacado: preview.poderDestacado || null,
        },
      }
    : data.item

  if (!profileItem) {
    return <PublicProfileError />
  }

  const isOwnProfile = user?.id === userId
  const visibleCharacterItems = characterFeed.items
  const visibleCharacterTotal = characterFeed.total
  const visibleObjectItems = objectFeed.items
  const visibleObjectTotal = objectFeed.total
  const visiblePlaceItems = placeFeed.items
  const visiblePlaceTotal = placeFeed.total
  const visibleSpellItems = spellFeed.items
  const visibleSpellTotal = spellFeed.total
  const visiblePowerItems = powerFeed.items
  const visiblePowerTotal = powerFeed.total

  return (
    <section className="grid gap-6">
      <article className="panel overflow-hidden" style={profileThemeStyle}>
        <PublicProfileHeader
          user={profileItem.usuario}
          isOwnProfile={isOwnProfile}
          editLink={isOwnProfile ? '/app/perfil-publico/editar' : null}
          previewLink={null}
          backLink={isOwnProfile ? '/app/perfil' : '/app'}
        />

        <div className="grid gap-6 px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-8 xl:px-8">
          <PublicProfileFeaturedShowcase
            character={profileItem.perfil?.personajeDestacado || null}
            object={profileItem.perfil?.objetoDestacado || null}
            place={profileItem.perfil?.lugarDestacado || null}
            session={profileItem.perfil?.partidaDestacada || null}
            spell={profileItem.perfil?.hechizoDestacado || null}
            power={profileItem.perfil?.poderDestacado || null}
          />
          <PublicProfileStats stats={profileItem.estadisticas} />
          <PublicProfileDescription
            description={profileItem.perfil?.descripcion || ''}
          />

          <PublicProfileEntriesSection
            title="Personajes"
            label="Personaje"
            icon={UserRound}
            items={visibleCharacterItems}
            shownCount={characterFeed.shownCount}
            totalCount={visibleCharacterTotal}
            canLoadMore={characterFeed.canLoadMore}
            canLoadLess={characterFeed.canLoadLess}
            isLoading={false}
            isDynamic
            open={openSections.personajes}
            onToggle={() =>
              setOpenSections((current) => ({
                ...current,
                personajes: !current.personajes,
              }))
            }
            onLoadMore={characterFeed.loadMore}
            onLoadLess={characterFeed.loadLess}
            onLoadAll={characterFeed.loadAll}
            onShowRecent={characterFeed.showRecent}
            expandedGrid={expandedGrid}
          />

          <PublicProfileEntriesSection
            title="Objetos"
            label="Objeto"
            icon={Sword}
            items={visibleObjectItems}
            shownCount={objectFeed.shownCount}
            totalCount={visibleObjectTotal}
            canLoadMore={objectFeed.canLoadMore}
            canLoadLess={objectFeed.canLoadLess}
            isLoading={false}
            renderItem={(item) => (
              <PublicProfileObjectCard key={item.id} item={item} />
            )}
            open={openSections.objetos}
            onToggle={() =>
              setOpenSections((current) => ({
                ...current,
                objetos: !current.objetos,
              }))
            }
            onLoadMore={objectFeed.loadMore}
            onLoadLess={objectFeed.loadLess}
            onLoadAll={objectFeed.loadAll}
            onShowRecent={objectFeed.showRecent}
            expandedGrid={expandedGrid}
          />

          <PublicProfileEntriesSection
            title="Lugares"
            label="Lugar"
            icon={MapPinned}
            items={visiblePlaceItems}
            shownCount={placeFeed.shownCount}
            totalCount={visiblePlaceTotal}
            canLoadMore={placeFeed.canLoadMore}
            canLoadLess={placeFeed.canLoadLess}
            isLoading={false}
            renderItem={(item) => (
              <PublicProfilePlaceCard key={item.id} item={item} />
            )}
            open={openSections.lugares}
            onToggle={() =>
              setOpenSections((current) => ({
                ...current,
                lugares: !current.lugares,
              }))
            }
            onLoadMore={placeFeed.loadMore}
            onLoadLess={placeFeed.loadLess}
            onLoadAll={placeFeed.loadAll}
            onShowRecent={placeFeed.showRecent}
            expandedGrid={expandedGrid}
          />

          <PublicPowersEntryGroup
            open={openSections.poderes}
            onToggle={() =>
              setOpenSections((current) => ({
                ...current,
                poderes: !current.poderes,
              }))
            }
          >
            <PublicProfileEntriesSection
              title="Hechizos"
              label="Hechizo"
              icon={BookOpen}
              items={visibleSpellItems}
              shownCount={spellFeed.shownCount}
              totalCount={visibleSpellTotal}
              canLoadMore={spellFeed.canLoadMore}
              canLoadLess={spellFeed.canLoadLess}
              isLoading={false}
              renderItem={(item) => (
                <PublicProfileSpellCard key={item.id} item={item} />
              )}
              open={openSections.hechizos}
              onToggle={() =>
                setOpenSections((current) => ({
                  ...current,
                  hechizos: !current.hechizos,
                }))
              }
              onLoadMore={spellFeed.loadMore}
              onLoadLess={spellFeed.loadLess}
              onLoadAll={spellFeed.loadAll}
              onShowRecent={spellFeed.showRecent}
              expandedGrid={expandedGrid}
            />
            <div className="mt-4">
              <PublicProfileEntriesSection
                title="Otros poderes"
                label="Poder"
                icon={Sparkles}
                items={visiblePowerItems}
                shownCount={powerFeed.shownCount}
                totalCount={visiblePowerTotal}
                canLoadMore={powerFeed.canLoadMore}
                canLoadLess={powerFeed.canLoadLess}
                isLoading={false}
                renderItem={(item) => (
                  <PublicProfilePowerCard key={item.id} item={item} />
                )}
                open={openSections.otrosPoderes}
                onToggle={() =>
                  setOpenSections((current) => ({
                    ...current,
                    otrosPoderes: !current.otrosPoderes,
                  }))
                }
                onLoadMore={powerFeed.loadMore}
                onLoadLess={powerFeed.loadLess}
                onLoadAll={powerFeed.loadAll}
                onShowRecent={powerFeed.showRecent}
                expandedGrid={expandedGrid}
              />
            </div>
          </PublicPowersEntryGroup>
        </div>
      </article>
      <CommentsSection
        key={`comentarios-usuario-${userId}`}
        targetType="usuario"
        targetId={userId}
      />
    </section>
  )
}
