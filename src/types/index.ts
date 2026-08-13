/**
 * 后端契约类型（与 pc-doctor-backend docs/api.md 对齐）。
 */

export interface UserView {
  userId: string
  userName: string
  sex: 'male' | 'female' | 'unknown'
  level: number
  contactDetails?: string
  userDescription?: string | null
  userPicture?: string | null
  mustChangePassword: boolean
  createTime?: string
}

export interface AuthResponse {
  token: string
  user: UserView
}

export interface PageView<T> {
  total: number
  records: T[]
}

export interface AppointmentView {
  id: number
  userId: string
  userName?: string
  problemDescription: string
  categoryId: number
  categoryName?: string
  problemPicture?: string | null
  availableTime?: string | null
  appointmentLocation?: string | null
  status: number
  doctorId?: string | null
  doctorName?: string | null
  createTime: string
  appointmentTime?: string | null
  doneTime?: string | null
}

export interface AppointmentSubmit {
  problem_description: string
  category_id: number
  problem_picture?: string
  available_time?: string
  appointment_location?: string
}

export interface MessageView {
  id: number
  appointmentId: number
  userId: string
  userName?: string
  message: string
  picture?: string | null
  time: string
}

export interface DocumentItem {
  id: number
  title: string
  summary?: string | null
  file: string
  createTime?: string
  updateTime?: string
}

export interface ActivityItem {
  id: number
  title: string
  summary: string
  file: string
  cover?: string | null
  createTime?: string
  updateTime?: string
}

export interface CategoryItem {
  id: number
  name: string
}

export interface DoctorStatView extends UserView {
  acceptedCount: number
  completedCount: number
}
