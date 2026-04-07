import { useCallback, useState } from 'react'
import { acceptCd, listChildCds, redeemCdEarly, rejectCd } from '../../api/cds'
import { toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'
import type { CdOffer } from '../../types/domain'

interface UseChildCdsOptions {
  client: ApiClient
  showToast: (message: string, kind?: 'success' | 'error') => void
}

export function useChildCds({ client, showToast }: UseChildCdsOptions) {
  const [cds, setCds] = useState<CdOffer[]>([])

  const fetchCds = useCallback(async () => {
    try {
      const data = await listChildCds(client)
      setCds(data)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load CD offers')
    }
  }, [client, showToast])

  const accept = useCallback(
    async (cdId: number) => {
      try {
        await acceptCd(client, cdId)
        await fetchCds()
        return true
      } catch (error) {
        toastApiError(showToast, error, 'Failed to accept CD')
        return false
      }
    },
    [client, fetchCds, showToast],
  )

  const reject = useCallback(
    async (cdId: number) => {
      try {
        await rejectCd(client, cdId)
        await fetchCds()
        return true
      } catch (error) {
        toastApiError(showToast, error, 'Failed to reject CD')
        return false
      }
    },
    [client, fetchCds, showToast],
  )

  const redeemEarly = useCallback(
    async (cdId: number) => {
      try {
        await redeemCdEarly(client, cdId)
        await fetchCds()
        return true
      } catch (error) {
        toastApiError(showToast, error, 'Failed to redeem CD early')
        return false
      }
    },
    [client, fetchCds, showToast],
  )

  return {
    cds,
    fetchCds,
    accept,
    reject,
    redeemEarly,
  }
}
