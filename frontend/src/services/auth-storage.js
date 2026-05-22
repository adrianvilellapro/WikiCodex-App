const AUTH_STORAGE_KEY = 'wikicodex.auth.token'
const AUTH_SESSION_CACHE_KEY = 'wikicodex.auth.session-token'

export function getStoredToken() {
  return (
    window.sessionStorage.getItem(AUTH_STORAGE_KEY) ||
    window.localStorage.getItem(AUTH_SESSION_CACHE_KEY) ||
    window.localStorage.getItem(AUTH_STORAGE_KEY)
  )
}

export function setStoredToken(
  token,
  { persist = false, sessionOnly = false } = {}
) {
  clearStoredToken()

  if (sessionOnly) {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, token)
    return
  }

  if (persist) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, token)
    return
  }

  window.sessionStorage.setItem(AUTH_STORAGE_KEY, token)
  window.localStorage.setItem(AUTH_SESSION_CACHE_KEY, token)
}

export function clearStoredToken() {
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_SESSION_CACHE_KEY)
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}
