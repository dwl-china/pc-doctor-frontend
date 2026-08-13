import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { TOKEN_KEY, USER_KEY } from '@/constants'

/**
 * axios 封装（#25）：
 * - 请求拦截器自动携带 JWT
 * - 响应拦截器统一处理业务 code：0 解包返回 data；1001/HTTP 401 清会话跳登录；
 *   1007 强制改密跳转；其余统一 ElMessage 提示 —— 页面层不再各自判 code===0
 */

/** 后端统一返回体（docs/api.md §1） */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

const UNAUTHORIZED_CODE = 1001
const MUST_CHANGE_CODE = 1007

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** 会话失效统一处理：清存储 → 跳登录（带 redirect 回跳参数） */
function handleUnauthorized() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  const current = router.currentRoute.value
  if (current.path !== '/login') {
    router.push({ path: '/login', query: { redirect: current.fullPath } })
  }
}

http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResult
    if (body.code === 0) {
      // 解包：调用方直接拿到 data
      return body.data as never
    }
    if (body.code === UNAUTHORIZED_CODE) {
      handleUnauthorized()
    } else if (body.code === MUST_CHANGE_CODE) {
      ElMessage.warning(body.message || '请先修改初始密码')
      router.push('/change-password')
    } else {
      ElMessage.error(body.message || '请求失败')
    }
    return Promise.reject(new Error(body.message || `业务错误 ${body.code}`))
  },
  (error: AxiosError<ApiResult>) => {
    if (error.response?.status === 401) {
      handleUnauthorized()
    } else if (error.response?.status === 403) {
      ElMessage.error(error.response.data?.message || '没有权限执行此操作')
    } else {
      ElMessage.error(error.response?.data?.message || '网络异常，请稍后重试')
    }
    return Promise.reject(error)
  },
)

/** 解包后的类型化请求方法（响应拦截器已剥掉 Result 外壳） */
export const get = <T>(url: string, config?: AxiosRequestConfig) =>
  http.get(url, config) as unknown as Promise<T>

export const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  http.post(url, data, config) as unknown as Promise<T>

export const put = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  http.put(url, data, config) as unknown as Promise<T>

export const del = <T>(url: string, config?: AxiosRequestConfig) =>
  http.delete(url, config) as unknown as Promise<T>

export default http
