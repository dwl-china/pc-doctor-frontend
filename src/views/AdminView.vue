<script setup lang="ts">
/**
 * 管理端（阶段 7 · 8.9）：用户管理 / 电医管理 / 预约管理 / 分类管理 / QQ 群号配置。
 * - 用户管理：搜索、改等级（二次确认）、重置密码（弹窗展示随机密码）、删除
 * - 电医管理：真实列表 + 接单统计（旧版假数据空壳 → 后端 /admin/doctors，#6.2）
 * - 预约管理：全量列表 + 状态/用户筛选 + 删除（旧版空文件 → 真实功能，#6.2）
 * - 分类管理：按 id 删除（修复旧版删错对象，#17）
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useDocStore } from '@/stores/doc'
import { useOrderStore } from '@/stores/order'
import { apiAppointments } from '@/api/appointment'
import {
  apiAdminUpdateAppointmentStatus,
  apiBatchDeleteAppointments,
  apiBatchDeleteCategories,
  apiBatchDeleteUsers,
  apiBatchHandleReports,
  apiBatchUpdateAppointmentStatus,
  apiBatchUpdateUserLevel,
} from '@/api/admin'
import { apiUpload } from '@/api/file'
import { apiDoctors } from '@/api/user'
import BatchResultDialog from '@/components/BatchResultDialog.vue'
import {
  apiAdminReports,
  apiDeleteMessage,
  apiHandleReport,
  REPORT_STATUS,
  REPORT_TARGET,
} from '@/api/report'
import type { ReportItem } from '@/api/report'
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_LABEL,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  SEX_OPTIONS,
  UPLOAD_TYPES,
  USER_LEVEL,
} from '@/constants'
import { resolveFileUrl } from '@/utils/file'
import type {
  AppointmentView,
  BatchFailure,
  BatchResult,
  CategoryItem,
  SiteContentUpdate,
  UserView,
} from '@/types'

const adminStore = useAdminStore()
const docStore = useDocStore()
const orderStore = useOrderStore()
const auth = useAuthStore()
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
    // 搜索框是「账号或昵称」，必须走 keyword；
    // 拆成 user_id + user_name 两个参数会被后端取交集，只有两者都含该串才命中
    keyword: userQuery.keyword || undefined,
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

/* ---------- 改预约状态（契约 §4.3） ---------- */
const statusVisible = ref(false)
const statusTarget = ref<AppointmentView | null>(null)
const statusForm = reactive<{ status: number; doctorId: string }>({
  status: APPOINTMENT_STATUS.QUEUED,
  doctorId: '',
})
const statusSaving = ref(false)
const doctorOptions = ref<{ userId: string; userName: string }[]>([])

/** 选项文案与后端"按状态反推字段"的语义对齐，让管理员知道这一改会动哪些字段 */
const statusHint = computed(() => {
  switch (statusForm.status) {
    case APPOINTMENT_STATUS.QUEUED:
      return '将清空接单电医、接单时间与完成时间，预约回到排队池。'
    case APPOINTMENT_STATUS.PROCESSING:
      return '将写入接单电医与接单时间，并清空完成时间。必须指定电医。'
    default:
      return '将补写完成时间（已有则保留），接单信息不变。'
  }
})

/** 电医下拉数据源：单条弹窗与批量弹窗共用，只加载一次 */
async function ensureDoctorOptions() {
  if (doctorOptions.value.length > 0) return
  try {
    // 公开电医列表，上限 100（契约 §1/§4.2）
    const res = await apiDoctors(1, PAGE_SIZE_MAX)
    doctorOptions.value = res.records.map((d) => ({ userId: d.userId, userName: d.userName }))
  } catch {
    /* 拦截器已提示 */
  }
}

async function openStatus(row: AppointmentView) {
  statusTarget.value = row
  statusForm.status = row.status
  // 后端 non_null 序列化：null 字段不会出现在响应里
  statusForm.doctorId = row.doctorId ?? ''
  statusVisible.value = true
  await ensureDoctorOptions()
}

