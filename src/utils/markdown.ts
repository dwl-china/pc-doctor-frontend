import DOMPurify from 'dompurify'
import { marked } from 'marked'

/**
 * Markdown 渲染（站点文案 / 活动详情 / 文档预览共用）。
 *
 * 输入来自管理员或后台数据，属于不可信内容，必须经 DOMPurify 消毒后再 v-html，
 * 否则存储型 XSS 可直接拿到 localStorage 里的 JWT。
 */
export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { async: false }))
}

/**
 * 把 `{qq_group}` 占位符替换成群号。
 *
 * 站点文案里凡是需要露出群号的地方都写这个占位符，群号改了文案自动跟着变，
 * 不会留下写死的旧群号。
 */
export function withQqGroup(text: string, qqGroup: string): string {
  return text.replaceAll('{qq_group}', qqGroup || '')
}
