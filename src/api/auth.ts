import { get, post } from './http'
import type { AuthResponse, UserView } from '@/types'

/** 契约 §4.1 */
export const apiLogin = (data: { user_id: string; password: string }) =>
  post<AuthResponse>('/auth/login', data)

export const apiRegister = (data: {
  user_id: string
  password: string
  user_name: string
  contact_details?: string
  sex?: string
}) => post<AuthResponse>('/auth/register', data)

export const apiMe = () => get<UserView>('/auth/me')
