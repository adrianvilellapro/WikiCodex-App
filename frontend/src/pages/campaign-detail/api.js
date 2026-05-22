import { signAndUploadManagedImage } from '../../lib/image-upload'
import { api } from '../../services/http'

export async function fetchCampaigns() {
  const { data } = await api.get('/campaigns')
  return data.items || []
}

export async function fetchCampaignDetail(campaignId) {
  const { data } = await api.get(`/campaigns/${campaignId}`)
  return data
}

export async function fetchCampaignUserOptions() {
  const { data } = await api.get('/campaigns/user-options')
  return data.items || []
}

export async function createCampaign(payload) {
  const { data } = await api.post('/campaigns', payload)
  return data.item
}

export async function updateCampaign(campaignId, payload) {
  const { data } = await api.patch(`/campaigns/${campaignId}`, payload)
  return data.item
}

export async function deleteCampaign(campaignId) {
  await api.delete(`/campaigns/${campaignId}`)
}

export async function addCampaignPlayer(campaignId, usuarioId) {
  const { data } = await api.post(`/campaigns/${campaignId}/players`, {
    usuarioId,
  })
  return data.item
}

export async function removeCampaignPlayer(campaignId, userId) {
  await api.delete(`/campaigns/${campaignId}/players/${userId}`)
}

export async function createCampaignNarrative(campaignId, path, payload) {
  const { data } = await api.post(`/campaigns/${campaignId}/${path}`, payload)
  return data.item
}

export async function updateCampaignNarrative(campaignId, path, id, payload) {
  const { data } = await api.patch(
    `/campaigns/${campaignId}/${path}/${id}`,
    payload
  )
  return data.item
}

export async function fetchCampaignSessionDetail(campaignId, sessionId) {
  const { data } = await api.get(
    `/campaigns/${campaignId}/sessions/${sessionId}/detail`
  )
  return data.item
}

export async function updateCampaignSessionDetail(
  campaignId,
  sessionId,
  payload
) {
  const { data } = await api.patch(
    `/campaigns/${campaignId}/sessions/${sessionId}/detail`,
    payload
  )
  return data.item
}

export async function deleteCampaignNarrative(campaignId, path, id) {
  await api.delete(`/campaigns/${campaignId}/${path}/${id}`)
}

export async function fetchCampaignCharacters(campaignId, options = {}) {
  const { limit = 10, cursor = null, q = '' } = options
  const { data } = await api.get(`/campaigns/${campaignId}/characters`, {
    params: { limit, cursor, q: q || undefined },
  })
  return data
}

export async function fetchCampaignObjects(campaignId, options = {}) {
  const { limit = 10, cursor = null } = options
  const { data } = await api.get(`/campaigns/${campaignId}/objects`, {
    params: { limit, cursor },
  })
  return data
}

export async function fetchCampaignPlaces(campaignId, options = {}) {
  const { limit = 10, cursor = null } = options
  const { data } = await api.get(`/campaigns/${campaignId}/places`, {
    params: { limit, cursor },
  })
  return data
}

export async function fetchCampaignSpells(campaignId, options = {}) {
  const { limit = 10, cursor = null, q = '' } = options
  const { data } = await api.get(`/campaigns/${campaignId}/spells`, {
    params: { limit, cursor, q: q || undefined },
  })
  return data
}

export async function fetchCampaignPowers(campaignId, options = {}) {
  const { limit = 10, cursor = null, q = '' } = options
  const { data } = await api.get(`/campaigns/${campaignId}/powers`, {
    params: { limit, cursor, q: q || undefined },
  })
  return data
}

export async function signAndUploadCampaignImage({
  file,
  campaignId = null,
  entityType = 'campana',
  tags = [],
}) {
  return signAndUploadManagedImage({
    file,
    entityType,
    campaignId: campaignId || null,
    tags: [entityType, campaignId || 'nuevo', ...tags],
    fallbackErrorMessage: 'No se pudo subir la imagen a Cloudinary.',
  })
}
