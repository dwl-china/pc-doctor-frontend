# PC-Doctor Frontend

浙江工商大学电脑医院预约系统 —— 前端（前后端分离重构版）。

旧前端（`PC-Doctor-Web`）存在分页跳页、空壳页面、硬编码后端地址、错误依赖等工程问题。本仓库为全新重写的前端，功能对齐旧版并补全空壳功能。任务清单见根目录 `TODO.md`（阶段 6-7）。

## 技术栈（已定，待脚手架落地）

| 项 | 选型 |
| --- | --- |
| 框架 | Vue 3 + Vite 5+ + TypeScript |
| 状态 / 路由 | Pinia + Vue Router 4 |
| UI | Element Plus + SCSS + Tailwind |
| HTTP | axios 1.x（拦截器统一带 JWT、统一处理业务 code） |

## 开发状态

脚手架待创建（TODO 阶段 6）。当前仓库仅有 `.gitignore` 与本文档，暂无代码。

## 约定（阶段 7 落地时执行）

- 接口与图片 URL 一律走配置，禁止硬编码 `127.0.0.1:8080`；开发环境用 vite proxy
- axios 响应拦截器统一处理业务 code（`0` 通过 / `401` 跳登录 / 其余统一提示），页面层不再各自判 `code===0`
- status / level / 分页大小等魔法数字收敛到 `constants`
- API 契约以 `pc-doctor-backend` 仓库的 [docs/api.md](https://github.com/dwl-china/pc-doctor-backend/blob/main/docs/api.md) 为准
- 通知统一用 Element Plus 消息组件