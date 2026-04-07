import { useCallback, useState } from 'react'
import {
  approveWithdrawal,
  denyWithdrawal,
  listPendingWithdrawals,
} from '../../api/withdrawals'
import { toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'
import type { WithdrawalRequest } from '../../types/domain'

interface UseWithdrawalsOptions {
  client: ApiClient
  showToast: (message: string, kind?: 'success' | 'error') => void
}

export function useWithdrawals({ client, showToast }: UseWithdrawalsOptions) {
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([])
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false)

  const fetchPendingWithdrawals = useCallback(async () => {
    setLoadingWithdrawals(true)
    try {
      const data = await listPendingWithdrawals(client)
      setPendingWithdrawals(data)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load withdrawals')
    } finally {
      setLoadingWithdrawals(false)
    }
  }, [client, showToast])

  const approve = useCallback(
    async (withdrawalId: number) => {
      try {
        await approveWithdrawal(client, withdrawalId)
        await fetchPendingWithdrawals()
        return true
      } catch (error) {
        toastApiError(showToast, error, 'Failed to approve withdrawal')
        return false
      }
    },
    [client, fetchPendingWithdrawals, showToast],
  )

  const deny = useCallback(
    async (withdrawalId: number, reason: string) => {
      try {
        await denyWithdrawal(client, withdrawalId, reason)
        await fetchPendingWithdrawals()
        return true
      } catch (error) {
        toastApiError(showToast, error, 'Failed to deny withdrawal')
        return false
      }
    },
    [client, fetchPendingWithdrawals, showToast],
  )

  return {
    pendingWithdrawals,
    loadingWithdrawals,
    fetchPendingWithdrawals,
    approve,
    deny,
  }
}
