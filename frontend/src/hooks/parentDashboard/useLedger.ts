import { useCallback, useState } from 'react'
import { createTransaction, deleteTransaction, getChildLedger } from '../../api/transactions'
import { toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'
import type { LedgerResponse } from '../../types/domain'

interface UseLedgerOptions {
  client: ApiClient
  showToast: (message: string, kind?: 'success' | 'error') => void
}

interface AddTransactionInput {
  childId: number
  type: string
  amount: number
  memo?: string | null
}

export function useLedger({ client, showToast }: UseLedgerOptions) {
  const [ledger, setLedger] = useState<LedgerResponse | null>(null)
  const [selectedChild, setSelectedChild] = useState<number | null>(null)

  const fetchLedger = useCallback(
    async (childId: number) => {
      try {
        const data = await getChildLedger(client, childId)
        setLedger(data)
      } catch (error) {
        toastApiError(showToast, error, 'Failed to load ledger')
      }
    },
    [client, showToast],
  )

  const openLedger = useCallback(
    async (childId: number) => {
      setSelectedChild(childId)
      await fetchLedger(childId)
    },
    [fetchLedger],
  )

  const closeLedger = useCallback(() => {
    setLedger(null)
    setSelectedChild(null)
  }, [])

  const addTransaction = useCallback(
    async ({ childId, type, amount, memo }: AddTransactionInput) => {
      try {
        await createTransaction(client, {
          child_id: childId,
          type,
          amount,
          memo,
          initiated_by: 'parent',
          initiator_id: 0,
        })
        await fetchLedger(childId)
        return true
      } catch (error) {
        toastApiError(showToast, error, 'Action failed')
        return false
      }
    },
    [client, fetchLedger, showToast],
  )

  const removeTransaction = useCallback(
    async (transactionId: number, childId: number) => {
      try {
        await deleteTransaction(client, transactionId)
        await fetchLedger(childId)
      } catch (error) {
        toastApiError(showToast, error, 'Failed to delete transaction')
      }
    },
    [client, fetchLedger, showToast],
  )

  return {
    ledger,
    selectedChild,
    fetchLedger,
    openLedger,
    closeLedger,
    addTransaction,
    removeTransaction,
  }
}
