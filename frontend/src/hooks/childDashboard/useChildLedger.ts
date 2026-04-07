import { useCallback, useState } from 'react'
import { getChildLedger } from '../../api/transactions'
import { toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'
import type { LedgerResponse } from '../../types/domain'

interface UseChildLedgerOptions {
  client: ApiClient
  childId: number
  showToast: (message: string, kind?: 'success' | 'error') => void
}

export function useChildLedger({ client, childId, showToast }: UseChildLedgerOptions) {
  const [ledger, setLedger] = useState<LedgerResponse | null>(null)
  const [loadingLedger, setLoadingLedger] = useState(false)

  const fetchLedger = useCallback(async () => {
    setLoadingLedger(true)
    try {
      const data = await getChildLedger(client, childId)
      setLedger(data)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load ledger')
    } finally {
      setLoadingLedger(false)
    }
  }, [childId, client, showToast])

  return {
    ledger,
    loadingLedger,
    fetchLedger,
  }
}
