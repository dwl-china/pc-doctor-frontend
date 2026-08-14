import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  apiAcceptAppointment,
  apiAppointment,
  apiAppointments,
  apiCompleteAppointment,
  apiDeleteAppointment,
  apiMessages,
  apiPostMessage,
  apiSubmitAppointment,
  apiUpdateAppointment,
} from '@/api/appointment'
import { PAGE_SIZE_DEFAULT } from '@/constants'
import type { AppointmentSubmit, AppointmentView, MessageView, PageView } from '@/types'

/**
 * 预约（order）状态：首页列表 / 详情 / 提交 / 接单 / 完成 / 留言。
 */
export const useOrderStore = defineStore('order', () => {
  const list = ref<PageView<AppointmentView>>({ total: 0, records: [] })
  const page = ref(1)
  const size = ref(PAGE_SIZE_DEFAULT)
  const statusFilter = ref<number | undefined>(undefined)
  const mineFilter = ref(false)
  const loading = ref(false)

  async function fetchList(params?: {
    page?: number
    status?: number
    user_id?: string
    doctor_id?: string
    mine?: number
  }) {
    loading.value = true
    try {
      page.value = params?.page ?? page.value
      statusFilter.value = params?.status
      mineFilter.value = params?.mine === 1
      list.value = await apiAppointments({
        page: page.value,
        size: size.value,
        status: statusFilter.value,
        user_id: params?.user_id,
        doctor_id: params?.doctor_id,
        mine: mineFilter.value ? 1 : 0,
      })
    } finally {
      loading.value = false
    }
  }

  async function submit(data: AppointmentSubmit) {
    return apiSubmitAppointment(data)
  }

  async function detail(id: number) {
    return apiAppointment(id)
  }

  async function update(id: number, data: Partial<AppointmentSubmit>) {
    return apiUpdateAppointment(id, data)
  }

  async function remove(id: number) {
    await apiDeleteAppointment(id)
  }

  async function accept(id: number) {
    return apiAcceptAppointment(id)
  }

  async function complete(id: number) {
    return apiCompleteAppointment(id)
  }

  async function messages(appointmentId: number): Promise<MessageView[]> {
    return apiMessages(appointmentId)
  }

  async function postMessage(appointmentId: number, message: string, picture?: string) {
    return apiPostMessage(appointmentId, { message, picture })
  }

  return {
    list,
    page,
    size,
    statusFilter,
    mineFilter,
    loading,
    fetchList,
    submit,
    detail,
    update,
    remove,
    accept,
    complete,
    messages,
    postMessage,
  }
})
