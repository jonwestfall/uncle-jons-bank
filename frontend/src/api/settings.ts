import type { ApiClient } from './client'

export interface SiteSettings {
  site_name: string
  site_url: string
  default_interest_rate: number
  default_penalty_interest_rate: number
  default_cd_penalty_rate: number
  service_fee_amount: number
  service_fee_is_percentage: boolean
  overdraft_fee_amount: number
  overdraft_fee_is_percentage: boolean
  overdraft_fee_daily: boolean
  currency_symbol: string
  public_registration_disabled: boolean
}

export const getSettings = (client: ApiClient) =>
  client.get<SiteSettings>('/settings/')
