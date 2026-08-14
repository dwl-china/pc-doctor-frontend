<script setup lang="ts">
/**
 * 个人中心（阶段 7 · 8.5）：资料编辑、头像上传（服务端 300px 裁剪压缩）、改密入口。
 * - 更新资料走 DTO 白名单字段（昵称/性别/联系方式/简介），level 等敏感字段不拼装（#2）
 * - 保存/换头像后 auth.fetchMe() 同步全局用户信息
 */
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules, UploadFile } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { AVATAR_ALLOWED_EXTS, SEX_OPTIONS, USER_LEVEL } from '@/constants'
import { resolveFileUrl } from '@/utils/file'

const auth = useAuthStore()
const userStore = useUserStore()
const router = useRouter()

const user = auth.user

const levelLabel: Record<number, string> = {
  [USER_LEVEL.USER]: '普通用户',
  [USER_LEVEL.DOCTOR]: '电医',
  [USER_LEVEL.ADMIN]: '管理员',
}

const formRef = ref<FormInstance>()
const form = reactive({
  user_name: user?.userName ?? '',
  sex: user?.sex ?? 'unknown',
  contact_details: user?.contactDetails ?? '',
  user_description: user?.userDescription ?? '',
})
const saving = ref(false)

const rules: FormRules = {
  user_name: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 50, message: '昵称最长 50 字', trigger: 'blur' },
  ],
  contact_details: [{ max: 255, message: '联系方式最长 255 字', trigger: 'blur' }],
  user_description: [{ max: 255, message: '简介最长 255 字', trigger: 'blur' }],
}

async function saveProfile() {
  const ok = await formRef.value?.validate().catch(() => false)
  if (!ok) return
  saving.value = true
  try {
    await userStore.updateProfile({
      user_name: form.user_name.trim(),
      sex: form.sex,
      contact_details: form.contact_details || undefined,
      user_description: form.user_description || undefined,
    })
    await auth.fetchMe()
    ElMessage.success('资料已保存')
  } catch {
    /* 拦截器已提示 */
  } finally {
    saving.value = false
  }
}

/** 头像上传：前端只做扩展名校验，裁剪压缩交给服务端（300px，TODO 5.1） */
const uploadingAvatar = ref(false)

async function onAvatarChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  const ext = raw.name.split('.').pop()?.toLowerCase() ?? ''
  if (!(AVATAR_ALLOWED_EXTS as readonly string[]).includes(ext)) {
    ElMessage.warning(`头像仅支持 ${AVATAR_ALLOWED_EXTS.join('/')}`)
    return
  }
  uploadingAvatar.value = true
  try {
    await userStore.uploadAvatar(raw)
    await auth.fetchMe()
    ElMessage.success('头像已更新')
  } catch {
    /* 拦截器已提示 */
  } finally {
    uploadingAvatar.value = false
  }
}
</script>

<template>
  <div class="profile-page">
    <el-card class="profile-card">
      <h2 class="title">个人中心</h2>

      <!-- 基本信息 -->
      <div class="account-row">
        <el-upload
          :show-file-list="false"
          :auto-upload="false"
          accept=".jpg,.jpeg,.png"
          :on-change="onAvatarChange"
          :disabled="uploadingAvatar"
        >
          <el-badge is-dot :hidden="!auth.user?.mustChangePassword" class="avatar-badge">
            <el-avatar
              :size="72"
              :src="resolveFileUrl(auth.user?.userPicture) || undefined"
              class="avatar"
            >
              {{ auth.user?.userName?.charAt(0) }}
            </el-avatar>
          </el-badge>
        </el-upload>
        <div class="account-meta">
          <div class="account-id">账号：{{ auth.user?.userId }}</div>
          <div class="account-tags">
            <el-tag
              size="small"
              :type="auth.isAdmin ? 'danger' : auth.isDoctor ? 'warning' : 'info'"
            >
              {{ levelLabel[auth.user?.level ?? 0] ?? '普通用户' }}
            </el-tag>
            <el-tag v-if="auth.user?.createTime" size="small" type="info" effect="plain">
              注册于 {{ auth.user.createTime }}
            </el-tag>
          </div>
        </div>
      </div>

      <div class="avatar-tip">点击头像可更换（jpg/jpeg/png，服务端自动裁剪）</div>

      <el-divider />

      <!-- 资料编辑 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="saveProfile"
      >
        <el-form-item label="昵称" prop="user_name">
          <el-input v-model="form.user_name" maxlength="50" />
        </el-form-item>
        <el-form-item label="性别" prop="sex">
          <el-radio-group v-model="form.sex">
            <el-radio v-for="opt in SEX_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="联系方式" prop="contact_details">
          <el-input
            v-model="form.contact_details"
            maxlength="255"
            placeholder="手机号 / QQ 等，便于电医联系"
          />
        </el-form-item>
        <el-form-item label="个人简介" prop="user_description">
          <el-input
            v-model="form.user_description"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            placeholder="介绍一下自己（选填）"
          />
        </el-form-item>
        <el-button type="primary" :loading="saving" @click="saveProfile">保存资料</el-button>
        <el-button @click="router.push('/change-password')">修改密码</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  max-width: 560px;
  margin: 0 auto;
}

.title {
  margin: 4px 0 20px;
  text-align: center;
}

.account-row {
  display: flex;
  align-items: center;
  gap: 20px;

  .avatar {
    cursor: pointer;
    font-size: 28px;
  }

  .account-meta {
    .account-id {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .account-tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  }
}

.avatar-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
