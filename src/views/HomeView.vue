<script setup lang="ts">
/**
 * 首页预约列表（阶段 7 · 8.2）。
 * - el-pagination 标准分页（修复旧版「每次跳两页」#18：旧实现 page+1 后又 commit 下一页）
 * - 状态筛选 + 「仅看我的」；未登录点「仅看我的」先去登录再回跳
 * - 卡片点击进详情
 */
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useOrderStore } from '@/stores/order'
import { useAuthStore } from '@/stores/auth'
import { useDocStore } from '@/stores/doc'
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_LABEL } from '@/constants'
import type { AppointmentView, DocumentItem } from '@/types'

const order = useOrderStore()
const auth = useAuthStore()
const doc = useDocStore()
const router = useRouter()

/** 首页科普文档（走查建议 #4：最新 4 篇） */
const docs = ref<DocumentItem[]>([])

async function loadDocs() {
  try {
    await doc.fetchDocuments({ page: 1, size: 4 })
    docs.value = doc.documents.records
  } catch {
    /* 拦截器已提示，首页文档区静默降级 */
  }
}

function goDocument(item: DocumentItem) {
  router.push({ path: '/documents', query: { doc: item.id } })
}

/** 「全部」用哨兵 -1 代替 undefined（el-radio 的 value 不接受 undefined） */
const ALL_STATUS = -1

const statusTabs = [
  { label: '全部', value: ALL_STATUS },
  { label: APPOINTMENT_STATUS_LABEL[APPOINTMENT_STATUS.QUEUED], value: APPOINTMENT_STATUS.QUEUED },
  {
    label: APPOINTMENT_STATUS_LABEL[APPOINTMENT_STATUS.PROCESSING],
    value: APPOINTMENT_STATUS.PROCESSING,
  },
  { label: APPOINTMENT_STATUS_LABEL[APPOINTMENT_STATUS.DONE], value: APPOINTMENT_STATUS.DONE },
] as const

/** 状态筛选（tab 切换重置回第 1 页） */
function changeTab(value: number) {
  order.fetchList({ page: 1, status: value === ALL_STATUS ? undefined : value })
}

/** 仅看我的：未登录先去登录，回跳本页 */
function toggleMine() {
  if (!auth.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  order.fetchList({ page: 1, mine: order.mineFilter ? 0 : 1 })
}

/** 退出登录后「仅看我的」自动复位 */
watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (!loggedIn && order.mineFilter) {
      order.fetchList({ page: 1, mine: 0 })
    }
  },
)

function changePage(page: number) {
  order.fetchList({ page })
}

function statusTagType(status: number) {
  return (
    (
      {
        [APPOINTMENT_STATUS.QUEUED]: 'warning',
        [APPOINTMENT_STATUS.PROCESSING]: 'primary',
        [APPOINTMENT_STATUS.DONE]: 'success',
      } as const
    )[status] ?? 'info'
  )
}

function goDetail(item: AppointmentView) {
  router.push(`/appointments/${item.id}`)
}

function scrollToList() {
  document.querySelector('#appointment-list')?.scrollIntoView({ behavior: 'smooth' })
}

onMounted(() => {
  order.fetchList({ page: 1 })
  loadDocs()
})
</script>

