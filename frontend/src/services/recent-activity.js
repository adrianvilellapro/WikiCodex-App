export const RECENT_ACTIVITY_EVENT = 'wikicodex:recent-detail-activity:update'
export const RECENT_ACTIVITY_STORAGE_KEY = 'wikicodex:recent-detail-activity'

const MAX_RECENT_ACTIVITY_ITEMS = 30

function canUseStorage() {
  return typeof window !== 'undefined' && window.localStorage
}

export function getRecentActivity() {
  if (!canUseStorage()) {
    return []
  }

  try {
    const stored = window.localStorage.getItem(RECENT_ACTIVITY_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function recordRecentActivity(entry) {
  if (!canUseStorage() || !entry?.entityType || !entry?.entityId) {
    return
  }

  const normalized = {
    entityType: entry.entityType,
    entityId: entry.entityId,
    nombre: entry.nombre || 'Sin nombre',
    subtitulo: entry.subtitulo || '',
    imagenUrl: entry.imagenUrl || null,
    urlDestino: entry.urlDestino || '',
    modoVista: entry.modoVista || 'full',
    vistoEn: new Date().toISOString(),
  }
  const current = getRecentActivity().filter(
    (item) =>
      item.entityType !== normalized.entityType ||
      item.entityId !== normalized.entityId
  )
  const next = [normalized, ...current].slice(0, MAX_RECENT_ACTIVITY_ITEMS)

  window.localStorage.setItem(RECENT_ACTIVITY_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(RECENT_ACTIVITY_EVENT, { detail: next }))
}
