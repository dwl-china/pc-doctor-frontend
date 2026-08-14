<script setup lang="ts">
/**
 * 管理端（阶段 7 · 8.9）：用户管理 / 电医管理 / 预约管理 / 分类管理 / QQ 群号配置。
 * - 用户管理：搜索、改等级（二次确认）、重置密码（弹窗展示随机密码）、删除
 * - 电医管理：真实列表 + 接单统计（旧版假数据空壳 → 后端 /admin/doctors，#6.2）
 * - 预约管理：全量列表 + 状态/用户筛选 + 删除（旧版空文件 → 真实功能，#6.2）
 * - 分类管理：按 id 删除（修复旧版删错对象，#17）
 */
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAdminStore } from '@/stores/admin'
import { useDocStore } from '@/stores/doc'
import { useOrderStore } from '@/stores/order'
import { apiAppointments } from '@/api/appointment'
import {
  apiAdminReports,
  apiDeleteMessage,
  apiHandleReport,
  REPORT_STATUS,
  REPORT_TARGET,
} from '@/api/report'
import type { ReportItem } from '@/api/report'
import { PAGE_SIZE_DEFAULT, SEX_OPTIONS, USER_LEVEL } from '@/constants'
import type { AppointmentView, CategoryItem } from '@/types'

const adminStore = useAdminStore()
const docStore = useDocStore()
const orderStore = useOrderStore()
const router = useRouter()

const activeTab = ref('users')

const levelLabel: Record<number, string> = {
  [USER_LEVEL.USER]: '普通用户',
  [USER_LEVEL.DOCTOR]: '电医',
  [USER_LEVEL.ADMIN]: '管理员',
}

const sexLabel = (sex: string) => SEX_OPTIONS.find((o) => o.value === sex)?.label ?? sex

/* ---------- 用户管理 ---------- */
const userQuery = reactive({ keyword: '', level: undefined as number | undefined })
const userPage = ref(1)

async function loadUsers() {
  await adminStore.fetchUsers({
    page: userPage.value,
    size: PAGE_SIZE_DEFAULT,
    user_id: userQuery.keyword,
    user_name: userQuery.keyword,
    level: userQuery.level,
  })
}

function searchUsers() {
  userPage.value = 1
  loadUsers()
}

/** 改等级：先确认再调接口，失败刷新回退 */
async function changeLevel(row: { userId: string; level: number }, level: number) {
  if (level === row.level) return
  try {
    await ElMessageBox.confirm(
      `确认将「${row.userId}」的等级改为「${levelLabel[level]}」？`,
      '修改等级',
      { type: 'warning' },
    )
  } catch {
    await loadUsers()
    return
  }
  try {
    await adminStore.updateLevel(row.userId, level)
    ElMessage.success('等级已更新')
  } catch {
    /* 拦截器已提示 */
  } finally {
    await loadUsers()
  }
}

const resetVisible = ref(false)
const resetTarget = ref<string>('')
const resetPassword = ref('')

async function openReset(userId: string) {
  resetTarget.value = userId
  resetVisible.value = true
  resetPassword.value = ''
  try {
    const res = await adminStore.resetPassword(userId)
    resetPassword.value = res.new_password
  } catch {
    resetVisible.value = false
  }
}

async function copyReset() {
  await navigator.clipboard.writeText(resetPassword.value)
  ElMessage.success('已复制到剪贴板')
}

async function deleteUser(row: { userId: string }) {
  try {
    await ElMessageBox.confirm(
      `确认删除用户「${row.userId}」？其预约与留言将一并失去归属。`,
      '删除用户',
      { type: 'warning' },
    )
    await adminStore.deleteUser(row.userId)
    ElMessage.success('已删除')
    await loadUsers()
  } catch (e) {
    if (e instanceof Error) return
  }
}

/* ---------- 电医管理 ---------- */
const doctorPage = ref(1)

async function loadDoctors() {
  await adminStore.fetchDoctors(doctorPage.value, PAGE_SIZE_DEFAULT)
}

/* ---------- 预约管理 ---------- */
const apptQuery = reactive({ status: undefined as number | undefined, user_id: '' })
const apptPage = ref(1)
const apptList = ref<AppointmentView[]>([])
const apptTotal = ref(0)
const apptLoading = ref(false)

async function loadAppointments() {
  apptLoading.value = true
  try {
    const res = await apiAppointments({
      page: apptPage.value,
      size: PAGE_SIZE_DEFAULT,
      status: apptQuery.status,
      user_id: apptQuery.user_id || undefined,
    })
    apptList.value = res.records
    apptTotal.value = res.total
  } catch {
    /* 拦截器已提示 */
  } finally {
    apptLoading.value = false
  }
}

