import { api } from '../../services/http'
import { signAndUploadManagedImage } from '../../lib/image-upload'

function buildCampaignFilterParam(campaignIds) {
  if (!Array.isArray(campaignIds)) {
    return undefined
  }

  return campaignIds.length ? campaignIds.join(',') : '__none'
}

function buildPlaceArchiveParams({ filters, limit = 100, cursor = null } = {}) {
  if (!filters) {
    return { limit, cursor }
  }

  return {
    limit,
    cursor: cursor || undefined,
    q: filters.q?.trim() || undefined,
    matchMode: filters.matchMode,
    sort: filters.sort,
    tipoLugarIds: filters.tipoLugarIds?.length
      ? filters.tipoLugarIds.join(',')
      : undefined,
    campaignIds: buildCampaignFilterParam(filters.campaignIds),
  }
}

export async function fetchPlaces(options = {}) {
  const { data } = await api.get('/places', {
    params: buildPlaceArchiveParams(options),
  })
  return data
}

export async function fetchPlaceArchiveOptions() {
  const { data } = await api.get('/places/archive/options')
  return data
}

export async function fetchPlaceDetail(placeId) {
  const { data } = await api.get(`/places/${placeId}`)
  return data.item
}

export async function fetchPlaceVersions(placeId) {
  const { data } = await api.get(`/places/${placeId}/versions`)
  return data
}

export async function fetchPlaceGraph(placeId) {
  const { data } = await api.get(`/places/${placeId}/graph`)
  return data
}

export async function fetchOwnPlaceOptions({
  limit = 5,
  cursor = 0,
  search = '',
  excludePlaceId = null,
} = {}) {
  const { data } = await api.get('/places/editor/own-places', {
    params: {
      limit,
      cursor,
      search,
      excludePlaceId,
    },
  })
  return data
}

export async function fetchOwnPlaceTrees({
  limit = 4,
  cursor = 0,
  search = '',
  placeId = null,
} = {}) {
  const { data } = await api.get('/places/editor/own-place-trees', {
    params: {
      limit,
      cursor,
      search,
      placeId,
    },
  })
  return data
}

export async function fetchPlaceEditor(placeId) {
  const { data } = await api.get(`/places/${placeId}/editor`)
  return data
}

export async function fetchPlaceCreationEditor() {
  const { data } = await api.get('/places/editor/new')
  return data
}

export async function createPlaceEditor(payload) {
  const { data } = await api.post('/places/editor', payload)
  return data.item
}

export async function savePlaceEditor(placeId, payload) {
  const { data } = await api.put(`/places/${placeId}/editor`, payload)
  return data.item
}

export async function deletePlace(placeId) {
  await api.delete(`/places/${placeId}`)
}

export async function signAndUploadPlaceImage({ file, campaignId, placeId }) {
  return signAndUploadManagedImage({
    file,
    entityType: 'lugar',
    campaignId: campaignId || null,
    tags: ['lugar', placeId || 'nuevo'],
    fallbackErrorMessage: 'No se pudo subir la imagen a Cloudinary.',
  })
}
