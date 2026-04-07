import type { ApiClient } from './client'

export interface Loan {
  id: number
  amount: number
  purpose?: string | null
  interest_rate: number
  status: string
  principal_remaining: number
  terms?: string | null
}

export const listMyLoans = (client: ApiClient) =>
  client.get<Loan[]>('/loans/child')

export const listLoansForChild = (client: ApiClient, childId: number) =>
  client.get<Loan[]>(`/loans/child/${childId}`)

export const applyForLoan = (client: ApiClient, payload: { child_id: number; amount: number; purpose: string }) =>
  client.post<Loan>('/loans/', payload)

export const approveLoan = (client: ApiClient, loanId: number, payload: { interest_rate: number; terms?: string }) =>
  client.post<null>(`/loans/${loanId}/approve`, payload)

export const denyLoan = (client: ApiClient, loanId: number) =>
  client.post<null>(`/loans/${loanId}/deny`)

export const acceptLoan = (client: ApiClient, loanId: number) =>
  client.post<null>(`/loans/${loanId}/accept`)

export const declineLoan = (client: ApiClient, loanId: number) =>
  client.post<null>(`/loans/${loanId}/decline`)

export const recordLoanPayment = (client: ApiClient, loanId: number, amount: number) =>
  client.post<null>(`/loans/${loanId}/payment`, { amount })

export const updateLoanInterest = (client: ApiClient, loanId: number, interest_rate: number) =>
  client.post<null>(`/loans/${loanId}/interest`, { interest_rate })

export const closeLoan = (client: ApiClient, loanId: number) =>
  client.post<null>(`/loans/${loanId}/close`)
