import { isApiClientError } from '../api/client'

const byStatus: Record<number, string> = {
  400: 'Please check your input and try again.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to do that.',
  404: 'That item was not found.',
  409: 'That action conflicts with existing data.',
  422: 'Please correct the highlighted fields and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Server error. Please try again in a moment.',
  502: 'Server is temporarily unavailable. Please try again.',
  503: 'Service is unavailable right now. Please try again.',
}

export const mapApiErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.') => {
  if (isApiClientError(error)) {
    if (error.message && !error.message.startsWith('Request failed')) {
      return error.message
    }
    return byStatus[error.status] ?? fallback
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

export const toastApiError = (
  showToast: (message: string, type?: 'error' | 'success') => void,
  error: unknown,
  fallback?: string,
) => {
  showToast(mapApiErrorMessage(error, fallback), 'error')
}