async function submitStatus() {
  if (!statusTarget.value) return
  if (statusForm.status === APPOINTMENT_STATUS.PROCESSING && !statusForm.doctorId) {
    ElMessage.warning('改为「处理中」必须指定接单电医')
    return
  }
  statusSaving.value = true
  try {
    await apiAdminUpdateAppointmentStatus(statusTarget.value.id, {
      status: statusForm.status,
      doctor_id: statusForm.doctorId || null,
    })
    ElMessage.success('预约状态已更新')
    statusVisible.value = false
    await loadAppointments()
  } catch {
    /* 拦截器已提示（含并发冲突 2003） */
  } finally {
    statusSaving.value = false
  }
}

/* ---------- 页面文字（需求 3，契约 §4.9） ---------- */
const siteForm = reactive<SiteContentUpdate>({
  about_title: '',
  about_body: '',
  faq_items: [],
  qq_notice: '',
  qq_qrcode: '',
  footer_html: '',
  icp_html: '',
})
const siteLoading = ref(false)
const siteSaving = ref(false)
const qrUploading = ref(false)

async function loadSiteContent() {
  siteLoading.value = true
  try {
    await docStore.fetchSiteContent()
    const c = docStore.siteContent
    siteForm.about_title = c.aboutTitle
    siteForm.about_body = c.aboutBody
    siteForm.faq_items = c.faqItems.map((i) => ({ ...i }))
    siteForm.qq_notice = c.qqNotice
    siteForm.qq_qrcode = c.qqQrcode
    siteForm.footer_html = c.footerHtml
    siteForm.icp_html = c.icpHtml
  } catch {
    /* 拦截器已提示 */
  } finally {
    siteLoading.value = false
  }
}

function addFaq() {
  siteForm.faq_items = [...(siteForm.faq_items ?? []), { question: '', answer: '' }]
}

function removeFaq(index: number) {
  siteForm.faq_items = (siteForm.faq_items ?? []).filter((_, i) => i !== index)
}

/** 二维码上传：上传成功即写入表单，需再点保存才落库（与文档模块行为一致） */
async function onQrChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  qrUploading.value = true
  try {
    const res = await apiUpload(raw, UPLOAD_TYPES.notice)
    siteForm.qq_qrcode = res.url
    ElMessage.success('二维码已上传，保存后生效')
  } catch {
    /* 拦截器已提示 */
  } finally {
    qrUploading.value = false
  }
  return false
}

async function saveSiteContent() {
  siteSaving.value = true
  try {
    await docStore.updateSiteContent({
      about_title: siteForm.about_title ?? '',
      about_body: siteForm.about_body ?? '',
      faq_items: (siteForm.faq_items ?? []).filter((i) => i.question.trim() || i.answer.trim()),
      qq_notice: siteForm.qq_notice ?? '',
      // 空串 = 清空二维码（并删除旧文件）
      qq_qrcode: siteForm.qq_qrcode ?? '',
      footer_html: siteForm.footer_html ?? '',
      icp_html: siteForm.icp_html ?? '',
    })
    ElMessage.success('页面文字已保存')
  } catch {
    /* 拦截器已提示 */
  } finally {
    siteSaving.value = false
  }
}

/* ---------- 批量操作（契约 §4.3） ---------- */
const batchVisible = ref(false)
const batchAction = ref('')
const batchTotal = ref(0)
const batchSuccess = ref(0)
const batchFailures = ref<BatchFailure[]>([])
const batchBusy = ref(false)

/** el-table 暴露的实例方法（只需用到清选） */
type SelectableTable = { clearSelection: () => void }

/**
 * 执行后显式清空选中。列表重取虽会因数据数组换新而重置选择，
 * 但那是 el-table 的内部行为，显式清空不依赖它。
 */
function clearSelection(...tables: ({ value?: SelectableTable } | undefined)[]) {
  tables.forEach((t) => t?.value?.clearSelection())
}

