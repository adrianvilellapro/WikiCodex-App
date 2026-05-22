import { api } from '../../services/http'

export async function fetchSpells(params = {}) {
  const { data } = await api.get('/spells', { params })
  return data
}

export async function fetchSpellDetail(spellId) {
  const { data } = await api.get(`/spells/${spellId}`)
  return data
}

export async function fetchSpellOptions() {
  const { data } = await api.get('/spells/options')
  return data
}

export async function createSpell(payload) {
  const { data } = await api.post('/spells', payload)
  return data
}

export async function updateSpell(spellId, payload) {
  const { data } = await api.patch(`/spells/${spellId}`, payload)
  return data
}

export async function deleteSpell(spellId) {
  const { data } = await api.delete(`/spells/${spellId}`)
  return data
}

export async function setSpellSaved(spellId, guardado) {
  const { data } = await api.put(`/spells/${spellId}/saved`, { guardado })
  return data
}

export async function bulkSaveSpells(filters, guardado = true) {
  const { data } = await api.post('/spells/bulk-save', {
    ...filters,
    guardado,
  })
  return data
}
