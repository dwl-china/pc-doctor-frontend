<script setup lang="ts">
/**
 * 关于我们（阶段 7 · 8.8）：协会简介 + 活动展示（数据库驱动）+ 对外交流群。
 *
 * 需求 2：活动增删改入口放在本页（管理端路由仅管理员可进，电医进不来），电医+管理员可见。
 * 需求 3：简介 / 交流群说明 / 二维码改为配置驱动（管理端「页面文字」维护，契约 §4.9）。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useDocStore } from '@/stores/doc'
import { apiUpload } from '@/api/file'
import { resolveFileUrl } from '@/utils/file'
import { renderMarkdown, withQqGroup } from '@/utils/markdown'
import { UPLOAD_TYPES } from '@/constants'
import type { ActivityItem } from '@/types'

const docStore = useDocStore()
const auth = useAuthStore()

/** 活动管理入口对电医与管理员开放（契约 §4.7「电医+」） */
const canManage = computed(() => auth.isAdmin || auth.isDoctor)

const activities = ref<ActivityItem[]>([])
const loading = ref(false)

const introTitle = computed(() => docStore.siteContent.aboutTitle || '关于我们')
const introHtml = computed(() => renderMarkdown(docStore.siteContent.aboutBody))
const qqNoticeHtml = computed(() =>
  renderMarkdown(withQqGroup(docStore.siteContent.qqNotice, docStore.qqGroup)),
)

async function load() {
  loading.value = true
  try {
    await docStore.fetchActivities(1, 20)
    activities.value = docStore.activities.records
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

/* ---------- 活动详情抽屉 ---------- */
const detailVisible = ref(false)
const detailActivity = ref<ActivityItem | null>(null)
const detailHtml = ref('')
const detailLoading = ref(false)

async function openDetail(activity: ActivityItem) {
  detailActivity.value = activity
  detailVisible.value = true
  detailLoading.value = true
  detailHtml.value = ''
  try {
    const res = await fetch(resolveFileUrl(activity.file))
    if (!res.ok) throw new Error(`文件拉取失败（${res.status}）`)
    detailHtml.value = renderMarkdown(await res.text())
  } catch {
    detailHtml.value =
      '<p style="color:var(--el-text-color-secondary)">详情加载失败，请稍后重试</p>'
  } finally {
    detailLoading.value = false
  }
}

/* ---------- 活动增删改（需求 2） ---------- */
const editVisible = ref(false)
const editSaving = ref(false)
const uploadMd = ref(false)
const uploadCover = ref(false)
const editForm = reactive<{ id: number | null; title: string; summary: string; file: string; cover: string }>(
  { id: null, title: '', summary: '', file: '', cover: '' },
)

const isEdit = computed(() => editForm.id !== null)

function openCreate() {
  editForm.id = null
  editForm.title = ''
  editForm.summary = ''
  editForm.file = ''
  editForm.cover = ''
  editVisible.value = true
}

function openEdit(activity: ActivityItem) {
  // title/summary/file 后端都是 @NotBlank，必须回填并原样回传，否则 2001
  editForm.id = activity.id
  editForm.title = activity.title
  editForm.summary = activity.summary
  editForm.file = activity.file
  editForm.cover = activity.cover ?? ''
  editVisible.value = true
}

/** 详情 Markdown 文件：上传成功即填入表单，保存时提交 */
async function onMdChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  uploadMd.value = true
  try {
    const res = await apiUpload(raw, UPLOAD_TYPES.activity)
    editForm.file = res.url
  } catch {
    /* 拦截器已提示 */
  } finally {
    uploadMd.value = false
  }
  return false
}

async function onCoverChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  uploadCover.value = true
  try {
    const res = await apiUpload(raw, UPLOAD_TYPES.activity)
    editForm.cover = res.url
  } catch {
    /* 拦截器已提示 */
  } finally {
    uploadCover.value = false
  }
  return false
}

async function saveActivity() {
  if (!editForm.title.trim() || !editForm.summary.trim()) {
    ElMessage.warning('标题与简介不能为空')
    return
  }
  if (!editForm.file) {
    ElMessage.warning('请上传活动详情文件')
    return
  }
  editSaving.value = true
  try {
    const payload = {
      title: editForm.title.trim(),
      summary: editForm.summary.trim(),
      file: editForm.file,
      cover: editForm.cover || undefined,
    }
    if (editForm.id === null) {
      await docStore.createActivity(payload)
      ElMessage.success('活动已发布')
    } else {
      await docStore.updateActivity(editForm.id, payload)
      ElMessage.success('活动已更新')
    }
    editVisible.value = false
    await load()
  } catch {
    /* 拦截器已提示 */
  } finally {
    editSaving.value = false
  }
}

async function removeActivity(activity: ActivityItem) {
  try {
    await ElMessageBox.confirm(`确认删除活动「${activity.title}」？详情文件与封面会一并清理。`, '删除活动', {
      type: 'warning',
    })
    await docStore.deleteActivity(activity.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e instanceof Error) return
  }
}

onMounted(() => {
  load()
  docStore.fetchSiteContent().catch(() => undefined)
  docStore.fetchQqGroup().catch(() => undefined)
})
</script>

