import { useCallback, useState } from 'react'
import {
  cancelWithdrawal,
  createWithdrawal,
  listMyWithdrawals,
} from '../../api/withdrawals'
import { toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'
import type { WithdrawalRequest } from '../../types/domain'

interface UseChildWithdrawalsOptions {
  client: ApiClient
  showToast: (message: string, kind?: 'success' | 'error') => void
}

export function useChildWithdrawals({ client, showToast }: UseChildWithdrawalsOptions) {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])

  const fetchWithdrawals = useCallback(async () => {
    try {
      const data = await listMyWithdrawals(client)
      setWithdrawals(data)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load withdrawals')
    }
  }, [client, showToast])

  const requestWithdrawal = useCallback(
    async (amount: number, memo?: string | null) => {
      try {
        await createWithdrawal(client, { amount, memo })
        showToast('Withdrawal requested')
        await fetchWithdrawals()
        return true
      } catch (error) {
        toastApiError(showToast, error, 'Failed to send request')
        return false
      }
    },
    [client, fetchWithdrawals, showToast],
  )

  const cancelRequest = useCallback(
    async (withdrawalId: number) => {
      try {
        await cancelWithdrawal(client, withdrawalId)
        showToast('Withdrawal cancelled')
        await fetchWithdrawals()
      } catch (error) {
        toastApiError(showToast, error, 'Failed to cancel')
      }
    },
    [client, fetchWithdrawals, showToast],
  )

  return {
    withdrawals,
    fetchWithdrawals,
    requestWithdrawal,
    cancelRequest,
  }
}
