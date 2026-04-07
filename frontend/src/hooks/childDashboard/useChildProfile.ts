import { useCallback, useState } from 'react'
import { getChild } from '../../api/children'
import { toastApiError } from '../../utils/apiError'
import type { ApiClient } from '../../api/client'

interface UseChildProfileOptions {
  client: ApiClient
  childId: number
  showToast: (message: string, kind?: 'success' | 'error') => void
}

export function useChildProfile({ client, childId, showToast }: UseChildProfileOptions) {
  const [childName, setChildName] = useState('')

  const fetchChildName = useCallback(async () => {
    try {
      const data = await getChild(client, childId)
      setChildName(data.first_name)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load child profile')
    }
  }, [childId, client, showToast])

  return {
    childName,
    fetchChildName,
  }
}
