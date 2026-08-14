<script setup lang="ts">
/**
 * 三步预约表单（阶段 7 · 8.3）。
 * 步骤 1：问题描述 + 分类；步骤 2：期望时间 + 地点（推荐多选 + 其他）；步骤 3：图片压缩上传 + 确认提交。
 * - 校验与后端 AppointmentSubmitRequest 对齐（描述 ≤2000 必填、分类必选、时间/地点 ≤255）
 * - 图片前端 canvas 压缩（长边 1280、jpeg 质量递减到 ≤1MB）后走 /api/files（#5 白名单由后端兜底）
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import { useOrderStore } from '@/stores/order'
import { useAuthStore } from '@/stores/auth'
import { apiCategories } from '@/api/content'
import { apiUpload } from '@/api/file'
import { UPLOAD_MAX_MB, UPLOAD_TYPES } from '@/constants'
import { resolveFileUrl } from '@/utils/file'
import type { CategoryItem } from '@/types'

const order = useOrderStore()
const auth = useAuthStore()
const router = useRouter()

const step = ref(0)
const submitting = ref(false)
const categories = ref<CategoryItem[]>([])

/** 推荐时间/地点（沿用旧版选项） */
const TIME_PRESETS = ['周三下午', '周末'] as const
const LOCATION_PRESETS = ['师生之家', '行云/流水外场', '钱江湾29栋一楼', '钱江湾39栋一楼'] as const

const form = reactive({
  problem_description: '',
  category_id: undefined as number | undefined,
  expectedTime: [] as string[],
  otherTime: '',
  expectedLocation: [] as string[],
  otherLocation: '',
  problem_picture: '',
})

/** 期望时间/地点 = 推荐项 + 其他输入，用 / 拼接（对齐旧版格式） */
const available_time = computed(() => {
  const parts = [...form.expectedTime, form.otherTime.trim()].filter(Boolean)
  return parts.join('/')
})
const appointment_location = computed(() => {
  const parts = [...form.expectedLocation, form.otherLocation.trim()].filter(Boolean)
  return parts.join('/')
})

function step1Valid(): string | null {
  if (!form.problem_description.trim()) return '请描述你遇到的问题'
  if (form.problem_description.length > 2000) return '问题描述最长 2000 字'
  if (form.category_id === undefined) return '请选择问题分类'
  return null
}

function step2Valid(): string | null {
  if (!available_time.value) return '请选择期望时间（或填写其他时间）'
  if (!appointment_location.value) return '请选择期望地点（或填写其他地点）'
  return null
}

function next() {
  const error = step.value === 0 ? step1Valid() : step.value === 1 ? step2Valid() : null
  if (error) {
    ElMessage.warning(error)
    return
  }
  step.value += 1
}

/** 图片校验（扩展名白名单 + 大小上限，与 constants 对齐） */
function validateImage(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['jpg', 'jpeg', 'png'].includes(ext)) return '仅支持 jpg/jpeg/png 图片'
  if (file.size > UPLOAD_MAX_MB * 1024 * 1024) return `图片不能超过 ${UPLOAD_MAX_MB}MB`
  return null
}

/** canvas 压缩：长边缩到 1280px，jpeg 质量逐级下调直到 ≤1MB */
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const MAX_EDGE = 1280
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      const tryExport = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('图片处理失败'))
            if (blob.size > 1024 * 1024 && quality > 0.3) tryExport(quality - 0.15)
            else resolve(blob)
          },
          'image/jpeg',
          quality,
        )
      }
      tryExport(0.9)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片读取失败'))
    }
    img.src = objectUrl
  })
}

const uploading = ref(false)

/** 上传成功回调：压缩 → 上传 → 回填表单（单图，重复上传覆盖） */
async function onUploadChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  const error = validateImage(raw)
  if (error) {
    ElMessage.warning(error)
    return
  }
  uploading.value = true
  try {
    const blob = await compressImage(raw)
    const res = await apiUpload(
      new File([blob], 'compress.jpg', { type: 'image/jpeg' }),
      UPLOAD_TYPES.appointment,
    )
    form.problem_picture = res.url
    ElMessage.success('图片上传成功')
  } catch {
    /* 拦截器已提示 */
  } finally {
    uploading.value = false
  }
}

function removeImage() {
  form.problem_picture = ''
}

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const appointment = await order.submit({
      problem_description: form.problem_description.trim(),
      category_id: form.category_id!,
      problem_picture: form.problem_picture || undefined,
      available_time: available_time.value || undefined,
      appointment_location: appointment_location.value || undefined,
    })
    ElMessage.success('提交成功🎉 请耐心等待电医接单')
    router.replace(`/appointments/${appointment.id}`)
  } catch {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!auth.isLoggedIn) return // 路由守卫已拦截，兜底
  try {
    categories.value = await apiCategories()
  } catch {
    /* 拦截器已提示 */
  }
})
</script>