<template>
  <div class="about-page">
    <!-- 协会简介（文案可在管理端「页面文字」修改） -->
    <section class="intro">
      <h1 class="intro-title">{{ introTitle }}</h1>
      <div class="intro-body markdown-body" v-html="introHtml" />
    </section>

    <!-- 活动展示 -->
    <section class="activities">
      <div class="section-head">
        <h2 class="section-title">活动展示</h2>
        <el-button v-if="canManage" type="primary" plain @click="openCreate">新建活动</el-button>
      </div>
      <el-skeleton v-if="loading && activities.length === 0" :rows="4" animated />
      <div v-else-if="activities.length > 0" class="activity-grid">
        <el-card
          v-for="activity in activities"
          :key="activity.id"
          class="activity-card"
          shadow="hover"
          :body-style="{ padding: '0' }"
          @click="openDetail(activity)"
        >
          <el-image
            :src="resolveFileUrl(activity.cover) || undefined"
            fit="cover"
            class="activity-cover"
          >
            <template #error>
              <div class="cover-fallback">无封面</div>
            </template>
          </el-image>
          <div class="activity-body">
            <div class="activity-title">{{ activity.title }}</div>
            <div class="activity-summary">{{ activity.summary }}</div>
          </div>
          <div v-if="canManage" class="activity-actions" @click.stop>
            <el-button size="small" @click="openEdit(activity)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="removeActivity(activity)">
              删除
            </el-button>
          </div>
        </el-card>
      </div>
      <el-empty v-else description="暂无活动" />
    </section>

    <!-- 对外交流群：二维码仅在本页展示，页脚只放群号 -->
    <section v-if="docStore.qqGroup || docStore.siteContent.qqQrcode" class="qq-section">
      <h2 class="section-title">对外交流群</h2>
      <el-card class="qq-card">
        <!-- 说明文案没配时兜底显示群号，避免整块空白 -->
        <div v-if="qqNoticeHtml" class="qq-text markdown-body" v-html="qqNoticeHtml" />
        <div v-else class="qq-text">欢迎加入电脑医院交流群：<b>{{ docStore.qqGroup }}</b></div>
        <el-image
          v-if="docStore.siteContent.qqQrcode"
          :src="resolveFileUrl(docStore.siteContent.qqQrcode)"
          fit="contain"
          class="qq-qrcode"
          :preview-src-list="[resolveFileUrl(docStore.siteContent.qqQrcode)]"
          preview-teleported
        />
      </el-card>
    </section>

    <!-- 活动详情抽屉 -->
    <el-drawer
      v-model="detailVisible"
      :title="detailActivity?.title ?? '活动详情'"
      size="60%"
      destroy-on-close
    >
      <div v-loading="detailLoading" class="markdown-body" v-html="detailHtml" />
    </el-drawer>

    <!-- 活动编辑弹窗（需求 2） -->
    <el-dialog
      v-model="editVisible"
      :title="isEdit ? '编辑活动' : '新建活动'"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="editForm.title" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item label="简介" required>
          <el-input v-model="editForm.summary" type="textarea" :rows="2" maxlength="255" show-word-limit />
        </el-form-item>
        <el-form-item label="详情文件" required>
          <div class="upload-block">
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept=".md"
              :disabled="uploadMd"
              :on-change="onMdChange"
            >
              <el-button :loading="uploadMd" plain>
                {{ uploadMd ? '上传中…' : '上传 Markdown 文件' }}
              </el-button>
            </el-upload>
            <span v-if="editForm.file" class="upload-tip">已上传</span>
            <span v-else class="upload-tip">未上传</span>
          </div>
        </el-form-item>
        <el-form-item label="封面">
          <div class="upload-block">
            <el-image
              v-if="editForm.cover"
              :src="resolveFileUrl(editForm.cover)"
              fit="cover"
              class="cover-preview"
            />
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept="image/*"
              :disabled="uploadCover"
              :on-change="onCoverChange"
            >
              <el-button :loading="uploadCover" plain>
                {{ uploadCover ? '上传中…' : '上传封面' }}
              </el-button>
            </el-upload>
            <el-button v-if="editForm.cover" link @click="editForm.cover = ''">移除</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="saveActivity">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.about-page {
  max-width: 960px;
  margin: 0 auto;
}

.intro {
  padding: 32px 16px;
  text-align: center;

  .intro-title {
    margin: 0 0 16px;
    font-size: 28px;
    color: var(--el-color-primary);
  }

  .intro-body {
    max-width: 640px;
    margin: 0 auto;
    line-height: 1.8;
    color: var(--el-text-color-regular);
  }
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  margin: 24px 0 16px;
  color: var(--el-color-primary);
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.activity-card {
  cursor: pointer;

  .activity-cover {
    width: 100%;
    height: 160px;
  }

  .cover-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 160px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
  }

  .activity-body {
    padding: 12px 16px 16px;

    .activity-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .activity-summary {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }

  .activity-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0;
    padding: 0 12px 12px;
  }
}

.qq-section {
  margin-bottom: 24px;
}

.qq-card {
  text-align: center;

  .qq-text {
    font-size: 15px;
  }

  .qq-qrcode {
    width: 180px;
    height: 180px;
    margin-top: 12px;
  }
}

.upload-block {
  display: flex;
  align-items: center;
  gap: 10px;

  .upload-tip {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .cover-preview {
    width: 72px;
    height: 72px;
    border-radius: 6px;
    border: 1px solid var(--el-border-color-lighter);
  }
}
</style>
