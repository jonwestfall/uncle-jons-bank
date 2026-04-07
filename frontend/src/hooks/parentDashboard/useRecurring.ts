import { useCallback, useState } from 'react'
import {
  createRecurringForChild,
  deleteRecurring,
  listChildRecurring,
} from '../../api/recurring'
import { toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'
import type { RecurringCharge } from '../../types/domain'

interface UseRecurringOptions {
  client: ApiClient
  showToast: (message: string, kind?: 'success' | 'error') => void
}

interface CreateRecurringInput {
  childId: number
  amount: number
  memo?: string | null
  interval_days: number
  next_run: string
  type: string
}

export function useRecurring({ client, showToast }: UseRecurringOptions) {
  const [charges, setCharges] = useState<RecurringCharge[]>([])

  const fetchCharges = useCallback(
    async (childId: number) => {
      try {
        const data = await listChildRecurring(client, childId)
        setCharges(data)
      } catch {
        setCharges([])
      }
    },
    [client],
  )

  const addCharge = useCallback(
    async (input: CreateRecurringInput) => {
      try {
        await createRecurringForChild(client, input.childId, {
          amount: input.amount,
          memo: input.memo,
          interval_days: input.interval_days,
          next_run: input.next_run,
          type: input.type,
        })
        await fetchCharges(input.childId)
        return true
      } catch (error) {
        toastApiError(showToast, error, 'Action failed')
        return false
      }
    },
    [client, fetchCharges, showToast],
  )

  const removeCharge = useCallback(
    async (chargeId: number, childId: number) => {
      try {
        await deleteRecurring(client, chargeId)
        await fetchCharges(childId)
      } catch (error) {
        toastApiError(showToast, error, 'Failed to delete charge')
      }
    },
    [client, fetchCharges, showToast],
  )

  const clearCharges = useCallback(() => {
    setCharges([])
  }, [])

  return {
    charges,
    fetchCharges,
    addCharge,
    removeCharge,
    clearCharges,
  }
}
