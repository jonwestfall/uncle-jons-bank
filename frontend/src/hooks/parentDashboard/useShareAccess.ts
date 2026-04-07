import { useCallback, useState } from 'react'
import {
  createChildShareCode,
  getChildParents,
  redeemShareCode,
  removeChildParentAccess,
  updateChildAccessCode,
} from '../../api/children'
import { toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'
import type { ChildAccount, ChildParentInfo } from '../../types/domain'

interface UseShareAccessOptions {
  client: ApiClient
  showToast: (message: string, kind?: 'success' | 'error') => void
}

export function useShareAccess({ client, showToast }: UseShareAccessOptions) {
  const [codeChild, setCodeChild] = useState<ChildAccount | null>(null)
  const [sharingChild, setSharingChild] = useState<ChildAccount | null>(null)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [accessChild, setAccessChild] = useState<ChildAccount | null>(null)
  const [accessParents, setAccessParents] = useState<ChildParentInfo[]>([])

  const openAccess = useCallback(
    async (child: ChildAccount) => {
      try {
        const data = await getChildParents(client, child.id)
        setAccessParents(data)
        setAccessChild(child)
      } catch (error) {
        toastApiError(showToast, error, 'Failed to load access')
      }
    },
    [client, showToast],
  )

  const removeAccess = useCallback(
    async (parentId: number) => {
      if (!accessChild) {
        return
      }
      try {
        await removeChildParentAccess(client, accessChild.id, parentId)
        await openAccess(accessChild)
      } catch (error) {
        toastApiError(showToast, error, 'Failed to remove access')
      }
    },
    [accessChild, client, openAccess, showToast],
  )

  const createShareCode = useCallback(
    async (permissions: string[]) => {
      if (!sharingChild) {
        return
      }
      try {
        const data = await createChildShareCode(client, sharingChild.id, permissions)
        showToast(`Share code: ${data.code}`)
      } catch (error) {
        toastApiError(showToast, error, 'Failed to generate code')
      } finally {
        setSharingChild(null)
      }
    },
    [client, sharingChild, showToast],
  )

  const redeemCode = useCallback(
    async (value: string) => {
      try {
        await redeemShareCode(client, value)
        showToast('Child linked')
        return true
      } catch (error) {
        toastApiError(showToast, error, 'Invalid code')
        return false
      } finally {
        setRedeemOpen(false)
      }
    },
    [client, showToast],
  )

  const updateCode = useCallback(
    async (child: ChildAccount, value: string) => {
      try {
        await updateChildAccessCode(client, child.id, value)
        showToast('Access code updated')
      } catch (error) {
        toastApiError(showToast, error, 'Failed to update access code')
      } finally {
        setCodeChild(null)
      }
    },
    [client, showToast],
  )

  return {
    codeChild,
    setCodeChild,
    sharingChild,
    setSharingChild,
    redeemOpen,
    setRedeemOpen,
    accessChild,
    setAccessChild,
    accessParents,
    openAccess,
    removeAccess,
    createShareCode,
    redeemCode,
    updateCode,
  }
}
