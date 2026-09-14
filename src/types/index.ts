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

/** 批量操作中的单条失败项（契约 §1「批量接口约定」） */
export interface BatchFailure {
  id: string
  code: number
  reason: string
}

/** 批量操作结果。不变式：success + failures.length === total */
export interface BatchResult {
  total: number
  success: number
  failures: BatchFailure[]
}

/** 使用帮助的一条问答（答案支持 Markdown） */
export interface FaqItem {
  question: string
  answer: string
}

/** 站点文案（契约 §4.9 site-content），由管理端维护 */
export interface SiteContent {
  aboutTitle: string
  aboutBody: string
  faqItems: FaqItem[]
  qqNotice: string
  qqQrcode: string
}

/**
 * 站点文案更新请求（契约 §4.9）。
 * 三态语义：字段不传 = 保留、传空串 = 清空、传值 = 替换。
 */
export interface SiteContentUpdate {
  about_title?: string
  about_body?: string
  faq_items?: FaqItem[]
  qq_notice?: string
  qq_qrcode?: string
}