/** 全部成功只提示一条，有失败才弹结果弹窗（失败项可能已不在当前页，不适合行内高亮） */
function showBatchResult(action: string, result: BatchResult) {
  if (result.failures.length === 0) {
    ElMessage.success(`${action}完成，成功 ${result.success} 项`)
    return
  }
  batchAction.value = action
  batchTotal.value = result.total
  batchSuccess.value = result.success
  batchFailures.value = result.failures
  batchVisible.value = true
}

/** 二次确认：必须写明部分成功语义，否则管理员会以为失败等于全没执行 */
async function confirmBatch(text: string) {
  try {
    await ElMessageBox.confirm(`${text}\n\n无法处理的项会被跳过并列出原因。`, '批量操作', {
      type: 'warning',
    })
    return true
  } catch {
    return false
  }
}

/**
 * 删除后钳制页码：删空最后一页时 page 会越界，列表变空白。
 * 返回是否需要重新拉取。
 */
function clampPage(pageRef: { value: number }, remaining: number) {
  const maxPage = Math.max(1, Math.ceil(remaining / PAGE_SIZE_DEFAULT))
  if (pageRef.value > maxPage) {
    pageRef.value = maxPage
    return true
  }
  return false
}

/* 用户管理 */
const userTableRef = ref<SelectableTable>()
const selectedUsers = ref<UserView[]>([])
const batchLevel = ref<number>(USER_LEVEL.USER)
/** 自己不能删也不能改角色（后端会拒），直接从可选里挡掉，少一堆无谓失败 */
const userSelectable = (row: UserView) => row.userId !== auth.user?.userId

async function batchChangeLevel() {
  const ids = selectedUsers.value.map((u) => u.userId)
  if (!(await confirmBatch(`把选中的 ${ids.length} 个用户的角色改为「${levelLabel[batchLevel.value]}」？`)))
    return
  batchBusy.value = true
  try {
    showBatchResult('批量改角色', await apiBatchUpdateUserLevel(ids, batchLevel.value))
    clearSelection(userTableRef)
    await loadUsers()
  } catch {
    /* 拦截器已提示 */
  } finally {
    batchBusy.value = false
  }
}

async function batchDeleteUsers() {
  const ids = selectedUsers.value.map((u) => u.userId)
  if (!(await confirmBatch(`确认删除选中的 ${ids.length} 个用户？`))) return
  batchBusy.value = true
  try {
    showBatchResult('批量删除用户', await apiBatchDeleteUsers(ids))
    clearSelection(userTableRef)
    await loadUsers()
    if (clampPage(userPage, adminStore.users.total)) await loadUsers()
  } catch {
    /* 拦截器已提示 */
  } finally {
    batchBusy.value = false
  }
}

/* 预约管理 */
const apptTableRef = ref<SelectableTable>()
const selectedAppts = ref<AppointmentView[]>([])

async function batchDeleteAppointments() {
  const ids = selectedAppts.value.map((a) => a.id)
  if (!(await confirmBatch(`确认删除选中的 ${ids.length} 条预约？留言与图片会一并清理。`))) return
  batchBusy.value = true
  try {
    showBatchResult('批量删除预约', await apiBatchDeleteAppointments(ids))
    clearSelection(apptTableRef)
    await loadAppointments()
    if (clampPage(apptPage, apptTotal.value)) await loadAppointments()
  } catch {
    /* 拦截器已提示 */
  } finally {
    batchBusy.value = false
  }
}

/* 批量改状态：复用单条弹窗的形态，作用对象从"一行"换成"选中的 N 行" */
const batchStatusVisible = ref(false)
const batchStatusForm = reactive<{ status: number; doctorId: string }>({
  status: APPOINTMENT_STATUS.QUEUED,
  doctorId: '',
})

function openBatchStatus() {
  batchStatusForm.status = APPOINTMENT_STATUS.QUEUED
  batchStatusForm.doctorId = ''
  batchStatusVisible.value = true
  ensureDoctorOptions()
}

