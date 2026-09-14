import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  apiAdminDeleteUser,
  apiAdminDoctors,
  apiAdminResetPassword,
  apiAdminUpdateLevel,
  apiAdminUpdateUser,
  apiAdminUsers,
} from '@/api/admin'
import type { DoctorStatView, PageView, UserView } from '@/types'

/**
 * 管理端状态：用户管理 / 电医统计。
 */
export const useAdminStore = defineStore('admin', () => {
  const users = ref<PageView<UserView>>({ total: 0, records: [] })
  const doctors = ref<PageView<DoctorStatView>>({ total: 0, records: [] })

  async function fetchUsers(params: {
    page?: number
    size?: number
    keyword?: string
    user_id?: string
    user_name?: string
    level?: number
  }) {
    users.value = await apiAdminUsers({
      page: params.page ?? 1,
      size: params.size ?? 10,
      keyword: params.keyword,
      user_id: params.user_id,
      user_name: params.user_name,
      level: params.level,
    })
  }

  async function updateUser(
    id: string,
    data: {
      user_name?: string
      contact_details?: string
      user_description?: string
      level?: number
    },
  ) {
    return apiAdminUpdateUser(id, data)
  }

  async function updateLevel(id: string, level: number) {
    return apiAdminUpdateLevel(id, level)
  }

  async function resetPassword(id: string) {
    return apiAdminResetPassword(id)
  }

  async function deleteUser(id: string) {
    await apiAdminDeleteUser(id)
  }

  async function fetchDoctors(page = 1, size = 10) {
    doctors.value = await apiAdminDoctors(page, size)
  }

  return {
    users,
    doctors,
    fetchUsers,
    updateUser,
    updateLevel,
    resetPassword,
    deleteUser,
    fetchDoctors,
  }
})
