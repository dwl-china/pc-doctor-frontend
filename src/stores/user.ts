import { defineStore } from 'pinia'
import { apiChangePassword, apiDoctors, apiUpdateProfile, apiUploadAvatar } from '@/api/user'
import type { PageView, UserView } from '@/types'

/**
 * 用户自操作：资料 / 头像 / 改密 / 电医列表。
 */
export const useUserStore = defineStore('user', () => {
  const doctors = async (page = 1, size = 10): Promise<PageView<UserView>> => apiDoctors(page, size)

  const updateProfile = (data: {
    user_name: string
    sex?: string
    contact_details?: string
    user_description?: string
  }) => apiUpdateProfile(data)

  const changePassword = (data: { old_password: string; new_password: string }) =>
    apiChangePassword(data)

  const uploadAvatar = (file: File) => apiUploadAvatar(file)

  return { doctors, updateProfile, changePassword, uploadAvatar }
})
