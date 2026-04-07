import type { ApiClient } from './client'
import type { WithdrawalRequest } from '../types/domain'
export type { WithdrawalRequest }

export const listPendingWithdrawals = (client: ApiClient) =>
  client.get<WithdrawalRequest[]>('/withdrawals/')

export const listMyWithdrawals = (client: ApiClient) =>
  client.get<WithdrawalRequest[]>('/withdrawals/mine')

export const createWithdrawal = (client: ApiClient, payload: { amount: number; memo?: string | null }) =>
  client.post<WithdrawalRequest>('/withdrawals/', payload)

export const cancelWithdrawal = (client: ApiClient, withdrawalId: number) =>
  client.post<null>(`/withdrawals/${withdrawalId}/cancel`)

export const approveWithdrawal = (client: ApiClient, withdrawalId: number) =>
  client.post<null>(`/withdrawals/${withdrawalId}/approve`)

export const denyWithdrawal = (client: ApiClient, withdrawalId: number, reason: string) =>
  client.post<null>(`/withdrawals/${withdrawalId}/deny`, { reason })
