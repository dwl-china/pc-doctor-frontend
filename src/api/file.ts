import { post } from './http'
import type { UploadType } from '@/constants'

/** 契约 §4.10：上传（类型目录由常量白名单约束） */
export const apiUpload = (file: File, type: UploadType) => {
  const form = new FormData()
  form.append('file', file)
  form.append('type', type)
  return post<{ url: string }>('/files', form)
}
