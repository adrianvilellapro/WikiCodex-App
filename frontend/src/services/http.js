import axios from 'axios'

import { createDemoAdapter } from '../demo/demo-api'
import { isDemoMode } from '../demo/config'
import { getStoredToken } from './auth-storage'

const baseURL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL,
  withCredentials: true,
  ...(isDemoMode ? { adapter: createDemoAdapter() } : {}),
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})
