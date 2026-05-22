import { api } from './http'

export async function createSavedTrait(payload) {
  const { data } = await api.post('/users/me/saved-traits', payload)
  return data.item
}

export async function createSavedTraitsBulk(traits) {
  const { data } = await api.post('/users/me/saved-traits/bulk', {
    traits,
  })
  return data
}

export async function removeSavedTraitsSource(payload) {
  const { data } = await api.post(
    '/users/me/saved-traits/remove-source',
    payload
  )
  return data
}
