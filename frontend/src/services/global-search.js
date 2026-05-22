import { api } from './http'

export async function fetchGlobalSearch({ query, limit = 6, signal }) {
  const { data } = await api.get('/search', {
    params: {
      q: query,
      limit,
    },
    signal,
  })

  return data
}
