<script setup lang="ts">
/**
 * 文档模块（阶段 7 · 8.7）：列表（标题搜索 + 分页）、Markdown 预览、管理端新建/编辑/删除。
 * - 空标题必须拦截（#19，表单 required + 后端 @NotBlank 双保险）
 * - Markdown 渲染经 DOMPurify 消毒（防 XSS）；正文用原生 fetch 拉取（文件接口返回裸文本，
 *   不走 axios 拦截器的 Result 解包）
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { FormInstance, FormRules, UploadFile } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useDocStore } from '@/stores/doc'
import { apiUpload } from '@/api/file'
import { PAGE_SIZE_DEFAULT, UPLOAD_TYPES } from '@/constants'
import type { DocumentItem } from '@/types'

const auth = useAuthStore()
const docStore = useDocStore()
const route = useRoute()

/** 电医+可编辑文档（走查建议 #2） */
const canEditDocs = computed(() => auth.isAdmin || auth.isDoctor)

const list = ref<DocumentItem[]>([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    await docStore.fetchDocuments({
      page: page.value,
      size: PAGE_SIZE_DEFAULT,
      title: keyword.value || undefined,
    })
    list.value = docStore.documents.records
    total.value = docStore.documents.total
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

/** ---------- 预览 ---------- */
const previewVisible = ref(false)
const previewDoc = ref<DocumentItem | null>(null)
const previewHtml = ref('')
const previewLoading = ref(false)

async function openPreview(doc: DocumentItem) {
  previewDoc.value = doc
  previewVisible.value = true
  previewLoading.value = true
  previewHtml.value = ''
  try {
    const res = await fetch(doc.file)
    if (!res.ok) throw new Error(`文件拉取失败（${res.status}）`)
    const text = await res.text()
    // 注意：必须消毒后再注入 v-html（防文档内容 XSS）
    previewHtml.value = DOMPurify.sanitize(marked.parse(text) as string)
  } catch {
    previewHtml.value =
      '<p style="color:var(--el-text-color-secondary)">正文加载失败，请稍后重试</p>'
  } finally {
    previewLoading.value = false
  }
}

/** ---------- 新建 / 编辑 ---------- */
const editVisible = ref(false)
const editFormRef = ref<FormInstance>()
const editForm = reactive({
  id: undefined as number | undefined,
  title: '',
  summary: '',
  file: '',
})
const saving = ref(false)
const uploadingDoc = ref(false)

const editRules: FormRules = {
  title: [
    { required: true, message: '标题不能为空', trigger: 'blur' }, // #19 空标题拦截
    { max: 255, message: '标题过长', trigger: 'blur' },
  ],
  summary: [{ max: 500, message: '摘要过长', trigger: 'blur' }],
}

function openCreate() {
  editForm.id = undefined
  editForm.title = ''
  editForm.summary = ''
  editForm.file = ''
  editVisible.value = true
}

function openEdit(doc: DocumentItem) {
  editForm.id = doc.id
  editForm.title = doc.title
  editForm.summary = doc.summary ?? ''
  editForm.file = doc.file
  editVisible.value = true
}

/** Markdown 文件上传（编辑时可选，不选则保留原文件） */
async function onMdChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  const ext = raw.name.split('.').pop()?.toLowerCase()
  if (ext !== 'md') {
    ElMessage.warning('仅支持 .md 文件')
    return
  }
  uploadingDoc.value = true
  try {
    const res = await apiUpload(raw, UPLOAD_TYPES.doc)
    editForm.file = res.url
    ElMessage.success('正文文件上传成功')
  } catch {
    /* 拦截器已提示 */
  } finally {
    uploadingDoc.value = false
  }
}

async function save() {
  const ok = await editFormRef.value?.validate().catch(() => false)
  if (!ok) return
  if (!editForm.file) {
    ElMessage.warning('请上传 Markdown 正文文件')
    return
  }
  saving.value = true
  try {
    if (editForm.id === undefined) {
      await docStore.createDocument({
        title: editForm.title.trim(),
        summary: editForm.summary || undefined,
        file: editForm.file,
      })
      ElMessage.success('文档已创建')
    } else {
      await docStore.updateDocument(editForm.id, {
        title: editForm.title.trim(),
        summary: editForm.summary || undefined,
        file: editForm.file,
      })
      ElMessage.success('文档已更新')
    }
    editVisible.value = false
    await load()
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

async function remove(doc: DocumentItem) {
  try {
    await ElMessageBox.confirm('确认删除该文档？操作不可恢复。', '删除文档', { type: 'warning' })
    await docStore.deleteDocument(doc.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    if (e instanceof Error) return
  }
}

onMounted(async () => {
  await load()
  // 首页科普卡片跳转（走查建议 #4）：?doc=<id> 自动打开预览
  const docId = Number(route.query.doc)
  if (docId) {
    const doc = list.value.find((d) => d.id === docId)
    if (doc) openPreview(doc)
  }
})
</script>

<template>
  <div class="docs-page">
    <div class="docs-header">
      <h2 class="page-title">文档</h2>
      <div class="header-actions">
        <el-input
          v-model="keyword"
          maxlength="100"
          placeholder="按标题搜索"
          clearable
          class="search-input"
          @keyup.enter="search"
          @clear="search"
        >
          <template #append>
            <el-button @click="search">搜索</el-button>
          </template>
        </el-input>
        <el-button v-if="canEditDocs" type="primary" @click="openCreate">新建文档</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" stripe empty-text="暂无文档">
      <el-table-column label="标题" min-width="240">
        <template #default="{ row }">
          <el-link type="primary" @click="openPreview(row)">{{ row.title }}</el-link>
        </template>
      </el-table-column>
      <el-table-column prop="summary" label="摘要" min-width="260" show-overflow-tooltip />
      <el-table-column prop="updateTime" label="更新时间" width="170" />
      <el-table-column v-if="canEditDocs" label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" plain @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > PAGE_SIZE_DEFAULT" class="pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="PAGE_SIZE_DEFAULT"
        :total="total"
        layout="prev, pager, next, total"
        background
        @current-change="load"
      />
    </div>

    <!-- 预览：全屏阅读。正文另用 .preview-body 限宽居中 —— 满屏宽的行长反而难读 -->
    <el-drawer
      v-model="previewVisible"
      :title="previewDoc?.title ?? '文档预览'"
      size="100%"
      destroy-on-close
    >
      <div
        v-loading="previewLoading"
        class="markdown-body preview-body"
        v-html="previewHtml"
      />
    </el-drawer>

    <!-- 新建 / 编辑对话框 -->
    <el-dialog
      v-model="editVisible"
      :title="editForm.id === undefined ? '新建文档' : '编辑文档'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-position="top">
        <el-form-item label="标题" prop="title">
          <el-input v-model="editForm.title" maxlength="255" placeholder="文档标题" />
        </el-form-item>
        <el-form-item label="摘要" prop="summary">
          <el-input
            v-model="editForm.summary"
            type="textarea"
            :rows="2"
            maxlength="500"
            placeholder="一句话摘要（选填）"
          />
        </el-form-item>
        <el-form-item label="正文文件（.md）" required>
          <div class="md-row">
            <el-upload
              :show-file-list="false"
              :auto-upload="false"
              accept=".md"
              :on-change="onMdChange"
              :disabled="uploadingDoc"
            >
              <el-button :loading="uploadingDoc" type="primary" plain>
                {{ uploadingDoc ? '上传中…' : '上传 Markdown 文件' }}
              </el-button>
            </el-upload>
            <span v-if="editForm.file" class="md-name">
              {{ editForm.file.split('/').pop() }}
              <el-tag size="small" type="success" effect="plain">已上传</el-tag>
            </span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.docs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;

  .page-title {
    margin: 0;
    color: var(--el-color-primary);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .search-input {
    width: 240px;
  }
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.md-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  .md-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}
</style>

<style lang="scss">
/* Markdown 渲染样式（drawer 内，非 scoped） */
.markdown-body {
  padding: 0 8px;
  line-height: 1.7;
  word-break: break-word;

  h1,
  h2,
  h3 {
    margin: 16px 0 8px;
  }

  pre {
    padding: 12px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
    overflow-x: auto;
  }

  code {
    padding: 2px 4px;
    border-radius: 4px;
    background: var(--el-fill-color-light);
    font-family: Consolas, Monaco, monospace;
  }

  pre code {
    padding: 0;
    background: transparent;
  }

  img {
    max-width: 100%;
  }

  table {
    border-collapse: collapse;

    th,
    td {
      padding: 6px 10px;
      border: 1px solid var(--el-border-color);
    }
  }

  blockquote {
    margin: 8px 0;
    padding: 4px 12px;
    border-left: 4px solid var(--el-color-primary-light-5);
    color: var(--el-text-color-secondary);
  }
}

/*
 * 全屏预览时追加在 .markdown-body 上的类。
 * 抽屉铺满整个视口了，但正文**不能跟着铺满** —— 一行 1500px 宽、
 * 一行能排下上百个字，眼睛换行时找不到下一行的开头。
 * 所以限宽居中，把行长控制在 60~70 个字（中文的舒适区间）。
 * 这段必须放在 .markdown-body 之后：两者特异性相同，靠顺序覆盖它的 padding。
 */
.preview-body {
  max-width: 960px;
  margin: 0 auto;
  padding: 8px 24px 64px;
  font-size: 15px;
  line-height: 1.85;
}

/* 全屏后标题层级拉开一点，长文里更好定位 */
.preview-body :is(h1, h2, h3) {
  margin-top: 28px;
}
</style>
