/**
 * 魔法数字收敛（#33）：状态/角色/分页/上传等全站统一从这里取。
 */

/** localStorage 键名 */
export const TOKEN_KEY = 'pc_doctor_token'
export const USER_KEY = 'pc_doctor_user'

/** 角色等级（与后端 user_table.level 对齐，契约 §4.1） */
export const USER_LEVEL = {
  USER: 0,
  DOCTOR: 1,
  ADMIN: 2,
} as const
export type UserLevel = (typeof USER_LEVEL)[keyof typeof USER_LEVEL]

/** 预约状态（appointment_table.status，契约 §4.4） */
export const APPOINTMENT_STATUS = {
  QUEUED: 0,
  PROCESSING: 1,
  DONE: 2,
} as const
export const APPOINTMENT_STATUS_LABEL: Record<number, string> = {
  [APPOINTMENT_STATUS.QUEUED]: '排队中',
  [APPOINTMENT_STATUS.PROCESSING]: '处理中',
  [APPOINTMENT_STATUS.DONE]: '已完成',
}

/** 分页（契约 §1：size 默认 10、最大 100） */
export const PAGE_SIZE_DEFAULT = 10
export const PAGE_SIZE_MAX = 100

/** 上传限制（契约 §1：单文件最大 20MB；§4.10 扩展名白名单） */
export const UPLOAD_MAX_MB = 20
export const UPLOAD_ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'md', 'pdf'] as const
export const UPLOAD_TYPES = {
  avatar: 'avatar',
  appointment: 'appointment',
  doc: 'doc',
  activity: 'activity',
  message: 'message',
} as const
export type UploadType = (typeof UPLOAD_TYPES)[keyof typeof UPLOAD_TYPES]

/** 头像：jpg/png，服务端裁剪压缩至 300px（#33 老前端 300px 约定） */
export const AVATAR_MAX_PX = 300
export const AVATAR_ALLOWED_EXTS = ['jpg', 'jpeg', 'png'] as const

/** 性别选项 */
export const SEX_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'unknown', label: '保密' },
] as const

/** 图片扩展名集合（需要前端预览的类型） */
export const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
