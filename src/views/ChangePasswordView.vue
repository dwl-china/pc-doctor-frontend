<script setup lang="ts">
/**
 * 修改密码（阶段 7 · 8.5）。
 * - 新密码 8-64 位、两次一致、不能与旧密码相同（与服务端规则对齐）
 * - 强制改密模式（mustChangePassword）：顶部提示，成功后解除标记并回首页
 */
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'

const auth = useAuthStore()
const userStore = useUserStore()
const router = useRouter()

const formRef = ref<FormInstance>()
const form = reactive({ old_password: '', new_password: '', confirm: '' })
const loading = ref(false)

const rules: FormRules = {
  old_password: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, max: 64, message: '新密码长度须为 8-64 位', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value && value === form.old_password) callback(new Error('新密码不能与旧密码相同'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== form.new_password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

async function submit() {
  const ok = await formRef.value?.validate().catch(() => false)
  if (!ok) return
  loading.value = true
  try {
    await userStore.changePassword({
      old_password: form.old_password,
      new_password: form.new_password,
    })
    await auth.fetchMe() // 刷新 mustChangePassword 标记
    ElMessage.success('密码修改成功')
    router.push('/')
  } catch {
    /* 拦截器已提示（旧密码错误等） */
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="password-page">
    <el-card class="password-card">
      <h2 class="title">修改密码</h2>

      <el-alert
        v-if="auth.user?.mustChangePassword"
        title="为保证账号安全，首次登录或密码重置后需修改密码"
        type="warning"
        :closable="false"
        class="force-tip"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="submit"
      >
        <el-form-item label="旧密码" prop="old_password">
          <el-input
            v-model="form.old_password"
            maxlength="64"
            type="password"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input
            v-model="form.new_password"
            maxlength="64"
            type="password"
            show-password
            placeholder="8-64 位"
            autocomplete="new-password"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirm">
          <el-input
            v-model="form.confirm"
            maxlength="64"
            type="password"
            show-password
            autocomplete="new-password"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button type="primary" class="submit" :loading="loading" @click="submit">
          确认修改
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.password-page {
  display: flex;
  justify-content: center;
  padding-top: 48px;
}

.password-card {
  width: 420px;

  .title {
    margin: 4px 0 16px;
    text-align: center;
  }

  .force-tip {
    margin-bottom: 16px;
  }

  .submit {
    width: 100%;
  }
}
</style>
