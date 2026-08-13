import { get, post, put } from './http'
import type { PageView, UserView } from '@/types'

/** 契约 §4.2 */
export const apiDoctors = (page = 1, size = 10) =>
  get<PageView<UserView>>('/doctors', { params: { page, size } })

export const apiUpdateProfile = (data: {
  user_name: string
  sex?: string
  contact_details?: string
  user_description?: string
}) => put<UserView>('/users/me', data)

export const apiChangePassword = (data: { old_password: string; new_password: string }) =>
  put<void>('/users/me/password', data)

export const apiUploadAvatar = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return post<{ url: string }>('/users/me/avatar', form)
}