/** status=2 不会自动补电医：把排队中的单直接标成已完成会得到工作台看不到的僵尸单 */
const batchStatusHint = computed(() => {
  const rows = selectedAppts.value
  switch (batchStatusForm.status) {
    case APPOINTMENT_STATUS.QUEUED:
      return `${rows.length} 条预约将回到排队中，接单电医与两个时间戳一并清空。`
    case APPOINTMENT_STATUS.PROCESSING:
      return `${rows.length} 条预约将全部指派给所选电医（必选）。`
    default:
      return rows.some((r) => r.status === APPOINTMENT_STATUS.QUEUED)
        ? `${rows.length} 条预约将标记为已完成；其中排队中的单不会自动补电医。`
        : `${rows.length} 条预约将标记为已完成，并补写完成时间。`
  }
})

async function submitBatchStatus() {
  if (batchStatusForm.status === APPOINTMENT_STATUS.PROCESSING && !batchStatusForm.doctorId) {
    ElMessage.warning('改为「处理中」必须指定接单电医')
    return
  }
  const ids = selectedAppts.value.map((a) => a.id)
  if (!(await confirmBatch(`对选中的 ${ids.length} 条预约执行状态变更？`))) return
  batchBusy.value = true
  try {
    showBatchResult(
      '批量改状态',
      await apiBatchUpdateAppointmentStatus(ids, {
        status: batchStatusForm.status,
        doctor_id: batchStatusForm.doctorId || null,
      }),
    )
    batchStatusVisible.value = false
    clearSelection(apptTableRef)
    await loadAppointments()
  } catch {
    /* 拦截器已提示 */
  } finally {
    batchBusy.value = false
  }
}

/* 分类管理 */
const categoryTableRef = ref<SelectableTable>()
const selectedCategories = ref<CategoryItem[]>([])

async function batchDeleteCategories() {
  const ids = selectedCategories.value.map((c) => c.id)
  if (!(await confirmBatch(`确认删除选中的 ${ids.length} 个分类？`))) return
  batchBusy.value = true
  try {
    showBatchResult('批量删除分类', await apiBatchDeleteCategories(ids))
    clearSelection(categoryTableRef)
    await loadCategories()
  } catch {
    /* 拦截器已提示 */
  } finally {
    batchBusy.value = false
  }
}

/* 举报处理 */
const reportTableRef = ref<SelectableTable>()
const selectedReports = ref<ReportItem[]>([])
/** 标记已处理非幂等：已处理的举报会被后端拒，直接从可选里挡掉 */
const reportSelectable = (row: ReportItem) => row.status === REPORT_STATUS.PENDING

async function batchHandleReports() {
  const ids = selectedReports.value.map((r) => r.id)
  if (!(await confirmBatch(`把选中的 ${ids.length} 条举报标记为已处理？`))) return
  batchBusy.value = true
  try {
    showBatchResult('批量处理举报', await apiBatchHandleReports(ids))
    clearSelection(reportTableRef)
    await loadReports()
    if (clampPage(reportPage, reportTotal.value)) await loadReports()
  } catch {
    /* 拦截器已提示 */
  } finally {
    batchBusy.value = false
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
    // 后端在删除后会自动把该预约（及其下留言）的相关举报置为已处理
    await ElMessageBox.confirm(
      `确认删除举报的预约 #${row.targetId}？操作不可恢复；该预约相关的举报将一并标记为已处理。`,
      '删除预约',
      { type: 'warning' },
    )
    await orderStore.remove(row.targetId)
    ElMessage.success('预约已删除，相关举报已标记为已处理')
    await loadReports()
  } catch (e) {
    if (e instanceof Error) return
  }
}

