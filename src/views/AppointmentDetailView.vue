<script setup lang="ts">
/**
 * 预约详情（阶段 7 · 8.4）。
 * - 状态步骤条 + 分角色提示 + 预约信息 + 接单电医 + 消息评论（恢复旧版被注释的 UI，#20）
 * - 操作权限与后端契约 §4.4 对齐：接单=电医(排队单)、完成=接单者本人、撤销=本人(未接单)、删除=管理员
 * - 公开详情联系信息已由后端脱敏（#7）
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useOrderStore } from '@/stores/order'
import { useAuthStore } from '@/stores/auth'
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_LABEL } from '@/constants'
import { resolveFileUrl } from '@/utils/file'
import { apiDeleteMessage, apiReport, REPORT_TARGET } from '@/api/report'
import type { AppointmentView, MessageView } from '@/types'

const route = useRoute()
const router = useRouter()
const order = useOrderStore()
const auth = useAuthStore()

const id = Number(route.params.id)
const appointment = ref<AppointmentView | null>(null)
const messages = ref<MessageView[]>([])
const loading = ref(true)

/** 本人 / 接单电医 / 管理员 */
const isOwner = computed(() => auth.isLoggedIn && appointment.value?.userId === auth.user?.userId)
const isDoctor = computed(() => auth.isDoctor)
const isAdmin = computed(() => auth.isAdmin)
const isAcceptedDoctor = computed(
  () => auth.isDoctor && appointment.value?.doctorId === auth.user?.userId,
)

async function load() {
  loading.value = true
  try {
    appointment.value = await order.detail(id)
    messages.value = await order.messages(id)
  } catch {
    /* 拦截器已提示（含 404） */
  } finally {
    loading.value = false
  }
}

/** 接单 */
async function accept() {
  try {
    await ElMessageBox.confirm('确认接单？接单后请及时处理。', '接单', { type: 'info' })
    await order.accept(id)
    ElMessage.success('已成功接单')
    await load()
  } catch (e) {
    /* 取消弹窗或业务错误（拦截器已提示） */
    if (e instanceof Error) return
  }
}

/** 完成 */
async function complete() {
  try {
    await ElMessageBox.confirm('确认该预约已完成？', '完成预约', { type: 'info' })
    await order.complete(id)
    ElMessage.success('预约已完成')
    await load()
  } catch (e) {
    if (e instanceof Error) return
  }
}

/** 撤销 / 删除（本人未接单可撤销；管理员任意状态可删除） */
async function remove(verb: string) {
  try {
    await ElMessageBox.confirm(`确认${verb}该预约？操作不可恢复。`, verb, { type: 'warning' })
    await order.remove(id)
    ElMessage.success(`已${verb}预约`)
    router.push('/')
  } catch (e) {
    if (e instanceof Error) return
  }
}

function statusStep(status: number) {
  // el-steps active：排队中=0、处理中=1、已完成=2
  return status
}

/** 消息发送 */
const draft = ref('')
const sending = ref(false)

async function sendMessage() {
  const text = draft.value.trim()
  if (!text) {
    ElMessage.warning('消息不能为空')
    return
  }
  sending.value = true
  try {
    await order.postMessage(id, text)
    draft.value = ''
    messages.value = await order.messages(id)
  } catch {
    /* 拦截器已提示 */
  } finally {
    sending.value = false
  }
}

/** ---------- 举报（走查建议 #3） ---------- */
const reportVisible = ref(false)
const reportTarget = ref<{ type: number; id: number }>({ type: 0, id: 0 })
const reportReason = ref('')
const reporting = ref(false)

