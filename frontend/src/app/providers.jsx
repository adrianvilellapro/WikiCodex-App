import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '../features/auth/auth-context'
import { ThemeProvider } from '../features/theme/theme-context'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
})

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
