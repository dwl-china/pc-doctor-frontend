import { createRouter, createWebHistory } from 'vue-router'
import { pinia } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { USER_LEVEL, type UserLevel } from '@/constants'

declare module 'vue-router' {
  interface RouteMeta {
    /** 需登录 */
    requiresAuth?: boolean
    /** 允许的角色（缺省=登录即可） */
    roles?: UserLevel[]
    /** 页面标题 */
    title?: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: '首页' },
        },
        {
          path: 'appointments/new',
          name: 'appointment-new',
          component: () => import('@/views/AppointmentSubmitView.vue'),
          meta: { requiresAuth: true, title: '提交预约' },
        },
        {
          path: 'appointments/:id',
          name: 'appointment-detail',
          component: () => import('@/views/AppointmentDetailView.vue'),
          meta: { title: '预约详情' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { requiresAuth: true, title: '个人中心' },
        },
        {
          path: 'change-password',
          name: 'change-password',
          component: () => import('@/views/ChangePasswordView.vue'),
          meta: { requiresAuth: true, title: '修改密码' },
        },
        {
          path: 'workbench',
          name: 'workbench',
          component: () => import('@/views/DoctorWorkbenchView.vue'),
          meta: { requiresAuth: true, roles: [USER_LEVEL.DOCTOR], title: '电医工作台' },
        },
        {
          path: 'documents',
          name: 'documents',
          component: () => import('@/views/DocumentsView.vue'),
          meta: { title: '文档' },
        },
        {
          path: 'about',
          name: 'about',
          component: () => import('@/views/AboutView.vue'),
          meta: { title: '关于我们' },
        },
        {
          path: 'help',
          name: 'help',
          component: () => import('@/views/HelpView.vue'),
          meta: { title: '帮助' },
        },
        {
          path: 'feedback',
          name: 'feedback',
          component: () => import('@/views/FeedbackView.vue'),
          meta: { title: '意见反馈' },
        },
        {
          path: 'admin',
          name: 'admin',
          component: () => import('@/views/AdminView.vue'),
          meta: { requiresAuth: true, roles: [USER_LEVEL.ADMIN], title: '管理端' },
        },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: '登录' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
})

/** 全局守卫：登录态检查 + 角色拦截（#7.6） */
router.beforeEach((to) => {
  const auth = useAuthStore(pinia)
  document.title = `${String(to.meta.title ?? '')} - ${import.meta.env.VITE_APP_TITLE}`

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.meta.roles && !to.meta.roles.includes((auth.user?.level ?? -1) as UserLevel)) {
    // 无角色权限：回首页（具体提示由页面层按需处理）
    return { path: '/' }
  }
  return true
})

export default router
