import type { ApiClient } from './client'

export interface AuthResponse {
  access_token: string
}

export interface NeedsAdminResponse {
  needs_admin: boolean
}

export const needsAdmin = (client: ApiClient) =>
  client.get<NeedsAdminResponse>('/needs-admin')

export const registerParent = (client: ApiClient, payload: { name: string; email: string; password: string }) =>
  client.post<null>('/register', payload)

export const loginParent = (client: ApiClient, payload: { email: string; password: string }) =>
  client.post<AuthResponse>('/login', payload)

export const loginChild = (client: ApiClient, payload: { access_code: string }) =>
  client.post<AuthResponse>('/children/login', payload)
