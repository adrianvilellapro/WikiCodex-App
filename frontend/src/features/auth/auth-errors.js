export function normalizeApiError(error, fallbackMessage) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.details?.body?.[0] ||
    fallbackMessage
  )
}
