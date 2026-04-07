import type { ApiClient } from './client'

export type MessageTab = 'inbox' | 'sent' | 'archive'

export interface Message {
  id: number
  subject: string
  body: string
  created_at: string
  sender_user_id?: number
  sender_child_id?: number
  recipient_user_id?: number
  recipient_child_id?: number
  read: boolean
}

interface DirectMessagePayload {
  subject: string
  body: string
  recipient_user_id?: number
  recipient_child_id?: number
}

interface BroadcastPayload {
  subject: string
  body: string
  target: string
}

export const listMessages = (client: ApiClient, tab: MessageTab) =>
  client.get<Message[]>(`/messages/${tab}`)

export const getMessage = (client: ApiClient, messageId: number) =>
  client.get<Message>(`/messages/${messageId}`)

export const archiveMessage = (client: ApiClient, messageId: number) =>
  client.post<null>(`/messages/${messageId}/archive`)

export const sendDirectMessage = (client: ApiClient, payload: DirectMessagePayload) =>
  client.post<null>('/messages/', payload)

export const sendBroadcastMessage = (client: ApiClient, payload: BroadcastPayload) =>
  client.post<null>('/messages/broadcast', payload)
