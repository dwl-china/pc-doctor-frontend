import { del, get, post, put } from './http'
import type { AppointmentSubmit, AppointmentView, MessageView, PageView } from '@/types'

/** 契约 §4.4 / §4.5 */
export const apiAppointments = (params: {
  page: number
  size: number
  status?: number
  user_id?: string
  doctor_id?: string
  mine?: number
}) => get<PageView<AppointmentView>>('/appointments', { params })

export const apiAppointment = (id: number) => get<AppointmentView>(`/appointments/${id}`)

export const apiSubmitAppointment = (data: AppointmentSubmit) =>
  post<AppointmentView>('/appointments', data)

export const apiUpdateAppointment = (id: number, data: Partial<AppointmentSubmit>) =>
  put<AppointmentView>(`/appointments/${id}`, data)

export const apiDeleteAppointment = (id: number) => del<void>(`/appointments/${id}`)

export const apiAcceptAppointment = (id: number) =>
  post<AppointmentView>(`/appointments/${id}/accept`)

export const apiCompleteAppointment = (id: number) =>
  post<AppointmentView>(`/appointments/${id}/complete`)

export const apiMessages = (appointmentId: number) =>
  get<MessageView[]>(`/appointments/${appointmentId}/messages`)

export const apiPostMessage = (
  appointmentId: number,
  data: { message: string; picture?: string },
) => post<MessageView>(`/appointments/${appointmentId}/messages`, data)