<template>
  <div class="home-page">
    <!-- Hero -->
    <section class="hero">
      <h1 class="hero-title">欢迎使用电医预约</h1>
      <p class="hero-subtitle">——致力于提供最优质的公益维修服务</p>
      <div class="hero-actions">
        <el-button
          type="primary"
          size="large"
          @click="
            router.push(
              auth.isLoggedIn
                ? '/appointments/new'
                : { path: '/login', query: { redirect: '/appointments/new' } },
            )
          "
        >
          立即预约
        </el-button>
        <el-button size="large" plain @click="scrollToList">预约记录</el-button>
      </div>
    </section>

    <!-- 科普文档（走查建议 #4） -->
    <section v-if="docs.length > 0" class="docs-section">
      <div class="list-header">
        <h2 class="list-title">电脑知识科普</h2>
        <el-link type="primary" @click="router.push('/documents')">更多文档 →</el-link>
      </div>
      <div class="docs-grid">
        <el-card
          v-for="item in docs"
          :key="item.id"
          class="doc-card"
          shadow="hover"
          @click="goDocument(item)"
        >
          <p class="doc-title">{{ item.title }}</p>
          <p class="doc-summary">{{ item.summary || '点击查看详情' }}</p>
          <span class="doc-time">{{ item.updateTime }}</span>
        </el-card>
      </div>
    </section>

    <!-- 预约列表 -->
    <section id="appointment-list" class="list-section">
      <div class="list-header">
        <h2 class="list-title">预约记录</h2>
        <div class="list-filters">
          <el-radio-group
            :model-value="order.statusFilter ?? ALL_STATUS"
            @update:model-value="changeTab"
          >
            <el-radio-button v-for="tab in statusTabs" :key="tab.label" :value="tab.value">
              {{ tab.label }}
            </el-radio-button>
          </el-radio-group>
          <el-checkbox :model-value="order.mineFilter" @change="toggleMine">
            仅查看我的记录
          </el-checkbox>
        </div>
      </div>

      <el-skeleton v-if="order.loading && order.list.records.length === 0" :rows="6" animated />

      <template v-else>
        <div v-if="order.list.records.length > 0" class="card-grid">
          <el-card
            v-for="item in order.list.records"
            :key="item.id"
            class="order-card"
            shadow="hover"
            @click="goDetail(item)"
          >
            <div class="card-body">
              <div class="card-desc">
                <el-tag size="small" type="primary" effect="plain">
                  {{ item.categoryName ?? '未分类' }}
                </el-tag>
                <el-tag size="small" :type="statusTagType(item.status)" effect="plain">
                  {{ APPOINTMENT_STATUS_LABEL[item.status] ?? '未知' }}
                </el-tag>
              </div>
              <p class="problem">{{ item.problemDescription }}</p>
              <div class="card-meta">
                <span class="meta-item">
                  <el-icon><User /></el-icon>{{ item.userName || item.userId }}
                </span>
                <span class="meta-item" v-if="item.availableTime">
                  <el-icon><Clock /></el-icon>{{ item.availableTime }}
                </span>
                <span class="meta-item">
                  <el-icon><Calendar /></el-icon>{{ item.createTime }}
                </span>
                <span class="meta-item doctor" v-if="item.doctorName">
                  <el-icon><Service /></el-icon>电医：{{ item.doctorName }}
                </span>
              </div>
            </div>
          </el-card>
        </div>

        <el-empty v-else-if="!order.loading" description="暂无相关预约条目 😊" />

        <div v-if="order.list.total > order.size" class="pagination">
          <el-pagination
            :current-page="order.page"
            :page-size="order.size"
            :total="order.list.total"
            layout="prev, pager, next, total"
            background
            @current-change="changePage"
          />
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped lang="scss">
.home-page {
  display: flex;
  flex-direction: column;
}

.hero {
  padding: 48px 16px;
  text-align: center;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    var(--el-color-primary-light-7),
    var(--el-color-primary-light-9)
  );

  .hero-title {
    margin: 0 0 8px;
    font-size: 26px;
    color: var(--el-color-primary-dark-2);
  }

  @media (min-width: 768px) {
    padding: 72px 16px;

    .hero-title {
      font-size: 32px;
    }
  }

  .hero-subtitle {
    margin: 0 0 24px;
    color: var(--el-text-color-secondary);
  }
}

.list-section {
  padding-top: 24px;
}

.docs-section {
  padding-top: 32px;

  .docs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }

  .doc-card {
    cursor: pointer;

    .doc-title {
      margin: 0 0 6px;
      font-size: 15px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .doc-summary {
      margin: 0 0 8px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 36px;
    }

    .doc-time {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;

  .list-title {
    margin: 0;
    color: var(--el-color-primary);
  }

  .list-filters {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.order-card {
  cursor: pointer;

  .problem {
    margin: 8px 0;
    font-size: 15px;
    font-weight: 600;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-desc {
    display: flex;
    gap: 8px;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--el-text-color-secondary);
    font-size: 13px;

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;

      .el-icon {
        font-size: 14px;
      }
    }
  }
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}
</style>
