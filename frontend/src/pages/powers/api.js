import { signAndUploadManagedImage } from '../../lib/image-upload'
import { api } from '../../services/http'

function buildCampaignFilterParam(campaignIds) {
  if (!Array.isArray(campaignIds)) {
    return undefined
  }

  return campaignIds.length ? campaignIds.join(',') : '__none'
}

function buildPowerArchiveParams(options = {}) {
  if (!options.filters) {
    return options
  }

  const { filters, limit = 100, cursor = null } = options

  return {
    limit,
    cursor: cursor || undefined,
    q: filters.q?.trim() || undefined,
    matchMode: filters.matchMode,
    sort: filters.sort,
    categoryIds: filters.categoryIds?.length
      ? filters.categoryIds.join(',')
      : undefined,
    campaignIds: buildCampaignFilterParam(filters.campaignIds),
  }
}

export async function fetchPowers(options = {}) {
  const { data } = await api.get('/powers', {
    params: buildPowerArchiveParams(options),
  })
  return data
}

export async function fetchPowerDetail(powerId) {
  const { data } = await api.get(`/powers/${powerId}`)
  return data
}

export async function fetchPowerOptions() {
  const { data } = await api.get('/powers/options')
  return data
}

export async function createPower(payload) {
  const { data } = await api.post('/powers', payload)
  return data
}

export async function updatePower(powerId, payload) {
  const { data } = await api.patch(`/powers/${powerId}`, payload)
  return data
}

export async function deletePower(powerId) {
  const { data } = await api.delete(`/powers/${powerId}`)
  return data
}

export async function signAndUploadPowerImage({ file, powerId = 'nuevo' }) {
  return signAndUploadManagedImage({
    file,
    entityType: 'poder',
    campaignId: null,
    tags: ['poder', powerId],
    fallbackErrorMessage: 'No se pudo subir la imagen del poder.',
  })
}
