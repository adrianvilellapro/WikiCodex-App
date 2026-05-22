import { api } from '../../services/http'

function buildFeatParams(options = {}) {
  const { filters = {}, limit = 200 } = options

  return {
    limit,
    q: filters.q?.trim() || undefined,
    idioma: filters.idioma || undefined,
    fuentes: filters.fuentes?.length ? filters.fuentes.join(',') : undefined,
    ediciones: Object.prototype.hasOwnProperty.call(filters, 'ediciones')
      ? filters.ediciones?.length
        ? filters.ediciones.join(',')
        : 'none'
      : undefined,
    sort: filters.sort || undefined,
  }
}

export async function fetchFeats(options = {}) {
  const { data } = await api.get('/feats', {
    params: buildFeatParams(options),
  })
  return data
}

export async function fetchFeatDetail(featId) {
  const { data } = await api.get(`/feats/${featId}`)
  return data
}

export async function fetchFeatOptions() {
  const { data } = await api.get('/feats/options')
  return data
}

export async function createFeat(payload) {
  const { data } = await api.post('/feats', payload)
  return data
}

export async function updateFeat(featId, payload) {
  const { data } = await api.patch(`/feats/${featId}`, payload)
  return data
}

export async function deleteFeat(featId) {
  const { data } = await api.delete(`/feats/${featId}`)
  return data
}
