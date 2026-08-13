import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { apiLogin, apiMe, apiRegister } from '@/api/auth'
import { TOKEN_KEY, USER_KEY, USER_LEVEL } from '@/constants'
import type { AuthResponse, UserView } from '@/types'

/**
 * 登录态（JWT + 用户信息，localStorage 持久化）。
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) ?? '')
  const user = ref<UserView | null>(readUser())

  const isLoggedIn = computed(() => token.value !== '')
  const isAdmin = computed(() => user.value?.level === USER_LEVEL.ADMIN)
  const isDoctor = computed(() => user.value?.level === USER_LEVEL.DOCTOR)

  function readUser(): UserView | null {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as UserView
    } catch {
      return null
    }
  }

  function applyAuth(resp: AuthResponse) {
    token.value = resp.token
    user.value = resp.user
    localStorage.setItem(TOKEN_KEY, resp.token)
    localStorage.setItem(USER_KEY, JSON.stringify(resp.user))
  }

  async function login(payload: { user_id: string; password: string }) {
    applyAuth(await apiLogin(payload))
  }

  async function register(payload: {
    user_id: string
    password: string
    user_name: string
    contact_details?: string
    sex?: string
  }) {
    applyAuth(await apiRegister(payload))
  }

  /** 刷新本人信息（资料/角色变更后调用） */
  async function fetchMe() {
    user.value = await apiMe()
    localStorage.setItem(USER_KEY, JSON.stringify(user.value))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, isLoggedIn, isAdmin, isDoctor, login, register, fetchMe, logout }
})
