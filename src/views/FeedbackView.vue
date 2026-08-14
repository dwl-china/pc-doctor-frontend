<script setup lang="ts">
/**
 * 意见反馈（阶段 7 · 8.10）：旧版只有渐变标题无表单（#6.2）。
 * 契约暂未包含反馈接口，采用「填写内容 → 生成邮件」+ 交流群两种通道，无需后端改动。
 */
import { computed, onMounted, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useDocStore } from '@/stores/doc'

const docStore = useDocStore()

const FEEDBACK_EMAIL = 'pcdoctor@zjgsu.edu.cn'

const types = ['功能建议', '问题反馈', '其他'] as const
const form = reactive({
  type: '功能建议' as (typeof types)[number],
  content: '',
  contact: '',
})

/** 邮件链接：标题 = 类型，正文 = 内容 + 联系方式 */
const mailtoHref = computed(() => {
  const subject = encodeURIComponent(`【电脑医院-${form.type}】`)
  const body = encodeURIComponent(`${form.content}\n\n联系方式：${form.contact || '（未填写）'}`)
  return `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`
})

function submit() {
  if (!form.content.trim()) {
    ElMessage.warning('请填写反馈内容')
    return
  }
  // 打开默认邮件客户端（内容已带入）
  window.location.href = mailtoHref.value
  ElMessage.success('已为你打开邮件客户端，发送邮件即可完成反馈')
}

onMounted(() => docStore.fetchQqGroup().catch(() => undefined))
</script>

<template>
  <div class="feedback-page">
    <h2 class="page-title">意见反馈</h2>

    <el-card>
      <el-form label-position="top">
        <el-form-item label="反馈类型">
          <el-radio-group v-model="form.type">
            <el-radio-button v-for="t in types" :key="t" :value="t">{{ t }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="反馈内容" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            maxlength="2000"
            show-word-limit
            placeholder="请描述你的建议或遇到的问题（最多 2000 字）"
          />
        </el-form-item>
        <el-form-item label="联系方式（选填，便于我们回复）">
          <el-input v-model="form.contact" maxlength="255" placeholder="手机号 / QQ / 邮箱等" />
        </el-form-item>
        <el-button type="primary" @click="submit">提交反馈</el-button>
      </el-form>

      <el-alert
        title="提交后会自动打开你的邮件客户端，将反馈发送至电脑医院官方邮箱"
        type="info"
        :closable="false"
        class="mail-tip"
      />
    </el-card>

    <el-card class="qq-card">
      <template #header>其他联系渠道</template>
      <p>
        欢迎加入电脑医院交流群咨询：
        <b v-if="docStore.qqGroup">{{ docStore.qqGroup }}</b>
        <span v-else>群号获取中…</span>
      </p>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.feedback-page {
  max-width: 640px;
  margin: 0 auto;
}

.page-title {
  margin: 4px 0 20px;
  color: var(--el-color-primary);
}

.mail-tip {
  margin-top: 12px;
}

.qq-card {
  margin-top: 16px;

  p {
    margin: 0;
  }
}
</style>