function searchAppointments() {
  apptPage.value = 1
  loadAppointments()
}

async function deleteAppointment(row: AppointmentView) {
  try {
    await ElMessageBox.confirm(`确认删除预约 #${row.id}？操作不可恢复。`, '删除预约', {
      type: 'warning',
    })
    await orderStore.remove(row.id)
    ElMessage.success('已删除')
    await loadAppointments()
  } catch (e) {
    if (e instanceof Error) return
  }
}

/* ---------- 举报处理（走查建议 #3） ---------- */
const reports = ref<ReportItem[]>([])
const reportLoading = ref(false)
const reportPage = ref(1)
const reportTotal = ref(0)
const reportQuery = reactive({ status: undefined as number | undefined })

async function loadReports() {
  reportLoading.value = true
  try {
    const res = await apiAdminReports({
      page: reportPage.value,
      size: PAGE_SIZE_DEFAULT,
      status: reportQuery.status,
    })
    reports.value = res.records
    reportTotal.value = res.total
  } catch {
    /* 拦截器已提示 */
  } finally {
    reportLoading.value = false
  }
}

function searchReports() {
  reportPage.value = 1
  loadReports()
}

async function handleReport(row: ReportItem) {
  try {
    await ElMessageBox.confirm('确认标记为已处理？', '处理举报', { type: 'info' })
    await apiHandleReport(row.id)
    ElMessage.success('已标记处理')
    await loadReports()
  } catch (e) {
    if (e instanceof Error) return
  }
}

async function goDeleteAppointment(row: ReportItem) {
  try {
    await ElMessageBox.confirm(`确认删除举报的预约 #${row.targetId}？操作不可恢复。`, '删除预约', {
      type: 'warning',
    })
    await orderStore.remove(row.targetId)
    ElMessage.success('预约已删除')
    await loadReports()
  } catch (e) {
    if (e instanceof Error) return
  }
}

async function goDeleteMessage(row: ReportItem) {
  try {
    await ElMessageBox.confirm(`确认删除举报的留言 #${row.targetId}？操作不可恢复。`, '删除留言', {
      type: 'warning',
    })
    await apiDeleteMessage(row.targetId)
    ElMessage.success('留言已删除')
    await loadReports()
  } catch (e) {
    if (e instanceof Error) return
  }
}

/* ---------- 分类管理 ---------- */
const categories = ref<CategoryItem[]>([])
const newCategory = ref('')

async function loadCategories() {
  categories.value = await docStore.fetchCategories().then(() => docStore.categories)
}

async function addCategory() {
  const name = newCategory.value.trim()
  if (!name) {
    ElMessage.warning('分类名不能为空')
    return
  }
  try {
    await docStore.createCategory(name)
    ElMessage.success('分类已添加')
    newCategory.value = ''
    await loadCategories()
  } catch {
    /* 拦截器已提示 */
  }
}

