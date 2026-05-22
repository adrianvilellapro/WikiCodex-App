import { api } from '../../services/http'

export async function fetchPublicProfile(userId) {
  const { data } = await api.get(`/users/${userId}/public-profile`)
  return data
}

export async function fetchPublicProfileCharacters(userId, params = {}) {
  const { data } = await api.get(`/users/${userId}/public-profile/characters`, {
    params,
  })
  return data
}

export async function fetchPublicProfileObjects(userId, params = {}) {
  const { data } = await api.get(`/users/${userId}/public-profile/objects`, {
    params,
  })
  return data
}

export async function fetchPublicProfilePlaces(userId, params = {}) {
  const { data } = await api.get(`/users/${userId}/public-profile/places`, {
    params,
  })
  return data
}

export async function fetchPublicProfileSpells(userId, params = {}) {
  const { data } = await api.get(`/users/${userId}/public-profile/spells`, {
    params,
  })
  return data
}

export async function fetchPublicProfilePowers(userId, params = {}) {
  const { data } = await api.get(`/users/${userId}/public-profile/powers`, {
    params,
  })
  return data
}

export async function fetchMyPublicProfileEditor() {
  const { data } = await api.get('/users/me/public-profile/editor')
  return data
}

export async function saveMyPublicProfile(payload) {
  const { data } = await api.patch('/users/me/public-profile', payload)
  return data.item
}