<template>
  <div class="submit-page">
    <el-card>
      <h2 class="page-title">提交预约</h2>

      <el-steps :active="step" finish-status="success" align-center class="steps">
        <el-step title="问题描述" />
        <el-step title="时间地点" />
        <el-step title="图片与提交" />
      </el-steps>

      <div class="step-body">
        <!-- 步骤 1：问题描述 + 分类 -->
        <template v-if="step === 0">
          <el-form label-position="top">
            <el-form-item label="🤔 问题描述" required>
              <el-input
                v-model="form.problem_description"
                type="textarea"
                :rows="6"
                maxlength="2000"
                show-word-limit
                placeholder="描述你遇到的问题（最多 2000 字）"
              />
              <div class="policy-hint">请勿发布违法、违规或不良信息，违规内容将被删除</div>
            </el-form-item>
            <el-form-item label="🏷 问题分类" required>
              <el-radio-group v-model="form.category_id">
                <el-radio-button v-for="cate in categories" :key="cate.id" :value="cate.id">
                  {{ cate.name }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
        </template>

        <!-- 步骤 2：时间 + 地点 -->
        <template v-else-if="step === 1">
          <el-form label-position="top">
            <el-form-item label="📅 期望时间" required>
              <el-checkbox-group v-model="form.expectedTime">
                <el-checkbox v-for="t in TIME_PRESETS" :key="t" :value="t">
                  {{ t }}
                </el-checkbox>
              </el-checkbox-group>
              <el-input
                v-model="form.otherTime"
                class="other-input"
                maxlength="255"
                placeholder="其他时间（选填，选择推荐时间能更快被接单）"
              />
            </el-form-item>
            <el-form-item label="🌏 期望地点" required>
              <el-checkbox-group v-model="form.expectedLocation">
                <el-checkbox v-for="l in LOCATION_PRESETS" :key="l" :value="l">
                  {{ l }}
                </el-checkbox>
              </el-checkbox-group>
              <el-input
                v-model="form.otherLocation"
                class="other-input"
                maxlength="255"
                placeholder="其他地点（选填）"
              />
            </el-form-item>
          </el-form>
        </template>

        <!-- 步骤 3：图片 + 确认 -->
        <template v-else>
          <div class="confirm-summary">
            <h3 class="summary-title">请确认预约信息</h3>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="问题描述">
                {{ form.problem_description }}
              </el-descriptions-item>
              <el-descriptions-item label="问题分类">
                {{ categories.find((c) => c.id === form.category_id)?.name }}
              </el-descriptions-item>
              <el-descriptions-item label="期望时间">{{ available_time }}</el-descriptions-item>
              <el-descriptions-item label="期望地点">{{
                appointment_location
              }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <el-form label-position="top" class="upload-form">
            <el-form-item label="🖼 问题图片（选填，最多 1 张）">
              <div class="upload-row">
                <el-upload
                  v-if="!form.problem_picture"
                  :show-file-list="false"
                  :auto-upload="false"
                  accept=".jpg,.jpeg,.png"
                  :on-change="onUploadChange"
                  :disabled="uploading"
                >
                  <el-button :loading="uploading" :icon="Plus">
                    {{ uploading ? '压缩上传中…' : '选择图片' }}
                  </el-button>
                </el-upload>
                <template v-else>
                  <el-image
                    :src="resolveFileUrl(form.problem_picture)"
                    fit="cover"
                    class="upload-preview"
                    :preview-src-list="[resolveFileUrl(form.problem_picture)]"
                    preview-teleported
                  />
                  <el-button text type="danger" @click="removeImage">移除</el-button>
                </template>
              </div>
              <div class="upload-tip">支持 jpg/jpeg/png，自动压缩后上传</div>
            </el-form-item>
          </el-form>
        </template>
      </div>

      <div class="step-actions">
        <el-button v-if="step > 0" @click="step -= 1">上一步</el-button>
        <el-button v-if="step < 2" type="primary" @click="next">下一步</el-button>
        <el-button v-else type="primary" :loading="submitting" @click="submit">
          确认提交
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.submit-page {
  max-width: 720px;
  margin: 0 auto;
}

.page-title {
  margin: 4px 0 20px;
  text-align: center;
}

.steps {
  margin-bottom: 24px;
}

.step-body {
  min-height: 240px;
}

.other-input {
  margin-top: 12px;
}

.confirm-summary {
  margin-bottom: 24px;

  .summary-title {
    margin: 0 0 12px;
  }
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.upload-preview {
  width: 160px;
  height: 120px;
  border-radius: 6px;
}

.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.step-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
}
.policy-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin: 6px 0 0;
}
</style>