async function deleteCategory(item: CategoryItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除分类「${item.name}」？被预约引用的分类会被拒绝删除。`,
      '删除分类',
      { type: 'warning' },
    )
    await docStore.deleteCategory(item.id)
    ElMessage.success('已删除')
    await loadCategories()
  } catch (e) {
    if (e instanceof Error) return
  }
}

/* ---------- QQ 群号 ---------- */
const qqGroup = ref('')
const qqSaving = ref(false)

async function loadQqGroup() {
  await docStore.fetchQqGroup()
  qqGroup.value = docStore.qqGroup
}

async function saveQqGroup() {
  qqSaving.value = true
  try {
    await docStore.updateQqGroup(qqGroup.value.trim())
    ElMessage.success('QQ 群号已保存')
  } catch {
    /* 拦截器已提示 */
  } finally {
    qqSaving.value = false
  }
}

onMounted(() => {
  loadUsers()
  loadDoctors()
  loadAppointments()
  loadCategories().catch(() => undefined)
  loadQqGroup().catch(() => undefined)
  loadReports()
})
</script>

<template>
  <div class="admin-page">
    <h2 class="page-title">管理端</h2>

    <el-tabs v-model="activeTab">
      <!-- 用户管理 -->
      <el-tab-pane label="用户管理" name="users">
        <div class="filter-row">
          <el-input
            v-model="userQuery.keyword"
            maxlength="100"
            placeholder="按账号/昵称搜索"
            clearable
            class="filter-input"
            @keyup.enter="searchUsers"
            @clear="searchUsers"
          />
          <el-select
            v-model="userQuery.level"
            placeholder="全部等级"
            clearable
            class="filter-select"
          >
            <el-option :value="USER_LEVEL.USER" label="普通用户" />
            <el-option :value="USER_LEVEL.DOCTOR" label="电医" />
            <el-option :value="USER_LEVEL.ADMIN" label="管理员" />
          </el-select>
          <el-button type="primary" @click="searchUsers">搜索</el-button>
        </div>

        <el-table :data="adminStore.users.records" stripe empty-text="暂无用户">
          <el-table-column prop="userId" label="账号" width="150" />
          <el-table-column prop="userName" label="昵称" min-width="120" />
          <el-table-column label="性别" width="80">
            <template #default="{ row }">{{ sexLabel(row.sex) }}</template>
          </el-table-column>
          <el-table-column label="等级" width="180">
            <template #default="{ row }">
              <el-select
                :model-value="row.level"
                size="small"
                @update:model-value="(v: number) => changeLevel(row, v)"
              >
                <el-option :value="USER_LEVEL.USER" label="普通用户" />
                <el-option :value="USER_LEVEL.DOCTOR" label="电医" />
                <el-option :value="USER_LEVEL.ADMIN" label="管理员" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column
            prop="contactDetails"
            label="联系方式"
            min-width="140"
            show-overflow-tooltip
          />
          <el-table-column prop="createTime" label="注册时间" width="165" />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openReset(row.userId)">重置密码</el-button>
              <el-button size="small" type="danger" plain @click="deleteUser(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="adminStore.users.total > PAGE_SIZE_DEFAULT" class="pagination">
          <el-pagination
            v-model:current-page="userPage"
            :page-size="PAGE_SIZE_DEFAULT"
            :total="adminStore.users.total"
            layout="prev, pager, next, total"
            background
            @current-change="loadUsers"
          />
        </div>
      </el-tab-pane>

      <!-- 电医管理 -->
      <el-tab-pane label="电医管理" name="doctors">
        <el-table :data="adminStore.doctors.records" stripe empty-text="暂无电医">
          <el-table-column prop="userId" label="账号" width="150" />
          <el-table-column prop="userName" label="昵称" min-width="120" />
          <el-table-column
            prop="contactDetails"
            label="联系方式"
            min-width="140"
            show-overflow-tooltip
          />
          <el-table-column prop="acceptedCount" label="累计接单" width="110" sortable />
          <el-table-column prop="completedCount" label="已完成" width="110" sortable />
        </el-table>

        <div v-if="adminStore.doctors.total > PAGE_SIZE_DEFAULT" class="pagination">
          <el-pagination
            v-model:current-page="doctorPage"
            :page-size="PAGE_SIZE_DEFAULT"
            :total="adminStore.doctors.total"
            layout="prev, pager, next, total"
            background
            @current-change="loadDoctors"
          />
        </div>
      </el-tab-pane>

      <!-- 预约管理 -->
      <el-tab-pane label="预约管理" name="appointments">
        <div class="filter-row">
          <el-select
            v-model="apptQuery.status"
            placeholder="全部状态"
            clearable
            class="filter-select"
          >
            <el-option :value="0" label="排队中" />
            <el-option :value="1" label="处理中" />
            <el-option :value="2" label="已完成" />
          </el-select>
          <el-input
            v-model="apptQuery.user_id"
            maxlength="50"
            placeholder="按发单用户账号筛选"
            clearable
            class="filter-input"
            @keyup.enter="searchAppointments"
            @clear="searchAppointments"
          />
          <el-button type="primary" @click="searchAppointments">筛选</el-button>
        </div>

        <el-table v-loading="apptLoading" :data="apptList" stripe empty-text="暂无预约">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="问题描述" min-width="220">
            <template #default="{ row }">
              <el-link type="primary" @click="router.push(`/appointments/${row.id}`)">
                {{ row.problemDescription }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="userName" label="发单用户" width="120" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.status === 0 ? 'warning' : row.status === 1 ? 'primary' : 'success'"
              >
                {{ ['排队中', '处理中', '已完成'][row.status] ?? row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="doctorName" label="电医" width="120" />
          <el-table-column prop="createTime" label="创建时间" width="165" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="router.push(`/appointments/${row.id}`)"
                >查看</el-button
              >
              <el-button size="small" type="danger" plain @click="deleteAppointment(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="apptTotal > PAGE_SIZE_DEFAULT" class="pagination">
          <el-pagination
            v-model:current-page="apptPage"
            :page-size="PAGE_SIZE_DEFAULT"
            :total="apptTotal"
            layout="prev, pager, next, total"
            background
            @current-change="loadAppointments"
          />
        </div>
      </el-tab-pane>

      <!-- 分类管理 -->
      <el-tab-pane label="分类管理" name="categories">
        <div class="filter-row">
          <el-input
            v-model="newCategory"
            placeholder="新分类名称"
            class="filter-input"
            maxlength="50"
            @keyup.enter="addCategory"
          />
          <el-button type="primary" @click="addCategory">添加分类</el-button>
        </div>

        <el-table :data="categories" stripe empty-text="暂无分类">
          <el-table-column prop="id" label="ID" width="90" />
          <el-table-column prop="name" label="分类名" min-width="180" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button size="small" type="danger" plain @click="deleteCategory(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- QQ 群号 -->
      <el-tab-pane label="QQ 群号" name="qq">
        <div class="filter-row">
          <el-input v-model="qqGroup" placeholder="QQ 群号" class="filter-input" maxlength="255" />
          <el-button type="primary" :loading="qqSaving" @click="saveQqGroup">保存</el-button>
        </div>
        <el-alert title="群号将展示在「关于我们」页面" type="info" :closable="false" />
      </el-tab-pane>

      <!-- 举报处理（走查建议 #3） -->
      <el-tab-pane label="举报处理" name="reports">
        <div class="filter-row">
          <el-radio-group v-model="reportQuery.status" @change="searchReports">
            <el-radio-button :value="undefined">全部</el-radio-button>
            <el-radio-button :value="REPORT_STATUS.PENDING">待处理</el-radio-button>
            <el-radio-button :value="REPORT_STATUS.HANDLED">已处理</el-radio-button>
          </el-radio-group>
        </div>
        <el-table v-loading="reportLoading" :data="reports" stripe empty-text="暂无举报">
          <el-table-column label="类型" width="80">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.targetType === REPORT_TARGET.APPOINTMENT ? 'primary' : 'warning'"
                effect="plain"
              >
                {{ row.targetType === REPORT_TARGET.APPOINTMENT ? '预约' : '留言' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="targetSummary"
            label="被举报内容"
            min-width="180"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.targetSummary ?? '（内容已删除）' }}
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="举报原因" min-width="160" show-overflow-tooltip />
          <el-table-column prop="reporterId" label="举报人" width="110" />
          <el-table-column prop="createTime" label="举报时间" width="170" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.status === REPORT_STATUS.HANDLED ? 'success' : 'danger'"
                effect="plain"
              >
                {{ row.status === REPORT_STATUS.HANDLED ? '已处理' : '待处理' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.targetType === REPORT_TARGET.APPOINTMENT"
                size="small"
                type="danger"
                plain
                @click="goDeleteAppointment(row)"
              >
                删除预约
              </el-button>
              <el-button
                v-if="row.targetType === REPORT_TARGET.MESSAGE"
                size="small"
                type="danger"
                plain
                @click="goDeleteMessage(row)"
              >
                删除留言
              </el-button>
              <el-button
                v-if="row.status === REPORT_STATUS.PENDING"
                size="small"
                @click="handleReport(row)"
              >
                标记已处理
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="reportTotal > PAGE_SIZE_DEFAULT" class="pagination">
          <el-pagination
            v-model:current-page="reportPage"
            :page-size="PAGE_SIZE_DEFAULT"
            :total="reportTotal"
            layout="prev, pager, next, total"
            background
            @current-change="loadReports"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 重置密码结果弹窗 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="420px" :close-on-click-modal="false">
      <el-alert
        title="新密码仅展示这一次，请复制并转告用户；该用户下次登录将被强制改密"
        type="warning"
        :closable="false"
      />
      <div class="reset-row">
        <el-input :model-value="resetPassword" readonly class="reset-input" />
        <el-button type="primary" plain :disabled="!resetPassword" @click="copyReset">
          复制
        </el-button>
      </div>
      <template #footer>
        <el-button type="primary" @click="resetVisible = false">我已复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page-title {
  margin: 4px 0 16px;
  color: var(--el-color-primary);
}

.filter-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;

  .filter-input {
    width: 220px;
  }

  .filter-select {
    width: 140px;
  }

  @media (max-width: 576px) {
    .filter-input,
    .filter-select {
      width: 100%;
    }
  }
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.reset-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
