# PC-Doctor Frontend

电脑医院预约系统 —— 前端（重构版）。

旧前端（[PC-Doctor-Web](https://github.com/AlanCorn/PC-Doctor-Web)）存在分页跳页、空壳页面、硬编码后端地址、异常依赖等工程问题。本仓库为全新重写的前端，功能对齐旧版并补全空壳功能。

## 关于本项目

本项目来自**浙江工商大学**兴趣社团X计算机协会**电脑医院**

**X计算机协会**成立于1995年，是一个面向全校、以营造校园科技文化氛围，推广计算机应用操作为宗旨的学术科技类社团。

**电脑医院**隶属于浙江工商大学计算机协会，旨在为在校师生提供免费、专业、便捷的IT技术支援活动

本项目为公益项目，是电脑医院内部自行组织、开发的系统。

## 技术栈

| 项 | 选型 |
| --- | --- |
| 框架 | Vue 3.5 + Vite 8 + TypeScript 6 |
| 状态 / 路由 | Pinia + Vue Router 4 |
| UI | Element Plus + SCSS + Tailwind |
| HTTP | axios 1.x（拦截器统一带 JWT、统一处理业务 code） |
| 文档渲染 | marked + DOMPurify（Markdown 渲染消毒防 XSS） |

## 快速开始

```bash
npm install
npm run dev      # 开发：vite proxy /api → 后端 8080（见 vite.config.ts）
npm run build    # 类型检查 + 生产构建，产物 dist/
```

## 环境变量

| 文件 | 说明 |
| --- | --- |
| `.env.development` | 开发环境，API 走 vite proxy，`VITE_API_BASE_URL=/api` |
| `.env.production` | 生产环境，由 Nginx 托管静态资源并反代 `/api`（同源，无 CORS） |

两个文件均不含密钥、可提交。前端无需其他配置：所有凭据都在后端环境变量里。

## 生产部署

1. 构建：`npm run build`（产物 `dist/`）
2. Nginx 托管 `dist/` 并反代 `/api/` 到后端 8080 —— 完整配置（HTTPS、SPA 回退、上传限制 20MB）见仓库外根目录 `deploy/nginx.conf`
3. 图片/文件 URL 由后端返回 `/api/files/...`，同源反代下无需额外配置

## 开发约定

- 接口与图片 URL 一律走配置，禁止硬编码 `127.0.0.1:8080`；开发环境用 vite proxy
- axios 响应拦截器统一处理业务 code（`0` 解包 / `1001` 清会话跳登录 / `1007` 跳强制改密 / 其余统一 ElMessage），页面层不再各自判 `code===0`
- status / level / 分页大小 / 上传限制等魔法数字收敛到 `src/constants`
- 通知统一用 Element Plus 消息组件
- API 契约以 `pc-doctor-backend` 仓库的 [docs/api.md](https://github.com/dwl-china/pc-doctor-backend/blob/main/docs/api.md) 为准，出入先改契约再改两端
- ESLint 10 + Prettier + husky/lint-staged 提交钩子强制格式

## 测试与质量

- `npm run build` 含 vue-tsc 类型检查
- 提交钩子：lint-staged 对暂存文件跑 ESLint + Prettier
- 全流程走查清单见根目录 `TODO.md` 阶段 8

## 开发状态

- 阶段 6-7 已完成（2026-08-14）：脚手架、登录/注册、预约闭环（三步表单/详情/留言）、个人中心、电医工作台、文档/关于/帮助/反馈、管理端六模块（含举报处理）、移动端适配、死代码零迁移。
- 阶段 8（2026-08-14）：前后端联调 + 人工走查通过（走查反馈 6 条全部落地）、生产构建成功、安全验收八项全勾。
- 剩余：正式部署。
