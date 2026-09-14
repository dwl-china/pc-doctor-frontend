<script setup lang="ts">
/**
 * 帮助页（阶段 7 · 8.10）：旧版为 animate.css 演示 + "todo:帮助"（#6.2），
 * 重写为与新版系统流程一致的使用帮助 FAQ。
 *
 * 需求 3 起问答内容改为配置驱动（管理端「页面文字」可编辑，契约 §4.9），
 * 保留原有折叠面板布局；管理员清空问答时页面同步为空，不做本地兜底。
 */
import { computed, onMounted } from 'vue'
import { useDocStore } from '@/stores/doc'
import { renderMarkdown, withQqGroup } from '@/utils/markdown'

const docStore = useDocStore()

/** 答案支持 Markdown；渲染前把 {qq_group} 换成真实群号并消毒 */
const faqList = computed(() =>
  docStore.siteContent.faqItems.map((item, index) => ({
    name: String(index),
    question: item.question,
    answerHtml: renderMarkdown(withQqGroup(item.answer, docStore.qqGroup)),
  })),
)

onMounted(() => {
  docStore.fetchSiteContent().catch(() => undefined)
  docStore.fetchQqGroup().catch(() => undefined)
})
</script>

<template>
  <div class="help-page">
    <h2 class="page-title">使用帮助</h2>

    <el-collapse v-if="faqList.length" class="faq">
      <el-collapse-item
        v-for="item in faqList"
        :key="item.name"
        :title="item.question"
        :name="item.name"
      >
        <div class="faq-answer" v-html="item.answerHtml" />
      </el-collapse-item>
    </el-collapse>
    <el-empty v-else description="暂无帮助内容" />
  </div>
</template>

<style scoped lang="scss">
.help-page {
  max-width: 760px;
  margin: 0 auto;
}

.page-title {
  margin: 4px 0 20px;
  color: var(--el-color-primary);
}

.faq {
  .faq-answer {
    line-height: 1.7;

    p {
      margin: 8px 0;
    }

    ol,
    ul {
      margin: 8px 0;
      padding-left: 20px;

      li {
        margin: 4px 0;
      }
    }
  }
}
</style>
