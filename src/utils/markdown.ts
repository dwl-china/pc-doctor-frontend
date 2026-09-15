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

/**
 * 页脚区域的 HTML 片段（管理员在管理端「页面文字」里粘贴）：
 * 「备案号」与「页脚」两个字段共用这一套消毒规则。
 *
 * **按 HTML 片段消毒后再渲染**，而不是当作纯文本：管理员需要粘贴 `<a>` 标签。
 * 白名单只放行少量排版标签 —— 页脚是全站每个页面都渲染的，一旦能注入脚本，
 * 就等于把 localStorage 里的 JWT 直接送出去。
 *
 * 被剥掉的：`<script>`、事件属性（`onerror=` 等）、`javascript:` 伪协议、`<iframe>` 等。
 */
const FOOTER_PURIFY_CONFIG = {
  ALLOWED_TAGS: ['a', 'span', 'br', 'b', 'strong', 'i', 'em', 'p'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'title'],
}

// target="_blank" 打开的新页面能通过 window.opener 反向操作原页面（tabnabbing），
// 自动补 rel。这个钩子是全局的，对其它 DOMPurify 调用也是纯收益。
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeFooterHtml(html: string): string {
  return DOMPurify.sanitize(html, FOOTER_PURIFY_CONFIG)
}
