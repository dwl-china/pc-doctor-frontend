<script setup lang="ts">
/**
 * 关于我们（阶段 7 · 8.8）：协会简介 + 活动展示（数据库驱动）+ 对外交流群（config 接口）。
 * 活动详情为 Markdown 文件，渲染同文档模块（DOMPurify 消毒）。
 */
import { onMounted, ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useDocStore } from '@/stores/doc'
import { resolveFileUrl } from '@/utils/file'
import type { ActivityItem } from '@/types'

const docStore = useDocStore()

const activities = ref<ActivityItem[]>([])
const loading = ref(false)

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

/** 活动详情抽屉 */
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
    const res = await fetch(activity.file)
    if (!res.ok) throw new Error(`文件拉取失败（${res.status}）`)
    detailHtml.value = DOMPurify.sanitize(marked.parse(await res.text()) as string)
  } catch {
    detailHtml.value =
      '<p style="color:var(--el-text-color-secondary)">详情加载失败，请稍后重试</p>'
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => {
  load()
  docStore.fetchQqGroup().catch(() => undefined) // 群号失败不阻塞页面
})
</script>

<template>
  <div class="about-page">
    <!-- 协会简介 -->
    <section class="intro">
      <h1 class="intro-title">关于我们</h1>
      <p class="intro-text">
        <b>X计算机协会</b
        >成立于1995年，是一个面向全校、以营造校园科技文化氛围、推广计算机应用操作为宗旨的学术科技类社团。
      </p>
      <p class="intro-text">
        <b>电脑医院</b
        >隶属于浙江工商大学计算机协会，旨在为在校师生提供免费、专业、便捷的IT技术支援服务。
      </p>
    </section>

    <!-- 活动展示 -->
    <section class="activities">
      <h2 class="section-title">活动展示</h2>
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
        </el-card>
      </div>
      <el-empty v-else description="暂无活动" />
    </section>

    <!-- 对外交流群 -->
    <section v-if="docStore.qqGroup" class="qq-section">
      <h2 class="section-title">对外交流群</h2>
      <el-card class="qq-card">
        <div class="qq-text">
          欢迎加入电脑医院交流群：<b>{{ docStore.qqGroup }}</b>
        </div>
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

  .intro-text {
    margin: 0 auto 12px;
    max-width: 640px;
    line-height: 1.8;
    color: var(--el-text-color-regular);
  }
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
}

.qq-section {
  margin-bottom: 24px;
}

.qq-card {
  text-align: center;

  .qq-text {
    font-size: 15px;
  }
}
</style>
