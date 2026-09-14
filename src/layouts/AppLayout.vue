<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDocStore } from '@/stores/doc'
import { resolveFileUrl } from '@/utils/file'

const router = useRouter()
const auth = useAuthStore()
const docStore = useDocStore()

// 页脚展示交流群号；store 里有缓存守卫，不会每次导航都发请求
onMounted(() => docStore.fetchQqGroup().catch(() => undefined))

const navLinks = [
  { to: '/', label: '首页' },
  { to: '/documents', label: '文档' },
  { to: '/about', label: '关于我们' },
  { to: '/help', label: '帮助' },
  { to: '/feedback', label: '意见反馈' },
]

function handleCommand(command: string) {
  if (command === 'logout') {
    auth.logout()
    router.push('/login')
  } else {
    router.push(command)
  }
}
</script>

<template>
  <el-container class="app-layout">
    <el-header class="app-header">
      <router-link to="/" class="brand">
        <el-icon :size="20"><Monitor /></el-icon>
        <span>电脑医院</span>
      </router-link>

      <nav class="nav">
        <router-link
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          active-class="nav-link-active"
        >
          {{ link.label }}
        </router-link>
      </nav>

      <div class="right">
        <template v-if="auth.isLoggedIn">
          <el-dropdown @command="handleCommand">
            <span class="user-chip">
              <el-avatar :size="28" :src="resolveFileUrl(auth.user?.userPicture) || undefined">
                {{ auth.user?.userName?.charAt(0) }}
              </el-avatar>
              <span class="user-name">{{ auth.user?.userName }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="/profile">个人中心</el-dropdown-item>
                <el-dropdown-item v-if="auth.isDoctor" command="/workbench"
                  >电医工作台</el-dropdown-item
                >
                <el-dropdown-item v-if="auth.isAdmin" command="/admin">管理端</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
        <template v-else>
          <el-button text @click="router.push('/login')">登录</el-button>
        </template>
      </div>
    </el-header>

    <el-main class="app-main">
      <router-view />
    </el-main>

    <el-footer class="app-footer">
      <span>浙江工商大学电脑医院 · 校园电脑维修预约服务</span>
      <span v-if="docStore.qqGroup" class="footer-qq">
        交流群 <b>{{ docStore.qqGroup }}</b>
      </span>
    </el-footer>
  </el-container>
</template>

<style scoped lang="scss">
.app-layout {
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  height: auto;
  min-height: 60px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);

  .brand {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 18px;
    font-weight: 600;
    color: var(--el-color-primary);
    text-decoration: none;
  }

  .nav {
    display: flex;
    gap: 4px;
    flex: 1;
    flex-wrap: wrap;

    .nav-link {
      padding: 6px 12px;
      border-radius: 6px;
      color: var(--el-text-color-regular);
      text-decoration: none;
      font-size: 14px;

      &:hover {
        color: var(--el-color-primary);
        background: var(--el-fill-color-light);
      }
    }

    .nav-link-active {
      color: var(--el-color-primary);
      font-weight: 600;
    }
  }

  .user-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    outline: none;

    .user-name {
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.app-main {
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
}

.app-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;

  .footer-qq {
    padding-left: 8px;
    border-left: 1px solid var(--el-border-color);
  }
}
</style>
