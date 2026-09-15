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
  apiSiteContent,
  apiUpdateActivity,
  apiUpdateDocument,
  apiUpdateQqGroup,
  apiUpdateSiteContent,
} from '@/api/content'
import type {
  ActivityItem,
  CategoryItem,
  DocumentItem,
  PageView,
  SiteContent,
  SiteContentUpdate,
} from '@/types'

/**
 * 文档 / 活动 / 分类 / 配置状态（公开浏览 + 管理端写）。
 */
export const useDocStore = defineStore('doc', () => {
  const documents = ref<PageView<DocumentItem>>({ total: 0, records: [] })
  const activities = ref<PageView<ActivityItem>>({ total: 0, records: [] })
  const categories = ref<CategoryItem[]>([])
  const qqGroup = ref('')
  const siteContent = ref<SiteContent>({
    aboutTitle: '',
    aboutBody: '',
    faqItems: [],
    qqNotice: '',
    qqQrcode: '',
    footerHtml: '',
  })

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

  /** 页脚/关于我们/帮助/意见反馈都要读群号，加缓存守卫避免每次进页面都发一次请求 */
  async function fetchQqGroup() {
    if (qqGroup.value) return
    qqGroup.value = (await apiQqGroup()).value
  }

  /** 更新后回写 store，否则管理端保存完、其他页面还显示旧群号 */
  async function updateQqGroup(value: string) {
    await apiUpdateQqGroup(value)
    qqGroup.value = value
  }

  async function fetchSiteContent() {
    siteContent.value = await apiSiteContent()
  }

  async function updateSiteContent(data: SiteContentUpdate) {
    siteContent.value = await apiUpdateSiteContent(data)
  }

  return {
    documents,
    activities,
    categories,
    qqGroup,
    siteContent,
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
    fetchSiteContent,
    updateSiteContent,
  }
})
