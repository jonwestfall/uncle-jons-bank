import { useCallback, useState } from 'react'
import { listMyRecurring } from '../../api/recurring'
import { toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'
import type { RecurringCharge } from '../../types/domain'

interface UseChildRecurringOptions {
  client: ApiClient
  showToast: (message: string, kind?: 'success' | 'error') => void
}

export function useChildRecurring({ client, showToast }: UseChildRecurringOptions) {
  const [charges, setCharges] = useState<RecurringCharge[]>([])

  const fetchCharges = useCallback(async () => {
    try {
      const data = await listMyRecurring(client)
      setCharges(data)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load recurring charges')
    }
  }, [client, showToast])

  return {
    charges,
    fetchCharges,
  }
}
