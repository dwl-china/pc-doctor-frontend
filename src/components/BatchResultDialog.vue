<script setup lang="ts">
/**
 * 批量操作结果弹窗（契约 §1「批量接口约定」）。
 *
 * 四个管理端 tab 共用：只有**存在失败项**时才由父组件打开 —— 全部成功用一条 ElMessage 即可，
 * 弹窗留给需要逐条核对原因的场合（失败行可能已被删除、不在当前页，所以不做行内高亮）。
 */
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { BatchFailure } from '@/types'

const props = defineProps<{
  modelValue: boolean
  /** 操作名，用于标题与复制清单的表头，如「删除用户」 */
  action: string
  total: number
  success: number
  failures: BatchFailure[]
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const summary = computed(
  () => `共 ${props.total} 项，成功 ${props.success} 项，失败 ${props.failures.length} 项`,
)

/** 复制成 TSV，便于贴进表格逐条核对 */
async function copyFailures() {
  const lines = [
    `# ${props.action} - 失败清单`,
    'id\t错误码\t原因',
    ...props.failures.map((f) => `${f.id}\t${f.code}\t${f.reason}`),
  ]
  await navigator.clipboard.writeText(lines.join('\n'))
  ElMessage.success('失败清单已复制到剪贴板')
}
</script>

<template>
  <el-dialog v-model="visible" :title="`${action}结果`" width="560px">
    <el-alert :title="summary" type="warning" :closable="false" class="summary" />
    <el-table :data="failures" stripe height="260" empty-text="没有失败项">
      <el-table-column prop="id" label="ID" width="140" show-overflow-tooltip />
      <el-table-column prop="code" label="错误码" width="90" />
      <el-table-column prop="reason" label="原因" min-width="200" show-overflow-tooltip />
    </el-table>
    <template #footer>
      <el-button @click="copyFailures">复制失败清单</el-button>
      <el-button type="primary" @click="visible = false">知道了</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.summary {
  margin-bottom: 12px;
}
</style>
