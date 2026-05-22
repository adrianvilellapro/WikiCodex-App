/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
} from 'react'

import { api } from '../../services/http'
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '../../services/auth-storage'
import { demoData } from '../../demo/demo-data'
import { demoToken, isDemoMode } from '../../demo/config'
import { normalizeApiError } from './auth-errors'

const AuthContext = createContext(null)
const DEMO_USER_STORAGE_KEY = 'wikicodex:demo:user'

function getInitialDemoUser() {
  if (!isDemoMode || typeof window === 'undefined') {
    return demoData.demoUser
  }

  try {
    const stored = window.localStorage.getItem(DEMO_USER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : demoData.demoUser
  } catch {
    return demoData.demoUser
  }
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(isDemoMode ? 'authenticated' : 'booting')
  const [user, setUser] = useState(() =>
    isDemoMode ? getInitialDemoUser() : null
  )
  const [token, setToken] = useState(() =>
    isDemoMode ? demoToken : getStoredToken()
  )
  const isAdmin = user?.rol?.codigo === 'administrador'

  useEffect(() => {
    if (isDemoMode) {
      return undefined
    }

    let isMounted = true

    async function bootstrapAuth() {
      if (!token) {
        startTransition(() => {
          if (isMounted) {
            setStatus('unauthenticated')
          }
        })
        return
      }

      try {
        const { data } = await api.get('/users/me')

        if (!isMounted) {
          return
        }

        startTransition(() => {
          setUser(data.usuario)
          setStatus('authenticated')
        })
      } catch {
        clearStoredToken()

        if (!isMounted) {
          return
        }

        startTransition(() => {
          setToken(null)
          setUser(null)
          setStatus('unauthenticated')
        })
      }
    }

    bootstrapAuth()

    return () => {
      isMounted = false
    }
  }, [token])

  useEffect(() => {
    if (isDemoMode) {
      return undefined
    }

    if (status !== 'authenticated' || !isAdmin || !token) {
      return undefined
    }

    let isMounted = true

    async function rotateAdminSession() {
      try {
        const { data } = await api.post('/auth/admin-session/rotate')

        if (!isMounted) {
          return
        }

        setStoredToken(data.token, { sessionOnly: true })
        startTransition(() => {
          setToken(data.token)
          setUser(data.usuario)
          setStatus('authenticated')
        })
      } catch {
        clearStoredToken()

        if (!isMounted) {
          return
        }

        startTransition(() => {
          setToken(null)
          setUser(null)
          setStatus('unauthenticated')
        })
      }
    }

    const intervalId = window.setInterval(rotateAdminSession, 2 * 60 * 1000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [isAdmin, status, token])

  async function login(credentials, options = {}) {
    const { data } = await api.post('/auth/login', credentials)
    const loginIsAdmin = data.usuario?.rol?.codigo === 'administrador'

    setStoredToken(data.token, {
      persist: Boolean(options.persist) && !loginIsAdmin,
      sessionOnly: loginIsAdmin,
    })
    startTransition(() => {
      setToken(data.token)
      setUser(data.usuario)
      setStatus('authenticated')
    })

    return data
  }

  async function register(payload, options = {}) {
    const { data } = await api.post('/auth/register', payload)

    setStoredToken(data.token, { persist: Boolean(options.persist) })
    startTransition(() => {
      setToken(data.token)
      setUser(data.usuario)
      setStatus('authenticated')
    })

    return data
  }

  async function refreshUser() {
    const { data } = await api.get('/users/me')

    startTransition(() => {
      setUser(data.usuario)
      setStatus('authenticated')
    })

    return data.usuario
  }

  async function updateProfile(payload) {
    const { data } = await api.patch('/users/me', payload)

    startTransition(() => {
      setUser(data.usuario)
      setStatus('authenticated')
    })

    return data.usuario
  }

  async function changePassword(payload) {
    const { data } = await api.patch('/users/me/password', payload)
    return data
  }

  async function logout() {
    if (isDemoMode) {
      startTransition(() => {
        setToken(demoToken)
        setUser((current) => current || demoData.demoUser)
        setStatus('authenticated')
      })
      return
    }

    try {
      if (token) {
        await api.post('/auth/logout')
      }
    } catch {
      // El cierre local debe completarse aunque el token ya haya expirado.
    }

    clearStoredToken()
    startTransition(() => {
      setToken(null)
      setUser(null)
      setStatus('unauthenticated')
    })
  }

  const value = {
    user,
    token,
    status,
    isBooting: status === 'booting',
    isAuthenticated: status === 'authenticated',
    isAdmin: user?.rol?.codigo === 'administrador',
    login,
    register,
    refreshUser,
    updateProfile,
    changePassword,
    logout,
    normalizeApiError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.')
  }

  return context
}
