import type { ApiClient } from './client'

export interface ChildApi {
  id: number
  first_name: string
  account_frozen?: boolean
  frozen?: boolean
  interest_rate?: number
  penalty_interest_rate?: number
  cd_penalty_rate?: number
  total_interest_earned?: number
}

export interface ChildParentInfo {
  user_id: number
  name: string
  email: string
  permissions: string[]
  is_owner: boolean
}

export interface ShareCodeResponse {
  code: string
}

export interface ChildSummary {
  id: number
  first_name: string
}

export const listChildren = (client: ApiClient) =>
  client.get<ChildSummary[]>('/children/')

export const createChild = (client: ApiClient, payload: { first_name: string; access_code: string }) =>
  client.post<ChildSummary>('/children/', payload)

export const getChild = (client: ApiClient, childId: number) =>
  client.get<ChildApi>(`/children/${childId}`)

export const freezeChild = (client: ApiClient, childId: number) =>
  client.post<null>(`/children/${childId}/freeze`)

export const unfreezeChild = (client: ApiClient, childId: number) =>
  client.post<null>(`/children/${childId}/unfreeze`)

export const getChildParents = (client: ApiClient, childId: number) =>
  client.get<ChildParentInfo[]>(`/children/${childId}/parents`)

export const removeChildParentAccess = (client: ApiClient, childId: number, parentId: number) =>
  client.delete<null>(`/children/${childId}/parents/${parentId}`)

export const createChildShareCode = (client: ApiClient, childId: number, permissions: string[]) =>
  client.post<ShareCodeResponse>(`/children/${childId}/sharecode`, { permissions })

export const redeemShareCode = (client: ApiClient, code: string) =>
  client.post<null>(`/children/sharecode/${code}`)

export const updateChildAccessCode = (client: ApiClient, childId: number, accessCode: string) =>
  client.put<null>(`/children/${childId}/access-code`, { access_code: accessCode })

export const getMyParents = (client: ApiClient) =>
  client.get<Array<{ user_id: number; name: string }>>('/children/me/parents')
