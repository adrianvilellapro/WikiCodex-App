import { api } from '../../services/http'
import { signAndUploadManagedImage } from '../../lib/image-upload'

export async function fetchCharacterDetail(characterId) {
  const { data } = await api.get(`/characters/${characterId}`)
  return data.item
}

export async function fetchCharacterVersions(characterId) {
  const { data } = await api.get(`/characters/${characterId}/versions`)
  return data
}

export async function fetchCharacterEditor(characterId) {
  const { data } = await api.get(`/characters/${characterId}/editor`)
  return data
}

export async function fetchCharacterCreationEditor() {
  const { data } = await api.get('/characters/editor/new')
  return data
}

export async function saveCharacterEditor(characterId, payload) {
  const { data } = await api.put(`/characters/${characterId}/editor`, payload)
  return data.item
}

export async function createCharacterEditor(payload) {
  const { data } = await api.post('/characters/editor', payload)
  return data.item
}

export async function searchLinkableCharacterObjects(query, limit = 20) {
  const { data } = await api.get('/characters/editor/linkable-objects', {
    params: { q: query || '', limit },
  })
  return data.items || []
}

export async function searchLinkableCharacterPowers(query, limit = 20) {
  const { data } = await api.get('/characters/editor/linkable-powers', {
    params: { q: query || '', limit },
  })
  return data.items || []
}

export async function updateCharacterObjectTraitDisplay(
  characterId,
  objectId,
  mostrarRasgosEnFicha
) {
  const { data } = await api.patch(
    `/characters/${characterId}/linked-objects/${objectId}/display`,
    { mostrarRasgosEnFicha }
  )
  return data.item
}

export async function deleteSavedTrait(traitId) {
  await api.delete(`/characters/saved-traits/${traitId}`)
}

export async function deleteCharacter(characterId) {
  await api.delete(`/characters/${characterId}`)
}

export async function signAndUploadImage({
  file,
  campaignId,
  characterId,
  entityType,
}) {
  return signAndUploadManagedImage({
    file,
    entityType,
    campaignId: campaignId || null,
    tags: ['personaje', characterId],
    fallbackErrorMessage: 'No se pudo subir la imagen a Cloudinary.',
  })
}
