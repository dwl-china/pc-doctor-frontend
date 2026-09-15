<script setup lang="ts">
/**
 * 登录/注册页（阶段 7 · 8.1）。
 * - 密码明文直传（HTTPS + 服务端 bcrypt），去掉旧版前端 MD5（#3）
 * - 注册字段与后端 DTO 白名单对齐：user_id/password/user_name/contact_details/sex，
 *   level 等敏感字段前端也不拼装（#2）
 * - 错误提示由 axios 响应拦截器统一处理，页面层不重复弹（#25）
 * - 强制改密用户登录后直达 /change-password（契约 §4.1 mustChangePassword）
 */
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { SEX_OPTIONS } from '@/constants'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

/** 站名只维护 .env 里的 VITE_APP_TITLE 一处（改备案名时不用翻代码） */
const appTitle = import.meta.env.VITE_APP_TITLE

const tab = ref<'login' | 'register'>('login')

/** 登录 */
const loginFormRef = ref<FormInstance>()
const loginForm = reactive({ user_id: '', password: '' })
const loginLoading = ref(false)

const loginRules: FormRules = {
  user_id: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

/** 注册 */
const registerFormRef = ref<FormInstance>()
const registerForm = reactive({
  user_id: '',
  user_name: '',
  password: '',
  confirm: '',
  sex: 'unknown',
  contact_details: '',
})
const registerLoading = ref(false)

const registerRules: FormRules = {
  // 与后端 RegisterRequest 校验对齐（契约 §4.1）
  user_id: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    {
      pattern: /^[A-Za-z0-9_]{2,50}$/,
      message: '账号须为 2-50 位字母/数字/下划线',
      trigger: 'blur',
    },
  ],
  user_name: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 50, message: '昵称最长 50 字', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 64, message: '密码长度须为 8-64 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== registerForm.password) callback(new Error('两次输入的密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
  contact_details: [{ max: 255, message: '联系方式最长 255 字', trigger: 'blur' }],
}

/** 登录/注册成功后统一跳转 */
function afterAuth() {
  const target = (route.query.redirect as string) || '/'
  // 强制改密用户先改密码，其余放行原目标
  router.push(auth.user?.mustChangePassword ? '/change-password' : target)
}

async function submitLogin() {
  const ok = await loginFormRef.value?.validate().catch(() => false)
  if (!ok) return
  loginLoading.value = true
  try {
    await auth.login({ user_id: loginForm.user_id, password: loginForm.password })
    afterAuth()
  } catch {
    /* 拦截器已提示（账号或密码错误统一 1003，不区分账号是否存在 #4.6） */
  } finally {
    loginLoading.value = false
  }
}

async function submitRegister() {
  const ok = await registerFormRef.value?.validate().catch(() => false)
  if (!ok) return
  registerLoading.value = true
  try {
    await auth.register({
      user_id: registerForm.user_id,
      password: registerForm.password,
      user_name: registerForm.user_name,
      sex: registerForm.sex,
      contact_details: registerForm.contact_details || undefined,
    })
    afterAuth()
  } catch {
    /* 拦截器已提示（如账号已存在） */
  } finally {
    registerLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card">
      <h2 class="title">{{ appTitle }}</h2>
      <p class="subtitle">电脑维修预约服务</p>

      <el-tabs v-model="tab" class="tabs" stretch>
        <el-tab-pane label="登录" name="login">
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            label-position="top"
            @submit.prevent="submitLogin"
          >
            <el-form-item label="账号" prop="user_id">
              <el-input
                v-model.trim="loginForm.user_id"
                maxlength="50"
                placeholder="学号/账号"
                autocomplete="username"
              />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="loginForm.password"
                maxlength="64"
                type="password"
                show-password
                placeholder="密码"
                autocomplete="current-password"
                @keyup.enter="submitLogin"
              />
            </el-form-item>
            <el-button type="primary" class="submit" :loading="loginLoading" @click="submitLogin">
              登 录
            </el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            label-position="top"
            @submit.prevent="submitRegister"
          >
            <el-form-item label="账号" prop="user_id">
              <el-input
                v-model.trim="registerForm.user_id"
                maxlength="50"
                placeholder="2-50 位字母/数字/下划线，如学号"
                autocomplete="username"
              />
            </el-form-item>
            <el-form-item label="昵称" prop="user_name">
              <el-input
                v-model.trim="registerForm.user_name"
                maxlength="50"
                placeholder="显示名称"
              />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="registerForm.password"
                maxlength="64"
                type="password"
                show-password
                placeholder="8-64 位"
                autocomplete="new-password"
              />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirm">
              <el-input
                v-model="registerForm.confirm"
                maxlength="64"
                type="password"
                show-password
                placeholder="再次输入密码"
                autocomplete="new-password"
                @keyup.enter="submitRegister"
              />
            </el-form-item>
            <el-form-item label="性别" prop="sex">
              <el-radio-group v-model="registerForm.sex">
                <el-radio v-for="opt in SEX_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="联系方式（选填）" prop="contact_details">
              <el-input
                v-model="registerForm.contact_details"
                maxlength="255"
                placeholder="手机号 / QQ 等，便于电医联系"
              />
            </el-form-item>
            <el-button
              type="primary"
              class="submit"
              :loading="registerLoading"
              @click="submitRegister"
            >
              注 册
            </el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
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
  width: min(380px, calc(100vw - 32px));

  .title {
    margin: 8px 0 4px;
    text-align: center;
  }

  .subtitle {
    margin: 0 0 16px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 8px;
    }
  }

  .submit {
    width: 100%;
    margin-top: 4px;
  }
}
</style>
