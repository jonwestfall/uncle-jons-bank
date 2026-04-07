import type { ApiClient } from './client'

export interface UserData {
  name: string
  email: string
  permissions: string[]
  role?: string
}

export const getMe = (client: ApiClient) =>
  client.get<UserData>('/users/me')

export const updateMyPassword = (client: ApiClient, password: string) =>
  client.put<null>('/users/me/password', { password })
