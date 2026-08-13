import { createPinia } from 'pinia'

/** 独立导出的 pinia 实例：路由守卫在 app.use(pinia) 之前运行时会用到 */
export const pinia = createPinia()
