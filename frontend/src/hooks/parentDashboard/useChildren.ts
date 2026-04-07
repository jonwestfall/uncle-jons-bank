import { useCallback, useState } from 'react'
import {
  createChild,
  freezeChild,
  listChildren,
  unfreezeChild,
  type ChildApi,
} from '../../api/children'
import { getChildLedger } from '../../api/transactions'
import { mapApiErrorMessage, toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'
import type { ChildAccount } from '../../types/domain'

interface UseChildrenOptions {
  client: ApiClient
  showToast: (message: string, kind?: 'success' | 'error') => void
}

export function useChildren({ client, showToast }: UseChildrenOptions) {
  const [children, setChildren] = useState<ChildAccount[]>([])
  const [loadingChildren, setLoadingChildren] = useState(false)
  const [addChildError, setAddChildError] = useState<string | null>(null)

  const fetchChildren = useCallback(async () => {
    setLoadingChildren(true)
    try {
      const data = await listChildren(client)
      const enriched = await Promise.all(
        data.map(async (c: ChildApi) => {
          let balance: number | undefined
          let lastActivity: string | undefined
          try {
            const ledger = await getChildLedger(client, c.id)
            balance = ledger.balance
            lastActivity = ledger.transactions[0]?.timestamp
          } catch {
            // Some children may have no ledger yet.
          }
          return {
            id: c.id,
            first_name: c.first_name,
            frozen: c.frozen ?? c.account_frozen ?? false,
            interest_rate: c.interest_rate,
            penalty_interest_rate: c.penalty_interest_rate,
            cd_penalty_rate: c.cd_penalty_rate,
            total_interest_earned: c.total_interest_earned,
            balance,
            last_activity: lastActivity,
          } as ChildAccount
        }),
      )
      setChildren(enriched)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load children')
    } finally {
      setLoadingChildren(false)
    }
  }, [client, showToast])

  const addChild = useCallback(
    async (firstName: string, accessCode: string) => {
      setAddChildError(null)
      try {
        await createChild(client, { first_name: firstName, access_code: accessCode })
        await fetchChildren()
        return true
      } catch (error) {
        setAddChildError(mapApiErrorMessage(error, 'Failed to add child. Please try again.'))
        return false
      }
    },
    [client, fetchChildren],
  )

  const toggleFreeze = useCallback(
    async (childId: number, frozen: boolean) => {
      try {
        if (frozen) {
          await unfreezeChild(client, childId)
        } else {
          await freezeChild(client, childId)
        }
        await fetchChildren()
      } catch (error) {
        toastApiError(showToast, error, 'Action failed')
      }
    },
    [client, fetchChildren, showToast],
  )

  const getChildName = useCallback(
    (childId: number) => children.find((child) => child.id === childId)?.first_name ?? `Child ${childId}`,
    [children],
  )

  return {
    children,
    loadingChildren,
    addChildError,
    fetchChildren,
    addChild,
    toggleFreeze,
    getChildName,
  }
}
