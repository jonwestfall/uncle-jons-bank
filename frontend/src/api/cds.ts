import type { ApiClient } from './client'

export interface CdOffer {
  id: number
  amount: number
  interest_rate: number
  term_days: number
  status: string
  matures_at?: string | null
}

export interface CreateCdPayload {
  child_id: number
  amount: number
  interest_rate: number
  term_days: number
}

export const listChildCds = (client: ApiClient) =>
  client.get<CdOffer[]>('/cds/child')

export const createCdOffer = (client: ApiClient, payload: CreateCdPayload) =>
  client.post<null>('/cds/', payload)

export const redeemCdEarly = (client: ApiClient, cdId: number) =>
  client.post<null>(`/cds/${cdId}/redeem-early`)

export const acceptCd = (client: ApiClient, cdId: number) =>
  client.post<null>(`/cds/${cdId}/accept`)

export const rejectCd = (client: ApiClient, cdId: number) =>
  client.post<null>(`/cds/${cdId}/reject`)
