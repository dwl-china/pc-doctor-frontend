/**
 * 文件 URL 拼接（#22）：后端返回的相对路径（如 /api/files/avatar/x.png）在开发环境走 vite
 * proxy、生产环境走同域 Nginx 反代；仅当 VITE_API_BASE_URL 配置为绝对地址（跨域部署）时
 * 才做前缀拼接，消灭旧版 `116.62.129.37:8080` 式的硬编码。
 */

export function resolveFileUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  const base = import.meta.env.VITE_API_BASE_URL || ''
  if (base && /^https?:\/\//.test(base)) {
    return new URL(url, base).href
  }
  return url
}
