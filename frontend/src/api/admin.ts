import type { Transaction } from '../types/domain'
import type { ApiClient } from './client'

export interface AdminUser {
  id: number
  name: string
  email: string
  role: string
  status: string
}

export interface AdminChild {
  id: number
  first_name: string
  account_frozen: boolean
  access_code?: string
  interest_rate?: number
  total_interest_earned?: number
}

export const listAdminUsers = (client: ApiClient) =>
  client.get<AdminUser[]>('/admin/users')

export const listAdminChildren = (client: ApiClient) =>
  client.get<AdminChild[]>('/admin/children')

export const listAdminTransactions = (client: ApiClient) =>
  client.get<Transaction[]>('/admin/transactions')

export const approveAdminUser = (client: ApiClient, userId: number) =>
  client.post<null>(`/admin/users/${userId}/approve`)

export const updateAdminUser = (client: ApiClient, userId: number, payload: { name: string; role: string }) =>
  client.put<null>(`/admin/users/${userId}`, payload)

export const deleteAdminUser = (client: ApiClient, userId: number) =>
  client.delete<null>(`/admin/users/${userId}`)

export const createParentUser = (client: ApiClient, payload: { name: string; email: string; password: string }) =>
  client.post<null>('/admin/users', payload)

export const updateAdminChild = (
  client: ApiClient,
  childId: number,
  payload: { first_name: string; frozen: boolean; access_code?: string },
) => client.put<null>(`/admin/children/${childId}`, payload)

export const deleteAdminChild = (client: ApiClient, childId: number) =>
  client.delete<null>(`/admin/children/${childId}`)

export const deleteAdminTransaction = (client: ApiClient, transactionId: number) =>
  client.delete<null>(`/admin/transactions/${transactionId}`)
