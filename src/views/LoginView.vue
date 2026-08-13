<script setup lang="ts">
/**
 * 登录页（阶段 6 骨架用的临时可用版：验证「proxy → 拦截器 → store → 守卫」整链路；
 * 完整登录/注册页面在阶段 7（8.1）实现）。
 */
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ userId: '', password: '' })
const loading = ref(false)

async function submit() {
  if (!form.userId || !form.password) return
  loading.value = true
  try {
    // 错误提示由 axios 响应拦截器统一处理（#25）
    await auth.login({ user_id: form.userId, password: form.password })
    router.push((route.query.redirect as string) || '/')
  } catch {
    /* 拦截器已提示 */
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card">
      <h2 class="title">浙江工商大学电脑医院</h2>
      <p class="subtitle">校园电脑维修预约服务</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="账号">
          <el-input v-model="form.userId" placeholder="学号/账号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="密码"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button type="primary" class="submit" :loading="loading" @click="submit">登录</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--el-fill-color-light);
}

.login-card {
  width: 360px;

  .title {
    margin: 8px 0 4px;
    text-align: center;
  }

  .subtitle {
    margin: 0 0 20px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .submit {
    width: 100%;
  }
}
</style>
