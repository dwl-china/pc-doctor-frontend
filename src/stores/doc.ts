import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  apiActivities,
  apiActivity,
  apiCategories,
  apiCreateActivity,
  apiCreateCategory,
  apiCreateDocument,
  apiDeleteActivity,
  apiDeleteCategory,
  apiDeleteDocument,
  apiDocument,
  apiDocuments,
  apiQqGroup,
  apiUpdateActivity,
  apiUpdateDocument,
  apiUpdateQqGroup,
} from '@/api/content'
import type { ActivityItem, CategoryItem, DocumentItem, PageView } from '@/types'

/**
 * 文档 / 活动 / 分类 / 配置状态（公开浏览 + 管理端写）。
 */
export const useDocStore = defineStore('doc', () => {
  const documents = ref<PageView<DocumentItem>>({ total: 0, records: [] })
  const activities = ref<PageView<ActivityItem>>({ total: 0, records: [] })
  const categories = ref<CategoryItem[]>([])
  const qqGroup = ref('')

  async function fetchDocuments(params: { page?: number; size?: number; title?: string }) {
    documents.value = await apiDocuments({
      page: params.page ?? 1,
      size: params.size ?? 10,
      title: params.title,
    })
  }

  const documentDetail = (id: number) => apiDocument(id)
  const createDocument = (data: { title: string; summary?: string; file: string }) =>
    apiCreateDocument(data)
  const updateDocument = (id: number, data: { title: string; summary?: string; file: string }) =>
    apiUpdateDocument(id, data)
  const deleteDocument = (id: number) => apiDeleteDocument(id)

  async function fetchActivities(page = 1, size = 10) {
    activities.value = await apiActivities(page, size)
  }

  const activityDetail = (id: number) => apiActivity(id)
  const createActivity = (data: { title: string; summary: string; file: string; cover?: string }) =>
    apiCreateActivity(data)
  const updateActivity = (
    id: number,
    data: { title: string; summary: string; file: string; cover?: string },
  ) => apiUpdateActivity(id, data)
  const deleteActivity = (id: number) => apiDeleteActivity(id)

  async function fetchCategories() {
    categories.value = await apiCategories()
  }

  const createCategory = (name: string) => apiCreateCategory(name)
  const deleteCategory = (id: number) => apiDeleteCategory(id)

  async function fetchQqGroup() {
    qqGroup.value = (await apiQqGroup()).value
  }

  const updateQqGroup = (value: string) => apiUpdateQqGroup(value)

  return {
    documents,
    activities,
    categories,
    qqGroup,
    fetchDocuments,
    documentDetail,
    createDocument,
    updateDocument,
    deleteDocument,
    fetchActivities,
    activityDetail,
    createActivity,
    updateActivity,
    deleteActivity,
    fetchCategories,
    createCategory,
    deleteCategory,
    fetchQqGroup,
    updateQqGroup,
  }
})
