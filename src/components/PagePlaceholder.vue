<script setup lang="ts">
defineProps<{
  title: string
  desc?: string
}>()
</script>

<template>
  <div class="page-placeholder">
    <el-icon :size="36" class="icon"><Document /></el-icon>
    <h2>{{ title }}</h2>
    <p>{{ desc ?? '功能开发中（阶段 7 页面实现时落地）' }}</p>
  </div>
</template>

<style scoped lang="scss">
.page-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 16px;
  color: var(--el-text-color-secondary);

  .icon {
    color: var(--el-color-primary-light-5);
  }

  h2 {
    margin: 0;
    color: var(--el-text-color-primary);
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}
</style>
