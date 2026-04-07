import type { ApiClient } from './client'

export interface Coupon {
  id: number
  code: string
  amount: number
  memo?: string | null
  expiration?: string | null
  max_uses: number
  uses_remaining: number
  scope: string
  child_id?: number | null
  qr_code?: string | null
  created_by?: number
}

export interface CouponRedemption {
  id: number
  redeemed_at: string
  coupon: {
    code: string
    amount: number
    memo?: string | null
  }
}

export interface CreateCouponPayload {
  amount: number
  memo?: string
  max_uses: number
  expiration?: string
  scope: string
  child_id?: number
}

export const listCoupons = (client: ApiClient) =>
  client.get<Coupon[]>('/coupons')

export const listAllCoupons = (client: ApiClient, params: URLSearchParams) =>
  client.get<Coupon[]>(`/coupons/all?${params.toString()}`)

export const createCoupon = (client: ApiClient, payload: CreateCouponPayload) =>
  client.post<Coupon>('/coupons', payload)

export const deleteCoupon = (client: ApiClient, couponId: number) =>
  client.delete<null>(`/coupons/${couponId}`)

export const redeemCoupon = (client: ApiClient, code: string) =>
  client.post<CouponRedemption>('/coupons/redeem', { code })

export const listCouponRedemptions = (client: ApiClient) =>
  client.get<CouponRedemption[]>('/coupons/redemptions')
