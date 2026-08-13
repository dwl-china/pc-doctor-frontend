import { del, get, post, put } from './http'
import type { DoctorStatView, PageView, UserView } from '@/types'

/** 契约 §4.3 管理端 */
export const apiAdminUsers = (params: {
  page: number
  size: number
  user_id?: string
  user_name?: string
  level?: number
}) => get<PageView<UserView>>('/admin/users', { params })

export const apiAdminUpdateUser = (
  id: string,
  data: {
    user_name?: string
    contact_details?: string
    user_description?: string
    level?: number
  },
) => put<UserView>(`/admin/users/${id}`, data)

export const apiAdminUpdateLevel = (id: string, level: number) =>
  put<UserView>(`/admin/users/${id}/level`, { level })

export const apiAdminResetPassword = (id: string) =>
  post<{ new_password: string }>(`/admin/users/${id}/reset-password`)

export const apiAdminDeleteUser = (id: string) => del<void>(`/admin/users/${id}`)

export const apiAdminDoctors = (page = 1, size = 10) =>
  get<PageView<DoctorStatView>>('/admin/doctors', { params: { page, size } })
