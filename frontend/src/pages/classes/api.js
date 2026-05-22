import { api } from '../../services/http'

function buildCampaignFilterParam(campaignIds) {
  if (!Array.isArray(campaignIds)) {
    return undefined
  }

  return campaignIds.length ? campaignIds.join(',') : '__none'
}

function buildClassParams(options = {}) {
  const { filters = {}, limit = 200 } = options

  return {
    limit,
    q: filters.q?.trim() || undefined,
    idioma: filters.idioma || undefined,
    sort: filters.sort || undefined,
    ediciones: Array.isArray(filters.ediciones)
      ? filters.ediciones.length
        ? filters.ediciones.join(',')
        : 'none'
      : undefined,
    campaignIds: buildCampaignFilterParam(filters.campaignIds),
  }
}

export async function fetchClasses(options = {}) {
  const { data } = await api.get('/classes', {
    params: buildClassParams(options),
  })
  return data
}

export async function fetchClassDetail(classId) {
  const { data } = await api.get(`/classes/${classId}`)
  return data
}

export async function fetchSubclassDetail(classId, subclassId) {
  const { data } = await api.get(`/classes/${classId}/subclases/${subclassId}`)
  return data
}

export async function fetchClassOptions() {
  const { data } = await api.get('/classes/options')
  return data
}

export async function createClass(payload) {
  const { data } = await api.post('/classes', payload)
  return data
}

export async function updateClass(classId, payload) {
  const { data } = await api.patch(`/classes/${classId}`, payload)
  return data
}

export async function deleteClass(classId) {
  const { data } = await api.delete(`/classes/${classId}`)
  return data
}
