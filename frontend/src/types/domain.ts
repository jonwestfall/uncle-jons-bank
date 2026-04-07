export interface Transaction {
  id: number
  child_id: number
  type: string
  amount: number
  memo?: string | null
  initiated_by: string
  initiator_id: number
  timestamp: string
}

export interface LedgerResponse {
  balance: number
  transactions: Transaction[]
}

export interface RecurringCharge {
  id: number
  child_id: number
  amount: number
  type: string
  memo?: string | null
  interval_days: number
  next_run: string
  active: boolean
}

export interface WithdrawalRequest {
  id: number
  child_id: number
  amount: number
  memo?: string | null
  status: string
  requested_at: string
  responded_at?: string | null
  denial_reason?: string | null
}

export interface ChildParentInfo {
  user_id: number
  name: string
  email: string
  permissions: string[]
  is_owner: boolean
}

export interface ChildAccount {
  id: number
  first_name: string
  frozen: boolean
  interest_rate?: number
  penalty_interest_rate?: number
  cd_penalty_rate?: number
  total_interest_earned?: number
  balance?: number
  last_activity?: string
}

export interface CdOffer {
  id: number
  amount: number
  interest_rate: number
  term_days: number
  status: string
  matures_at?: string | null
}