async function goDeleteMessage(row: ReportItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除举报的留言 #${row.targetId}？操作不可恢复；该留言的举报将一并标记为已处理。`,
      '删除留言',
      { type: 'warning' },
    )
    await apiDeleteMessage(row.targetId)
    ElMessage.success('留言已删除，相关举报已标记为已处理')
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
  loadSiteContent().catch(() => undefined)
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

        <div v-if="selectedUsers.length" class="batch-bar">
          <span class="batch-count">已选 {{ selectedUsers.length }} 项（仅当前页）</span>
          <el-select v-model="batchLevel" size="small" class="batch-select">
            <el-option :value="USER_LEVEL.USER" label="普通用户" />
            <el-option :value="USER_LEVEL.DOCTOR" label="电医" />
            <el-option :value="USER_LEVEL.ADMIN" label="管理员" />
          </el-select>
          <el-button size="small" type="primary" :loading="batchBusy" @click="batchChangeLevel">
            批量改角色
          </el-button>
          <el-button size="small" type="danger" plain :loading="batchBusy" @click="batchDeleteUsers">
            批量删除
          </el-button>
        </div>

        <el-table
          ref="userTableRef"
          :data="adminStore.users.records"
          stripe
          empty-text="暂无用户"
          @selection-change="(rows: UserView[]) => (selectedUsers = rows)"
        >
          <el-table-column type="selection" width="46" :selectable="userSelectable" />
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

        <div v-if="selectedAppts.length" class="batch-bar">
          <span class="batch-count">已选 {{ selectedAppts.length }} 项（仅当前页）</span>
          <el-button size="small" type="primary" :loading="batchBusy" @click="openBatchStatus">
            批量改状态
          </el-button>
          <el-button
            size="small"
            type="danger"
            plain
            :loading="batchBusy"
            @click="batchDeleteAppointments"
          >
            批量删除
          </el-button>
        </div>

        <el-table
          ref="apptTableRef"
          v-loading="apptLoading"
          :data="apptList"
          stripe
          empty-text="暂无预约"
          @selection-change="(rows: AppointmentView[]) => (selectedAppts = rows)"
        >
          <el-table-column type="selection" width="46" />
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
                :type="
                  row.status === APPOINTMENT_STATUS.QUEUED
                    ? 'warning'
                    : row.status === APPOINTMENT_STATUS.PROCESSING
                      ? 'primary'
                      : 'success'
                "
              >
                {{ APPOINTMENT_STATUS_LABEL[row.status] ?? row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="doctorName" label="电医" width="120" />
          <el-table-column prop="createTime" label="创建时间" width="165" />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="router.push(`/appointments/${row.id}`)"
                >查看</el-button
              >
              <el-button size="small" type="primary" plain @click="openStatus(row)"
                >改状态</el-button
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

        <div v-if="selectedCategories.length" class="batch-bar">
          <span class="batch-count">已选 {{ selectedCategories.length }} 项</span>
          <el-button
            size="small"
            type="danger"
            plain
            :loading="batchBusy"
            @click="batchDeleteCategories"
          >
            批量删除
          </el-button>
        </div>

        <el-table
          ref="categoryTableRef"
          :data="categories"
          stripe
          empty-text="暂无分类"
          @selection-change="(rows: CategoryItem[]) => (selectedCategories = rows)"
        >
          <el-table-column type="selection" width="46" />
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

      <!-- 页面文字（需求 3）：关于我们 / 使用帮助 / 交流群 -->
      <el-tab-pane label="页面文字" name="texts">
        <div v-loading="siteLoading" class="site-texts">
          <el-alert
            title="这里的文字直接展示在前台页面；正文与问答答案支持 Markdown（**加粗**、- 列表等）。"
            type="info"
            :closable="false"
            class="tip"
          />

          <h4 class="group-title">关于我们</h4>
          <el-form label-width="80px">
            <el-form-item label="标题">
              <el-input v-model="siteForm.about_title" maxlength="100" show-word-limit />
            </el-form-item>
            <el-form-item label="正文">
              <el-input
                v-model="siteForm.about_body"
                type="textarea"
                :rows="5"
                maxlength="5000"
                show-word-limit
              />
            </el-form-item>
          </el-form>

          <h4 class="group-title">使用帮助（问答）</h4>
          <div v-for="(item, index) in siteForm.faq_items ?? []" :key="index" class="faq-row">
            <div class="faq-head">
              <span class="faq-index">第 {{ index + 1 }} 条</span>
              <el-button size="small" type="danger" plain @click="removeFaq(index)">
                删除
              </el-button>
            </div>
            <el-input
              v-model="item.question"
              placeholder="问题"
              maxlength="100"
              show-word-limit
              class="faq-question"
            />
            <el-input
              v-model="item.answer"
              type="textarea"
              :rows="3"
              placeholder="答案（支持 Markdown）"
              maxlength="1000"
              show-word-limit
            />
          </div>
          <el-button :disabled="(siteForm.faq_items?.length ?? 0) >= 15" @click="addFaq">
            添加一条问答
          </el-button>

          <h4 class="group-title">交流群</h4>
          <el-form label-width="80px">
            <el-form-item label="群号">
              <el-input v-model="qqGroup" placeholder="QQ 群号" class="filter-input" maxlength="255" />
              <el-button type="primary" :loading="qqSaving" @click="saveQqGroup">保存群号</el-button>
            </el-form-item>
            <el-form-item label="群说明">
              <el-input
                v-model="siteForm.qq_notice"
                type="textarea"
                :rows="2"
                maxlength="500"
                show-word-limit
                placeholder="可用 {qq_group} 占位符自动填入群号"
              />
            </el-form-item>
            <el-form-item label="群二维码">
              <div class="qr-block">
                <el-image
                  v-if="siteForm.qq_qrcode"
                  :src="resolveFileUrl(siteForm.qq_qrcode)"
                  fit="contain"
                  class="qr-image"
                />
                <div class="qr-actions">
                  <el-upload
                    :auto-upload="false"
                    :show-file-list="false"
                    accept="image/*"
                    :disabled="qrUploading"
                    :on-change="onQrChange"
                  >
                    <el-button :loading="qrUploading" plain>
                      {{ qrUploading ? '上传中…' : '上传二维码' }}
                    </el-button>
                  </el-upload>
                  <el-button v-if="siteForm.qq_qrcode" link @click="siteForm.qq_qrcode = ''">
                    移除
                  </el-button>
                </div>
              </div>
            </el-form-item>
          </el-form>

          <!-- 这两栏的 label-width 比上面的 80px 宽：'自定义内容' 5 个字在 80px 下会被挤成两行 -->
          <h4 class="group-title">备案号</h4>
          <el-form label-width="92px">
            <el-form-item label="内容">
              <el-input
                v-model="siteForm.icp_html"
                type="textarea"
                :rows="2"
                maxlength="1000"
                show-word-limit
                placeholder='粘贴 HTML，独占页脚上方一行显示，例如：&#10;<a href="https://beian.miit.gov.cn/" target="_blank">浙ICP备XXXXXXXX号</a>'
              />
            </el-form-item>
          </el-form>

          <h4 class="group-title">页脚</h4>
          <el-form label-width="92px">
            <el-form-item label="自定义内容">
              <el-input
                v-model="siteForm.footer_html"
                type="textarea"
                :rows="3"
                maxlength="1000"
                show-word-limit
                placeholder='直接粘贴 HTML，与站名、交流群显示在同一行，例如：&#10;<a href="https://icp.gov.moe/?keyword=20261911" target="_blank">萌ICP备20261911号</a>'
              />
            </el-form-item>
          </el-form>
          <el-alert
            title="备案号与页脚互不影响，各自单独改。按钮、链接等常用标签正常显示；script、事件属性（onerror 等）会被自动过滤掉。填完保存即全站生效，不用重新发版。"
            type="info"
            :closable="false"
            class="tip"
          />

          <el-button type="primary" :loading="siteSaving" @click="saveSiteContent">
            保存页面文字
          </el-button>
        </div>
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
        <div v-if="selectedReports.length" class="batch-bar">
          <span class="batch-count">已选 {{ selectedReports.length }} 项（仅待处理的可选）</span>
          <el-button size="small" type="primary" :loading="batchBusy" @click="batchHandleReports">
            批量标记已处理
          </el-button>
        </div>

        <el-table
          ref="reportTableRef"
          v-loading="reportLoading"
          :data="reports"
          stripe
          empty-text="暂无举报"
          @selection-change="(rows: ReportItem[]) => (selectedReports = rows)"
        >
          <el-table-column type="selection" width="46" :selectable="reportSelectable" />
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
    <!-- 改预约状态（契约 §4.3） -->
    <el-dialog
      v-model="statusVisible"
      :title="`修改预约状态 #${statusTarget?.id ?? ''}`"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px">
        <el-form-item label="当前状态">
          <el-tag size="small">
            {{ statusTarget ? (APPOINTMENT_STATUS_LABEL[statusTarget.status] ?? '') : '' }}
          </el-tag>
        </el-form-item>
        <el-form-item label="改为">
          <el-radio-group v-model="statusForm.status">
            <el-radio-button :value="APPOINTMENT_STATUS.QUEUED">排队中</el-radio-button>
            <el-radio-button :value="APPOINTMENT_STATUS.PROCESSING">处理中</el-radio-button>
            <el-radio-button :value="APPOINTMENT_STATUS.DONE">已完成</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          v-if="statusForm.status !== APPOINTMENT_STATUS.QUEUED"
          label="接单电医"
        >
          <el-select
            v-model="statusForm.doctorId"
            filterable
            clearable
            placeholder="选择电医"
            class="doctor-select"
          >
            <el-option
              v-for="d in doctorOptions"
              :key="d.userId"
              :value="d.userId"
              :label="`${d.userName}（${d.userId}）`"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <el-alert :title="statusHint" type="warning" :closable="false" />
      <template #footer>
        <el-button @click="statusVisible = false">取消</el-button>
        <el-button type="primary" :loading="statusSaving" @click="submitStatus">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量改预约状态（契约 §4.3） -->
    <el-dialog
      v-model="batchStatusVisible"
      :title="`批量修改预约状态（${selectedAppts.length} 条）`"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px">
        <el-form-item label="改为">
          <el-radio-group v-model="batchStatusForm.status">
            <el-radio-button :value="APPOINTMENT_STATUS.QUEUED">排队中</el-radio-button>
            <el-radio-button :value="APPOINTMENT_STATUS.PROCESSING">处理中</el-radio-button>
            <el-radio-button :value="APPOINTMENT_STATUS.DONE">已完成</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="batchStatusForm.status !== APPOINTMENT_STATUS.QUEUED" label="接单电医">
          <el-select
            v-model="batchStatusForm.doctorId"
            filterable
            clearable
            placeholder="整批指派给该电医"
            class="doctor-select"
          >
            <el-option
              v-for="d in doctorOptions"
              :key="d.userId"
              :value="d.userId"
              :label="`${d.userName}（${d.userId}）`"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <el-alert :title="batchStatusHint" type="warning" :closable="false" />
      <template #footer>
        <el-button @click="batchStatusVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchBusy" @click="submitBatchStatus">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量结果（四个 tab 共用） -->
    <BatchResultDialog
      v-model="batchVisible"
      :action="batchAction"
      :total="batchTotal"
      :success="batchSuccess"
      :failures="batchFailures"
    />

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

/* 页面文字 tab */
.site-texts {
  max-width: 760px;

  .group-title {
    margin: 24px 0 12px;
    padding-left: 8px;
    border-left: 3px solid var(--el-color-primary);
    color: var(--el-text-color-primary);
  }

  .faq-row {
    margin-bottom: 16px;
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;

    .faq-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      .faq-index {
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }

    .faq-question {
      margin-bottom: 8px;
    }
  }

  .qr-block {
    display: flex;
    align-items: flex-start;
    gap: 12px;

    .qr-image {
      width: 120px;
      height: 120px;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 6px;
    }

    .qr-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }
  }
}

.doctor-select {
  width: 100%;
}

/* 批量操作工具条：有选中项时才出现 */
.batch-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 6px;
  background: var(--el-color-primary-light-9);

  .batch-count {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .batch-select {
    width: 130px;
  }
}
</style>
