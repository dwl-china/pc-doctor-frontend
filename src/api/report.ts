import { del, get, post, put } from './http'
import type { PageView } from '@/types'

/** 契约 §4.11：内容举报 */
export interface ReportItem {
  id: number
  targetType: number
  targetId: number
  reason: string
  reporterId: string
  status: number
  createTime: string
  handleTime?: string
  handlerId?: string
  targetSummary?: string
}

export const REPORT_TARGET = {
  APPOINTMENT: 1,
  MESSAGE: 2,
} as const

export const REPORT_STATUS = {
  PENDING: 0,
  HANDLED: 1,
} as const

export const apiReport = (data: { target_type: number; target_id: number; reason: string }) =>
  post<void>('/reports', data)

export const apiAdminReports = (params: { page: number; size: number; status?: number }) =>
  get<PageView<ReportItem>>('/admin/reports', { params })

export const apiHandleReport = (id: number) => put<void>(`/admin/reports/${id}/handle`)

export const apiDeleteMessage = (messageId: number) => del<void>(`/messages/${messageId}`)
