import { del, get, post, put } from './http'
import type {
  ActivityItem,
  CategoryItem,
  DocumentItem,
  PageView,
  SiteContent,
  SiteContentUpdate,
} from '@/types'

/** 契约 §4.6-§4.9 */
export const apiDocuments = (params: { page: number; size: number; title?: string }) =>
  get<PageView<DocumentItem>>('/documents', { params })

export const apiDocument = (id: number) => get<DocumentItem>(`/documents/${id}`)

export const apiCreateDocument = (data: { title: string; summary?: string; file: string }) =>
  post<DocumentItem>('/documents', data)

export const apiUpdateDocument = (
  id: number,
  data: { title: string; summary?: string; file: string },
) => put<DocumentItem>(`/documents/${id}`, data)

export const apiDeleteDocument = (id: number) => del<void>(`/documents/${id}`)

export const apiActivities = (page = 1, size = 10) =>
  get<PageView<ActivityItem>>('/activities', { params: { page, size } })

export const apiActivity = (id: number) => get<ActivityItem>(`/activities/${id}`)

export const apiCreateActivity = (data: {
  title: string
  summary: string
  file: string
  cover?: string
}) => post<ActivityItem>('/activities', data)

export const apiUpdateActivity = (
  id: number,
  data: { title: string; summary: string; file: string; cover?: string },
) => put<ActivityItem>(`/activities/${id}`, data)

export const apiDeleteActivity = (id: number) => del<void>(`/activities/${id}`)

export const apiCategories = () => get<CategoryItem[]>('/categories')

export const apiCreateCategory = (name: string) => post<CategoryItem>('/categories', { name })

export const apiDeleteCategory = (id: number) => del<void>(`/categories/${id}`)

export const apiQqGroup = () => get<{ value: string }>('/config/qq-group')

export const apiUpdateQqGroup = (value: string) => put<void>('/config/qq-group', { value })

/* 站点文案（关于我们 / 使用帮助 / 交流群）：读公开，写管理员（契约 §4.9） */
export const apiSiteContent = () => get<SiteContent>('/config/site-content')

export const apiUpdateSiteContent = (data: SiteContentUpdate) =>
  put<SiteContent>('/config/site-content', data)
