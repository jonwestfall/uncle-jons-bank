import type { ApiClient } from './client'

export interface QuizQuestion {
  id: number
  prompt: string
  options: string[]
}

export interface EducationModule {
  id: number
  title: string
  content: string
  questions: QuizQuestion[]
  badge_earned: boolean
}

export interface QuizResult {
  score: number
  passed: boolean
  badge_awarded?: boolean
}

export interface Badge {
  id: number
  name: string
  module_id?: number | null
}

export const listEducationModules = (client: ApiClient) =>
  client.get<EducationModule[]>('/education/modules')

export const submitModuleQuiz = (client: ApiClient, moduleId: number, answers: number[]) =>
  client.post<QuizResult>(`/education/modules/${moduleId}/quiz`, { answers })

export const listMyBadges = (client: ApiClient) =>
  client.get<Badge[]>('/education/badges/me')
