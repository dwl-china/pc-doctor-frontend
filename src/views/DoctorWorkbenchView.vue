<script setup lang="ts">
/**
 * 电医工作台（阶段 7 · 8.6）：排队中（全部）/ 处理中（我的）/ 已完成（我的）三列表 + 接单/完成。
 * - 处理中与已完成用 doctor_id=本人 过滤（§4.4，2026-08-14 契约增补）
 * - 接单/完成走服务端状态机（CAS 防抢单），失败由拦截器提示
 */
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiAcceptAppointment, apiAppointments, apiCompleteAppointment } from '@/api/appointment'
import { useAuthStore } from '@/stores/auth'
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_LABEL, PAGE_SIZE_DEFAULT } from '@/constants'
import type { AppointmentView, PageView } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const me = auth.user?.userId ?? ''

type TabKey = 'queued' | 'processing' | 'done'

const tabs: { key: TabKey; label: string; status: number; mineOnly: boolean }[] = [
  {
    key: 'queued',
    label: APPOINTMENT_STATUS_LABEL[APPOINTMENT_STATUS.QUEUED],
    status: APPOINTMENT_STATUS.QUEUED,
    mineOnly: false,
  },
  {
    key: 'processing',
    label: APPOINTMENT_STATUS_LABEL[APPOINTMENT_STATUS.PROCESSING],
    status: APPOINTMENT_STATUS.PROCESSING,
    mineOnly: true,
  },
  {
    key: 'done',
    label: APPOINTMENT_STATUS_LABEL[APPOINTMENT_STATUS.DONE],
    status: APPOINTMENT_STATUS.DONE,
    mineOnly: true,
  },
]

const activeTab = ref<TabKey>('queued')

const state = reactive<
  Record<TabKey, { page: number; total: number; records: AppointmentView[]; loading: boolean }>
>({
  queued: { page: 1, total: 0, records: [], loading: false },
  processing: { page: 1, total: 0, records: [], loading: false },
  done: { page: 1, total: 0, records: [], loading: false },
})

async function loadTab(key: TabKey) {
  const s = state[key]
  const tab = tabs.find((t) => t.key === key)!
  s.loading = true
  try {
    const res: PageView<AppointmentView> = await apiAppointments({
      page: s.page,
      size: PAGE_SIZE_DEFAULT,
      status: tab.status,
      doctor_id: tab.mineOnly ? me : undefined,
    })
    s.records = res.records
    s.total = res.total
  } catch {
    /* 拦截器已提示 */
  } finally {
    s.loading = false
  }
}

function changePage(key: TabKey, page: number) {
  state[key].page = page
  loadTab(key)
}

/** 接单（排队单） */
async function accept(row: AppointmentView) {
  try {
    await ElMessageBox.confirm('确认接单？接单后请及时处理。', '接单', { type: 'info' })
    await apiAcceptAppointment(row.id)
    ElMessage.success('已成功接单')
    await loadTab('queued')
    await loadTab('processing')
  } catch (e) {
    if (e instanceof Error) return
  }
}

/** 完成（仅自己接的单） */
async function complete(row: AppointmentView) {
  try {
    await ElMessageBox.confirm('确认该预约已完成？', '完成预约', { type: 'info' })
    await apiCompleteAppointment(row.id)
    ElMessage.success('预约已完成')
    await loadTab('processing')
    await loadTab('done')
  } catch (e) {
    if (e instanceof Error) return
  }
}

watch(activeTab, (key) => {
  if (state[key].records.length === 0 && state[key].total === 0 && !state[key].loading) {
    loadTab(key)
  }
})

onMounted(() => loadTab('queued'))
</script>

<template>
  <div class="workbench-page">
    <h2 class="page-title">电医工作台</h2>

    <el-tabs v-model="activeTab">
      <el-tab-pane v-for="tab in tabs" :key="tab.key" :label="tab.label" :name="tab.key">
        <el-table
          v-loading="state[tab.key].loading"
          :data="state[tab.key].records"
          stripe
          empty-text="暂无相关预约"
        >
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="问题描述" min-width="220">
            <template #default="{ row }">
              <el-link type="primary" @click="router.push(`/appointments/${row.id}`)">
                {{ row.problemDescription }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column label="分类" width="130">
            <template #default="{ row }">
              <el-tag size="small" type="primary" effect="plain">
                {{ row.categoryName ?? '未分类' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="userName" label="预约人" width="120" />
          <el-table-column
            prop="availableTime"
            label="期望时间"
            min-width="140"
            show-overflow-tooltip
          />
          <el-table-column prop="createTime" label="创建时间" width="165" />
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="tab.key === 'queued'"
                type="primary"
                size="small"
                @click="accept(row)"
              >
                接单
              </el-button>
              <el-button
                v-if="tab.key === 'processing'"
                type="success"
                size="small"
                @click="complete(row)"
              >
                完成
              </el-button>
              <el-button size="small" @click="router.push(`/appointments/${row.id}`)">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="state[tab.key].total > PAGE_SIZE_DEFAULT" class="pagination">
          <el-pagination
            :current-page="state[tab.key].page"
            :page-size="PAGE_SIZE_DEFAULT"
            :total="state[tab.key].total"
            layout="prev, pager, next, total"
            background
            @current-change="(p: number) => changePage(tab.key, p)"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.page-title {
  margin: 4px 0 16px;
  color: var(--el-color-primary);
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
