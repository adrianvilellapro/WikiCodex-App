import { api } from '../../services/http'
import { signAndUploadManagedImage } from '../../lib/image-upload'

function toOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return undefined
  }

  const parsed = Number(String(value).trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

function buildCampaignFilterParam(campaignIds) {
  if (!Array.isArray(campaignIds)) {
    return undefined
  }

  return campaignIds.length ? campaignIds.join(',') : '__none'
}

function buildObjectArchiveParams({
  view,
  filters,
  limit = 100,
  cursor = null,
} = {}) {
  if (!filters) {
    return { limit, cursor }
  }

  return {
    view,
    limit,
    cursor: cursor || undefined,
    q: filters.q?.trim() || undefined,
    matchMode: filters.matchMode,
    sort: filters.sort,
    tierIds:
      view !== 'tierlist' && filters.tierIds?.length
        ? filters.tierIds.join(',')
        : undefined,
    campaignIds: buildCampaignFilterParam(filters.campaignIds),
    tipoMagicoCodigos: filters.tipoMagicoCodigos?.length
      ? filters.tipoMagicoCodigos.join(',')
      : undefined,
    modifierTypeCodes: filters.modifierTypeCodes?.length
      ? filters.modifierTypeCodes.join(',')
      : undefined,
    modifierMin: toOptionalNumber(filters.modifierMin),
    modifierMax: toOptionalNumber(filters.modifierMax),
  }
}

export async function fetchObjects(options = {}) {
  const { data } = await api.get('/objects', {
    params: buildObjectArchiveParams(options),
  })
  return data
}

export async function fetchObjectArchiveOptions() {
  const { data } = await api.get('/objects/archive/options')
  return data
}

export async function fetchObjectItems(options = {}) {
  const data = await fetchObjects(options)
  return data.items || []
}

export async function fetchObjectDetail(objectId) {
  const { data } = await api.get(`/objects/${objectId}`)
  return data.item
}

export async function fetchObjectVersions(objectId) {
  const { data } = await api.get(`/objects/${objectId}/versions`)
  return data
}

export async function fetchObjectEditor(objectId) {
  const { data } = await api.get(`/objects/${objectId}/editor`)
  return data
}

export async function fetchObjectCreationEditor() {
  const { data } = await api.get('/objects/editor/new')
  return data
}

export async function createObjectEditor(payload) {
  const { data } = await api.post('/objects/editor', payload)
  return data.item
}

export async function saveObjectEditor(objectId, payload) {
  const { data } = await api.put(`/objects/${objectId}/editor`, payload)
  return data.item
}

export async function deleteObject(objectId) {
  await api.delete(`/objects/${objectId}`)
}

export async function signAndUploadObjectImage({ file, campaignId, objectId }) {
  return signAndUploadManagedImage({
    file,
    entityType: 'objeto',
    campaignId: campaignId || null,
    tags: ['objeto', objectId || 'nuevo'],
    fallbackErrorMessage: 'No se pudo subir la imagen a Cloudinary.',
  })
}
