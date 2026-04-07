import type { ApiClient } from './client'

export interface Chore {
  id: number
  description: string
  amount: number
  status: string
  interval_days?: number | null
}

export const listMyChores = (client: ApiClient) =>
  client.get<Chore[]>('/chores/mine')

export const listChildChores = (client: ApiClient, childId: number) =>
  client.get<Chore[]>(`/chores/child/${childId}`)

export const proposeChore = (client: ApiClient, payload: { description: string; amount: number }) =>
  client.post<Chore>('/chores/propose', payload)

export const createChildChore = (
  client: ApiClient,
  childId: number,
  payload: { description: string; amount: number; interval_days: number | null },
) => client.post<Chore>(`/chores/child/${childId}`, payload)

export const completeChore = (client: ApiClient, choreId: number) =>
  client.post<null>(`/chores/${choreId}/complete`)

export const approveChore = (client: ApiClient, choreId: number) =>
  client.post<null>(`/chores/${choreId}/approve`)

export const rejectChore = (client: ApiClient, choreId: number) =>
  client.post<null>(`/chores/${choreId}/reject`)

export const deleteChore = (client: ApiClient, choreId: number) =>
  client.delete<null>(`/chores/${choreId}`)
