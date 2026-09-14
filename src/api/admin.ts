import { del, get, post, put } from './http'
import type {
  AppointmentView,
  BatchResult,
  DoctorStatView,
  PageView,
  UserView,
} from '@/types'

/**
 * 契约 §4.3 管理端。
 * `keyword` = 账号**或**昵称模糊匹配（搜索框用这个）；
 * `user_id` / `user_name` 是分别精确到字段的筛选，多个条件取交集。
 */
export const apiAdminUsers = (params: {
  page: number
  size: number
  keyword?: string
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

/**
 * 管理员改预约状态（契约 §4.3）：电医误操作后的兜底修正。
 * 后端按目标状态自动维护 doctor_id / appointment_time / done_time；
 * 状态已被他人变更时返回 2003。
 */
export const apiAdminUpdateAppointmentStatus = (
  id: number,
  data: { status: number; doctor_id?: string | null },
) => put<AppointmentView>(`/admin/appointments/${id}/status`, data)

/* ---------------- 批量操作（契约 §4.3） ----------------
 * 统一返回 BatchResult：部分成功仍是 code 0，失败明细在 data.failures 里。
 * ids 上限 200，前端调用方负责不超限（表格多选天然不会超）。
 */

export const apiBatchDeleteUsers = (ids: string[]) =>
  post<BatchResult>('/admin/users/batch/delete', { ids })

export const apiBatchUpdateUserLevel = (ids: string[], level: number) =>
  post<BatchResult>('/admin/users/batch/level', { ids, level })

export const apiBatchDeleteAppointments = (ids: number[]) =>
  post<BatchResult>('/admin/appointments/batch/delete', { ids })

export const apiBatchUpdateAppointmentStatus = (
  ids: number[],
  data: { status: number; doctor_id?: string | null },
) => post<BatchResult>('/admin/appointments/batch/status', { ids, ...data })

export const apiBatchDeleteCategories = (ids: number[]) =>
  post<BatchResult>('/admin/categories/batch/delete', { ids })

export const apiBatchHandleReports = (ids: number[]) =>
  post<BatchResult>('/admin/reports/batch/handle', { ids })
