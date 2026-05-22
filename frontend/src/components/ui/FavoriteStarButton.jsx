import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'

import { useTheme } from '../../features/theme/theme-context'
import { cn } from '../../lib/cn'
import {
  fetchFavoriteStatus,
  setFavorite as persistFavorite,
} from '../../services/favorites'

export function FavoriteStarButton({
  entityType,
  entityId,
  className,
  label = '',
}) {
  const { paletteColor } = useTheme()
  const [isFavorite, setIsFavorite] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let alive = true

    async function loadStatus() {
      if (!entityType || !entityId) {
        return
      }

      try {
        const result = await fetchFavoriteStatus(entityType, entityId)

        if (alive) {
          setIsFavorite(Boolean(result.favorito))
        }
      } catch {
        if (alive) {
          setIsFavorite(false)
        }
      }
    }

    loadStatus()

    return () => {
      alive = false
    }
  }, [entityId, entityType])

  async function handleToggle() {
    if (!entityType || !entityId || isLoading) {
      return
    }

    const nextValue = !isFavorite
    setIsFavorite(nextValue)
    setIsLoading(true)

    try {
      const result = await persistFavorite(entityType, entityId, nextValue)
      setIsFavorite(Boolean(result.favorito))
    } catch {
      setIsFavorite(!nextValue)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-label text-[10px] font-black uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-60',
        label ? 'gap-2 px-3 py-2' : 'h-10 w-10',
        isFavorite
          ? 'border-brand/45 bg-brand/10 text-ink'
          : 'border-stroke bg-surface text-ink-soft hover:border-brand/45 hover:text-brand',
        className
      )}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Quitar de favoritos' : 'Marcar favorito'}
      title={isFavorite ? 'Quitar de favoritos' : 'Marcar favorito'}
    >
      <Star
        className="h-4 w-4"
        style={{
          color: isFavorite ? paletteColor : undefined,
          fill: isFavorite ? paletteColor : 'transparent',
        }}
      />
      {label ? label : null}
    </button>
  )
}