function openReport(type: number, id: number) {
  if (!auth.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  reportTarget.value = { type, id }
  reportReason.value = ''
  reportVisible.value = true
}

async function submitReport() {
  const reason = reportReason.value.trim()
  if (!reason) {
    ElMessage.warning('请填写举报原因')
    return
  }
  reporting.value = true
  try {
    await apiReport({
      target_type: reportTarget.value.type,
      target_id: reportTarget.value.id,
      reason,
    })
    ElMessage.success('举报已提交，管理员会尽快处理')
    reportVisible.value = false
  } catch {
    /* 拦截器已提示 */
  } finally {
    reporting.value = false
  }
}

/** ---------- 留言删除（本人自己发的 / 电医 / 管理员） ---------- */
function canDeleteMessage(msg: MessageView) {
  return auth.isAdmin || auth.isDoctor || (auth.isLoggedIn && msg.userId === auth.user?.userId)
}

async function removeMessage(msg: MessageView) {
  try {
    await ElMessageBox.confirm('确认删除该留言？操作不可恢复。', '删除留言', { type: 'warning' })
    await apiDeleteMessage(msg.id)
    ElMessage.success('留言已删除')
    messages.value = await order.messages(id)
  } catch (e) {
    if (e instanceof Error) return
  }
}

onMounted(load)
</script>

<template>
  <div class="detail-page">
    <el-skeleton v-if="loading" :rows="8" animated />
    <template v-else-if="appointment">
      <el-card class="main-card">
        <!-- 状态步骤条 -->
        <el-steps
          :active="statusStep(appointment.status)"
          finish-status="success"
          align-center
          class="steps"
        >
          <el-step :title="APPOINTMENT_STATUS_LABEL[APPOINTMENT_STATUS.QUEUED]" />
          <el-step :title="APPOINTMENT_STATUS_LABEL[APPOINTMENT_STATUS.PROCESSING]" />
          <el-step :title="APPOINTMENT_STATUS_LABEL[APPOINTMENT_STATUS.DONE]" />
        </el-steps>

        <!-- 分角色提示 -->
        <el-alert
          v-if="
            appointment.status === APPOINTMENT_STATUS.QUEUED && !isOwner && !isDoctor && !isAdmin
          "
          title="该预约不属于你哦，仅供预览"
          type="info"
          :closable="false"
          class="tip"
        />
        <el-alert
          v-if="appointment.status === APPOINTMENT_STATUS.QUEUED && isOwner"
          title="已创建预约，等待电医接单"
          type="success"
          :closable="false"
          class="tip"
        />
        <el-alert
          v-if="appointment.status === APPOINTMENT_STATUS.QUEUED && isDoctor"
          title="电脑医生请合理安排，适量接单"
          type="warning"
          :closable="false"
          class="tip"
        />
        <el-alert
          v-if="appointment.status === APPOINTMENT_STATUS.DONE"
          title="该预约已完成！"
          type="success"
          :closable="false"
          class="tip"
        />

        <!-- 预约信息 -->
        <h3 class="section-title">📬 预约信息</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="问题描述">
            <span class="problem-text">{{ appointment.problemDescription }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="问题分类">
            <el-tag size="small" type="primary" effect="plain">
              {{ appointment.categoryName ?? '未分类' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="appointment.availableTime" label="期望时间">
            {{ appointment.availableTime }}
          </el-descriptions-item>
          <el-descriptions-item v-if="appointment.appointmentLocation" label="期望地点">
            {{ appointment.appointmentLocation }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ appointment.createTime }}</el-descriptions-item>
          <el-descriptions-item v-if="isOwner || isDoctor || isAdmin" label="预约人">
            {{ appointment.userName || appointment.userId }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 问题图片 -->
        <div v-if="appointment.problemPicture" class="picture-block">
          <el-image
            :src="resolveFileUrl(appointment.problemPicture)"
            fit="cover"
            class="problem-image"
            :preview-src-list="[resolveFileUrl(appointment.problemPicture)]"
            preview-teleported
          />
        </div>

        <!-- 接单电医 -->
        <template v-if="appointment.status > APPOINTMENT_STATUS.QUEUED && appointment.doctorName">
          <h3 class="section-title">接单电医</h3>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="电医">
              {{ appointment.doctorName }}
            </el-descriptions-item>
            <el-descriptions-item v-if="appointment.appointmentTime" label="接单时间">
              {{ appointment.appointmentTime }}
            </el-descriptions-item>
            <el-descriptions-item v-if="appointment.doneTime" label="完成时间">
              {{ appointment.doneTime }}
            </el-descriptions-item>
          </el-descriptions>
        </template>

        <!-- 操作按钮（权限与契约 §4.4 / §5 权限矩阵对齐） -->
        <div class="actions">
          <el-button
            v-if="auth.isLoggedIn && !isOwner"
            plain
            type="warning"
            @click="openReport(REPORT_TARGET.APPOINTMENT, appointment.id)"
          >
            举报
          </el-button>
          <el-button
            v-if="appointment.status === APPOINTMENT_STATUS.QUEUED && isDoctor"
            type="primary"
            @click="accept"
          >
            接单
          </el-button>
          <el-button
            v-if="appointment.status === APPOINTMENT_STATUS.PROCESSING && isAcceptedDoctor"
            type="success"
            @click="complete"
          >
            预约完成
          </el-button>
          <el-button
            v-if="appointment.status === APPOINTMENT_STATUS.QUEUED && isOwner"
            type="danger"
            plain
            @click="remove('撤销')"
          >
            撤销
          </el-button>
          <el-button v-if="isAdmin || isAcceptedDoctor" type="danger" plain @click="remove('删除')">
            删除
          </el-button>
          <el-button @click="router.back()">返回</el-button>
        </div>
      </el-card>

      <!-- 消息评论（恢复旧版被注释的 UI，#20） -->
      <el-card class="message-card">
        <h3 class="section-title">💬 预约消息</h3>
        <div v-if="messages.length > 0" class="message-list">
          <div v-for="msg in messages" :key="msg.id" class="message-item">
            <div class="message-head">
              <span class="message-user">{{ msg.userName || msg.userId }}</span>
              <span class="message-time">{{ msg.time }}</span>
              <span class="message-ops">
                <el-link
                  v-if="auth.isLoggedIn && msg.userId !== auth.user?.userId"
                  type="warning"
                  class="message-op"
                  @click="openReport(REPORT_TARGET.MESSAGE, msg.id)"
                >
                  举报
                </el-link>
                <el-link
                  v-if="canDeleteMessage(msg)"
                  type="danger"
                  class="message-op"
                  @click="removeMessage(msg)"
                >
                  删除
                </el-link>
              </span>
            </div>
            <div class="message-body">{{ msg.message }}</div>
            <el-image
              v-if="msg.picture"
              :src="resolveFileUrl(msg.picture)"
              fit="cover"
              class="message-picture"
              :preview-src-list="[resolveFileUrl(msg.picture)]"
              preview-teleported
            />
          </div>
        </div>
        <el-empty v-else description="暂无消息" :image-size="60" />

        <div v-if="auth.isLoggedIn" class="message-input">
          <el-input
            v-model="draft"
            type="textarea"
            :rows="2"
            maxlength="500"
            placeholder="输入消息，与预约方沟通"
          />
          <el-button type="primary" :loading="sending" class="send-btn" @click="sendMessage">
            发送
          </el-button>
          <p class="policy-hint">请勿发布违法、违规或不良信息，违规内容将被删除</p>
        </div>
        <el-alert v-else title="登录后可发送消息" type="info" :closable="false" class="tip" />
      </el-card>

      <!-- 举报弹窗（走查建议 #3） -->
      <el-dialog v-model="reportVisible" title="举报内容" width="420px" destroy-on-close>
        <el-input
          v-model="reportReason"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          placeholder="请描述举报原因（违法信息、不良内容等）"
        />
        <template #footer>
          <el-button @click="reportVisible = false">取消</el-button>
          <el-button type="primary" :loading="reporting" @click="submitReport">提交举报</el-button>
        </template>
      </el-dialog>
    </template>

    <el-empty v-else description="预约不存在或已删除">
      <el-button @click="router.push('/')">回到首页</el-button>
    </el-empty>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.steps {
  margin-bottom: 16px;
}

.tip {
  margin-bottom: 12px;
}

.section-title {
  margin: 20px 0 12px;

  &:first-of-type {
    margin-top: 4px;
  }
}

.problem-text {
  font-weight: 600;
}

.picture-block {
  margin-top: 12px;

  .problem-image {
    width: 100%;
    max-width: 480px;
    height: auto;
    max-height: 320px;
    border-radius: 8px;
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 24px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.message-item {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);

  .message-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;

    .message-user {
      font-weight: 600;
      font-size: 13px;
      margin-right: auto;
    }

    .message-time {
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }

    .message-ops {
      display: flex;
      gap: 8px;

      .message-op {
        font-size: 12px;
      }
    }
  }

  .message-body {
    font-size: 14px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .message-picture {
    margin-top: 8px;
    max-width: 240px;
    max-height: 180px;
    border-radius: 6px;
  }
}

.message-input {
  display: flex;
  gap: 8px;
  align-items: flex-end;

  .send-btn {
    flex-shrink: 0;
  }
}
.policy-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin: 6px 0 0;
}
</style>
