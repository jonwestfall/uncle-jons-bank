import type { ApiClient } from './client'
import type { RecurringCharge } from '../types/domain'
export type { RecurringCharge }

export interface CreateRecurringPayload {
  amount: number
  memo?: string | null
  interval_days: number
  next_run: string
  type: string
}

export const listChildRecurring = (client: ApiClient, childId: number) =>
  client.get<RecurringCharge[]>(`/recurring/child/${childId}`)

export const listMyRecurring = (client: ApiClient) =>
  client.get<RecurringCharge[]>('/recurring/mine')

export const createRecurringForChild = (client: ApiClient, childId: number, payload: CreateRecurringPayload) =>
  client.post<RecurringCharge>(`/recurring/child/${childId}`, payload)

export const deleteRecurring = (client: ApiClient, recurringId: number) =>
  client.delete<null>(`/recurring/${recurringId}`)
