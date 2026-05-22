import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../features/auth/auth-context'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="panel-strong flex w-full max-w-md flex-col items-center gap-4 px-8 py-10 text-center">
        <span className="h-3 w-3 animate-pulse rounded-full bg-brand" />
        <p className="font-medium text-ink">
          Cargando tu archivo de cronicas...
        </p>
        <p className="text-sm text-ink-muted">
          Estamos recuperando tu sesion de WikiCodex.
        </p>
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  const { isBooting, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isBooting) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <Outlet />
}

export function GuestOnlyRoute() {
  const { isBooting, isAuthenticated } = useAuth()

  if (isBooting) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}

export function RoleRoute({ allowedRoles }) {
  const { isBooting, isAuthenticated, user } = useAuth()

  if (isBooting) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (!allowedRoles.includes(user?.rol?.codigo)) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
