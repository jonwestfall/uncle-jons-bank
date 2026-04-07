import type { LedgerResponse, Transaction } from '../types/domain'
import type { ApiClient } from './client'
export type { LedgerResponse, Transaction }

export interface CreateTransactionPayload {
  child_id: number
  type: string
  amount: number
  memo?: string | null
  initiated_by: string
  initiator_id: number
}

export const getChildLedger = (client: ApiClient, childId: number) =>
  client.get<LedgerResponse>(`/transactions/child/${childId}`)

export const createTransaction = (client: ApiClient, payload: CreateTransactionPayload) =>
  client.post<Transaction>('/transactions/', payload)

export const deleteTransaction = (client: ApiClient, transactionId: number) =>
  client.delete<null>(`/transactions/${transactionId}`)

export const listAdminTransactions = (client: ApiClient) =>
  client.get<Transaction[]>('/admin/transactions')

export const deleteAdminTransaction = (client: ApiClient, transactionId: number) =>
  client.delete<null>(`/admin/transactions/${transactionId}`)
