import { api } from './http'

export const FAVORITES_UPDATED_EVENT = 'wikicodex:favorites:update'

export async function fetchFavorites({ limit = 20 } = {}) {
  const { data } = await api.get('/favorites', {
    params: { limit },
  })

  return data
}

export async function fetchFavoriteStatus(entityType, entityId) {
  const { data } = await api.get(`/favorites/${entityType}/${entityId}`)
  return data
}

export async function setFavorite(entityType, entityId, favorito) {
  const { data } = await api.put(`/favorites/${entityType}/${entityId}`, {
    favorito,
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FAVORITES_UPDATED_EVENT))
  }

  return data
}
